#!/usr/bin/env node
/**
 * One-off verification for the "wishlist on the map" follow-up (WORK 8.1):
 * add two wishlist ideas via the search palette's coordinate-paste path (no
 * network geocoding needed), screenshot the map to confirm the pins render,
 * then click the map's exact center — where the first item is deliberately
 * placed, matching MapPane's hardcoded initial center [-19, 64.9] — and
 * confirm it opens the placement picker instead of dropping a new pin.
 *
 * Not part of the permanent driver (driver.mjs) — a throwaway check, same
 * pattern, kept alongside it per SKILL.md's "Extending it" note.
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
const EMAIL =
  process.env.ETAPPE_EMAIL ?? `e2e-wishlist-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'WishlistMapCheck';
const HEADLESS = process.env.HEADLESS !== 'false';

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `wl-${String(shotN).padStart(2, '0')}-${label}.png`,
  );
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
}

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
        `Preflight failed: ${name} (${url}) not reachable (${err.message}).`,
      );
      process.exit(1);
    }
  }
}

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
  await page.waitForSelector('text=Wishlist', { timeout: 15000 });
}

/** Adds a wishlist idea via the "+ Idea" search palette, using a pasted
 * "lat, lon" pair (paste-sniff handles this with no network geocode). */
async function addWishlistIdeaByCoords(page, lat, lon) {
  await page.click('button:has-text("+ Idea")');
  await page.waitForSelector('input[placeholder*="Search a place"]', {
    timeout: 15000,
  });
  await page.fill('input[placeholder*="Search a place"]', `${lat}, ${lon}`);
  await page.click('button:has-text("📍 Add at")');
  await page.waitForTimeout(500);
}

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

    console.log(`--- create + open trip "${TRIP_TITLE}" ---`);
    await createAndOpenTrip(page, TRIP_TITLE);

    console.log('--- add wishlist idea #1 (map center: 64.9, -19) ---');
    await addWishlistIdeaByCoords(page, 64.9, -19);

    console.log('--- add wishlist idea #2 (63.5, -19.5) ---');
    await addWishlistIdeaByCoords(page, 63.5, -19.5);

    const wishlistItems = await page.locator('text=uncategorized').count();
    console.log('wishlist rows with a kind badge visible:', wishlistItems);

    await shot(page, 'pins-on-map');

    console.log('--- click map center (should hit idea #1) ---');
    const canvas = page.locator('.maplibregl-canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('map canvas not found');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);

    const pickerOpened = await page
      .locator('text=Ranked by added drive time')
      .isVisible()
      .catch(() => false);
    console.log('placement picker opened on wishlist-pin click:', pickerOpened);
    await shot(page, 'clicked-pin');

    if (!pickerOpened) {
      throw new Error(
        'Clicking the map center did not open the placement picker — ' +
          'wishlist pin click handling is not wired up as expected.',
      );
    }

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
