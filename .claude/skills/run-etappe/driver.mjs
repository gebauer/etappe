#!/usr/bin/env node
/**
 * Playwright driver for the run-etappe skill. Drives the actual running app
 * in headless Chromium — registers a throwaway account, creates a throwaway
 * trip, and exercises one real user flow (add day/stop -> set coordinates ->
 * place and clear a routing access point) end-to-end, screenshotting every
 * step and failing on any browser console error or uncaught exception.
 *
 * This is a smoke test AND a reference for driving other flows: copy the
 * helper functions below (selectStop, fillLatLon, etc.) and extend main()
 * for whatever the next agent needs to click through — the block editor, the
 * wishlist, drag-and-drop reordering, the search palette, and so on all
 * follow the same page.click/page.fill/page.locator pattern.
 *
 * Usage: see SKILL.md. In short:
 *   cd .claude/skills/run-etappe && npm install   # once
 *   node driver.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const API_URL = process.env.ETAPPE_API_URL ?? 'http://127.0.0.1:8090';
const EMAIL = process.env.ETAPPE_EMAIL ?? `e2e-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'Testing';
const HEADLESS = process.env.HEADLESS !== 'false';

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `${String(shotN).padStart(2, '0')}-${label}.png`,
  );
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
}

/** Fails fast with a clear pointer at the `dev` skill instead of a confusing
 * navigation timeout — the #1 way this driver goes wrong. */
async function preflight() {
  for (const [name, url] of [
    ['frontend', BASE_URL],
    ['backend', `${API_URL}/api/health`],
  ]) {
    try {
      const res = await fetch(url);
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(
        `\nPreflight failed: ${name} (${url}) is not reachable (${err.message}).\n` +
          'Start the dev servers first — see .claude/skills/dev/SKILL.md ' +
          '(or: npm run pb  &&  npm run dev, both under Node 20).\n',
      );
      process.exit(1);
    }
  }
}

// --- reusable page actions ---------------------------------------------

async function registerAndLogin(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const alreadyIn = await page
    .locator('text=New trip')
    .isVisible()
    .catch(() => false);
  if (alreadyIn) return;

  await page.waitForSelector('text=Sign in', { timeout: 15000 });
  await page.click('text=Need an account? Register');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=New trip', { timeout: 15000 });
}

async function createAndOpenTrip(page, title) {
  await page.fill('label:has-text("Title") input', title);
  await page.fill('label:has-text("Start date") input', '2027-01-01');
  await page.click('button:has-text("New trip")');
  await page.waitForSelector(`text=${title}`);
  await page.click(`button:has-text("${title}")`);
  await page.waitForSelector('text=+ Day', { timeout: 15000 });
}

async function addDay(page) {
  await page.click('button:has-text("+ Day")');
  await page.waitForSelector('text=+ Stop', { timeout: 15000 });
}

async function addStop(page) {
  await page.click('button:has-text("+ Stop")');
  await page.waitForSelector('input[value="New stop"]', { timeout: 15000 });
}

/** Click the stop's kind badge (a plain span) rather than its title input —
 * the click bubbles up to the row's onSelect either way, but this avoids any
 * risk of landing in the title's edit state instead of just selecting. */
async function selectStopByKind(page, kind = 'uncategorized') {
  await page.click(`span:has-text("${kind}")`);
  await page.waitForSelector('text=Access point', { timeout: 15000 });
}

/** React controlled inputs: use fill()/blur(), not an `eval el.value = ...`
 * — that bypasses React's onChange and the app never sees the new value. */
async function setStopLatLon(page, lat, lon) {
  // StopInspector is keyed by `${stop.id}:${stop.updated}` (refreshes
  // uncontrolled inputs after an external change), so committing lat
  // remounts the whole form — including the longitude input a locator
  // captured before the commit. A settle pause between the two fields
  // avoids racing that remount; without it, longitude intermittently ends
  // up blank because .fill() lands on a node that's about to be replaced.
  const latInput = page.locator('label:has-text("Latitude") input');
  await latInput.fill(String(lat));
  await latInput.blur();
  await page.waitForTimeout(400);
  const lonInput = page.locator('label:has-text("Longitude") input');
  await lonInput.fill(String(lon));
  await lonInput.blur();
  await page.waitForTimeout(500); // let the reroute/reload settle
}

async function zoomToStop(page) {
  await page.click('button[title="Zoom the map to this point"]');
  await page.waitForTimeout(800);
}

/** Click "Set on map", then click a point on the MapLibre canvas — it's a
 * single <canvas>, not per-feature DOM nodes, so target it by bounding box
 * + pixel offset rather than a feature selector. */
async function placeAccessPoint(page, offsetX = 80, offsetY = 40) {
  await page.click('button:has-text("Set on map")');
  await page.waitForSelector('text=Click the map for an access point', {
    timeout: 5000,
  });
  const canvas = page.locator('.maplibregl-canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('map canvas not found');
  await page.mouse.click(
    box.x + box.width / 2 + offsetX,
    box.y + box.height / 2 + offsetY,
  );
  await page.waitForTimeout(800);
}

async function clearAccessPoint(page) {
  await page.click('text=clear');
  await page.waitForTimeout(800);
}

// --- main -----------------------------------------------------------------

async function main() {
  await preflight();

  const consoleErrors = [];
  const pageErrors = [];
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  try {
    console.log(`--- register/login as ${EMAIL} ---`);
    await registerAndLogin(page);
    await shot(page, 'logged-in');

    console.log(`--- create + open trip "${TRIP_TITLE}" ---`);
    await createAndOpenTrip(page, TRIP_TITLE);
    await shot(page, 'trip-opened');

    console.log('--- add day + stop ---');
    await addDay(page);
    await addStop(page);
    await shot(page, 'stop-added');

    console.log('--- select stop, set coordinates ---');
    await selectStopByKind(page, 'uncategorized');
    await setStopLatLon(page, 63.5321038, -19.511292); // Skögafoss, Iceland
    await zoomToStop(page);
    await shot(page, 'coords-set');

    console.log('--- place access point on the map ---');
    await placeAccessPoint(page);
    const hasClear = (await page.locator('text=clear').count()) > 0;
    console.log('clear link present:', hasClear);
    await shot(page, 'access-point-set');
    if (!hasClear)
      throw new Error('access point was not set (no "clear" link)');

    console.log('--- clear access point ---');
    await clearAccessPoint(page);
    const backToSet = (await page.locator('text=Set on map').count()) > 0;
    console.log('"Set on map" reappeared:', backToSet);
    await shot(page, 'access-point-cleared');
    if (!backToSet) throw new Error('access point was not cleared');

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err);
    await shot(page, 'FAILURE').catch(() => {});
    process.exitCode = 1;
  } finally {
    console.log('\n--- console errors ---');
    console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
    console.log('\n--- uncaught page exceptions ---');
    console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');
    if (consoleErrors.length || pageErrors.length) process.exitCode = 1;
    await browser.close();
  }
}

main();
