#!/usr/bin/env node
/**
 * Builds a small but representative demo trip (multiple days, varied stop
 * kinds, blocks, a wishlist item with a photo) and screenshots the key
 * screens — for the "current state" reference document kicking off the
 * Redesign branch, not a pass/fail check like the other scripts here.
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const HIGHLIGHTS_FIXTURE = readFileSync(
  path.join(HERE, '..', '..', '..', 'fixtures', 'highlights-example.json'),
  'utf8',
);

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const API_URL = process.env.ETAPPE_API_URL ?? 'http://127.0.0.1:8090';
const EMAIL =
  process.env.ETAPPE_EMAIL ?? `e2e-redesign-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'Iceland Ring Road';

async function shot(page, label) {
  const file = path.join(SHOTS, `state-${label}.png`);
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

async function addStopAt(page, title, lat, lon, kind) {
  await page.click('button:has-text("+ Stop")');
  await page.waitForSelector('input[value="New stop"]', { timeout: 15000 });
  // The newest stop row is the last one in the day — select it by its title input.
  const titleInputs = page.locator('input[value="New stop"]');
  const n = await titleInputs.count();
  const row = titleInputs.nth(n - 1);
  await row.fill(title);
  await row.blur();
  await page.waitForTimeout(300);
  // select that row (click its kind badge, which still reads "uncategorized")
  const badge = page.locator('span:has-text("uncategorized")').last();
  await badge.click();
  await page.waitForSelector('text=Access point', { timeout: 15000 });
  await page.waitForTimeout(200);
  await page.fill('label:has-text("Latitude") input', String(lat));
  await page.locator('label:has-text("Latitude") input').blur();
  await page.waitForTimeout(300);
  await page.fill('label:has-text("Longitude") input', String(lon));
  await page.locator('label:has-text("Longitude") input').blur();
  await page.waitForTimeout(500);
  if (kind) {
    // Direct icon click (by its taxonomy label), not type-to-filter — faster
    // and avoids a per-stop timing race; the filter is exercised once, live,
    // in the dedicated kind-picker screenshot later.
    await page.click('button[title="Change kind (k)"]');
    await page.waitForSelector('input[placeholder="Type to filter…"]', {
      timeout: 10000,
    });
    await page.click(`button[title="${kind}"]`);
    await page.waitForTimeout(400);
  }
}

async function main() {
  await preflight();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 950 },
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log('PAGEERROR:', String(err)));

  console.log(`--- register/login as ${EMAIL} ---`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Sign in', { timeout: 15000 });
  await page.click('text=Need an account? Register');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=New trip', { timeout: 15000 });

  console.log(`--- create trip "${TRIP_TITLE}" ---`);
  await page.fill('label:has-text("Title") input', TRIP_TITLE);
  await page.fill('label:has-text("Start date") input', '2027-06-10');
  await page.click('button:has-text("New trip")');
  await page.waitForSelector(`text=${TRIP_TITLE}`);
  await page.click(`button:has-text("${TRIP_TITLE}")`);
  await page.waitForSelector('text=+ Day', { timeout: 15000 });

  // Deliberately avoids "Gullfoss"/"Reynisfjara" as stop titles — the
  // Highlights fixture imported below adds wishlist items with those exact
  // names, and title text is how later steps re-select a specific row.
  console.log('--- day 1: Golden Circle ---');
  await page.click('button:has-text("+ Day")');
  await page.waitForSelector('text=+ Stop', { timeout: 15000 });
  await addStopAt(page, 'Þingvellir', 64.2559, -21.1295, 'Viewpoint');
  await addStopAt(page, 'Geysir', 64.3128, -20.3026, 'Hot spring');
  await addStopAt(page, 'Kerið', 64.0417, -20.8825, 'Volcano');
  await addStopAt(page, 'Hótel Grímsborgir', 64.0876, -20.9973, 'Hotel');

  console.log('--- day 2: South Coast ---');
  await page.click('button:has-text("+ Day")');
  await page.waitForTimeout(500);
  await addStopAt(page, 'Seljalandsfoss', 63.6156, -19.9886, 'Waterfall');
  await addStopAt(page, 'Skógafoss', 63.5321, -19.5113, 'Waterfall');
  await addStopAt(page, 'Vík í Mýrdal', 63.4194, -19.006, 'Coast');
  await addStopAt(page, 'Kaffi Vík', 63.4188, -19.006, 'Restaurant');

  console.log('--- add a note + link block to the first stop ---');
  await page.click('span:has-text("viewpoint")');
  await page.waitForSelector('text=Access point', { timeout: 15000 });
  await page.click('button:has-text("+ Note")');
  await page.waitForTimeout(300);
  await page.fill(
    'textarea[placeholder*="Markdown"]',
    'Site of the old Alþingi (parliament), founded 930 AD. Walk the rift valley between the tectonic plates.',
  );
  await page.locator('textarea[placeholder*="Markdown"]').blur();
  await page.click('button:has-text("+ Link")');
  await page.waitForTimeout(300);
  const linkUrlInputs = page.locator('input[placeholder="https://…"]');
  await linkUrlInputs.last().fill('https://www.thingvellir.is/en');
  await linkUrlInputs.last().blur();
  await page.waitForTimeout(300);

  console.log('--- import Highlights fixture into the wishlist ---');
  await page.click('button:has-text("Import")');
  await page.waitForSelector('textarea[placeholder*="version"]', {
    timeout: 15000,
  });
  await page.fill('textarea[placeholder*="version"]', HIGHLIGHTS_FIXTURE);
  await page.click('button:has-text("Validate")');
  await page.waitForSelector('text=ready to import', { timeout: 15000 });
  await page.click('button:has-text("Import 2")');
  await page.waitForSelector('text=Imported 2 highlight', { timeout: 20000 });
  await page.click('button:has-text("Done")');
  await page.waitForTimeout(500);

  console.log('--- shot 1: full desktop overview (nothing selected) ---');
  await page.click('h1:has-text("Iceland Ring Road")'); // move focus off any input
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await shot(page, '01-desktop-overview');

  console.log('--- shot 2: stop inspector with blocks ---');
  await page.click('span:has-text("viewpoint")');
  await page.waitForSelector('text=Access point', { timeout: 15000 });
  await page.waitForTimeout(400);
  await shot(page, '02-stop-inspector');

  console.log('--- shot 3: wishlist preview card ---');
  await page.click('li:has-text("Gullfoss") button');
  await page.waitForSelector('text=Place on the itinerary', { timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, '03-wishlist-preview');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  console.log('--- shot 4: kind picker open ---');
  await page.click('button[title="Change kind (k)"]');
  await page.waitForSelector('input[placeholder="Type to filter…"]', {
    timeout: 5000,
  });
  await page.waitForTimeout(300);
  await shot(page, '04-kind-picker');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  console.log('--- shot 5: narrow / mobile-ish viewport ---');
  await page.setViewportSize({ width: 480, height: 900 });
  await page.waitForTimeout(600);
  await shot(page, '05-narrow-viewport');

  console.log('--- shot 6: tablet-ish viewport ---');
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(600);
  await shot(page, '06-tablet-viewport');

  await browser.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exitCode = 1;
});
