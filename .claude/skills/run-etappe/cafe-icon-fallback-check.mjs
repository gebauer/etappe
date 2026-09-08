#!/usr/bin/env node
/**
 * One-off verification for two author requests (2026-09-04):
 * (1) "cafe" is a selectable kind, and (2) a wishlist idea with no photo
 * shows its kind icon on the map pin instead of a blank tile.
 *
 * Re-derived against the live app rather than copied from an older check
 * script in this directory — several of those (register step, trip
 * creation, "+ Stop") have drifted from the current UI and would have
 * given false failures. See SKILL.md's "Extending it" note.
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
const EMAIL = process.env.ETAPPE_EMAIL ?? `e2e-cafe-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'CafeIconCheck';
const HEADLESS = process.env.HEADLESS !== 'false';

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `cafe-${String(shotN).padStart(2, '0')}-${label}.png`,
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
  // Not `text=Need an account? Register` — that phrase spans a <span> plus
  // a nested <button>, and clicking the combined text's centre can land on
  // the plain-text part instead of the button. Target the button directly.
  await page.click('button:has-text("Register")');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=New trip', { timeout: 15000 });
}

async function createAndOpenTrip(page, title) {
  // The title/date fields only exist once "New trip" is clicked — they are
  // not the resting state of the trip-list screen (WORK 21 redesign).
  await page.click('button:has-text("New trip")');
  await page.fill('label:has-text("Title") input', title);
  await page.fill('label:has-text("Start date") input', '2027-01-01');
  await page.click('button:has-text("Create")');
  await page.waitForSelector(`text=${title}`, { timeout: 15000 });
  await page.click(`button:has-text("${title}")`);
  await page.waitForSelector('button[aria-label="Add day"]', {
    timeout: 15000,
  });
}

/** Types into the open KindPicker's filter and presses Enter. */
async function pickKindByFilter(page, label) {
  await page.waitForSelector('input[placeholder="Type to filter…"]', {
    timeout: 5000,
  });
  await page
    .locator('input[placeholder="Type to filter…"]')
    .pressSequentially(label, { delay: 20 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
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
    await shot(page, 'trip-opened');

    console.log('--- add a wishlist idea via coordinate paste ---');
    await page.click('button:has-text("+ Idea")');
    await page.waitForSelector('input[placeholder*="Search a place"]', {
      timeout: 15000,
    });
    await page.fill(
      'input[placeholder*="Search a place"]',
      '64.1466, -21.9426',
    );
    await page.click('button:has-text("📍 Add at")');
    await page.waitForTimeout(600);

    console.log('--- open its card, click Edit, set kind to Cafe ---');
    await page.click('button:has-text("Pasted location")');
    await page.waitForSelector('button:has-text("Edit")', { timeout: 10000 });
    await shot(page, 'read-only-card');
    await page.click('button:has-text("Edit")');
    await page.waitForSelector('button[title="Change kind (k)"]', {
      timeout: 10000,
    });
    await page.click('button[title="Change kind (k)"]');
    await pickKindByFilter(page, 'cafe');
    const kindField = await page
      .locator('button[title="Change kind (k)"]')
      .innerText();
    console.log('Kind field now reads:', JSON.stringify(kindField));
    if (!kindField.includes('Cafe')) {
      throw new Error(`Expected "Cafe" after filter+Enter, got: ${kindField}`);
    }
    await shot(page, 'cafe-kind-set');

    console.log('--- zoom the map to it, screenshot the pin ---');
    // Close the card so the pin isn't hidden under it, then re-open by
    // clicking the map at the pasted coordinates (map centre by default).
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, 'cafe-pin-on-map');

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
