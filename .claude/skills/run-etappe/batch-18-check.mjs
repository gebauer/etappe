#!/usr/bin/env node
/** WORK 18.10 / 18.11 / 18.13: search opens a card first, the wishlist
 * pin-style toggle, and a lat/lon paste in All details. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `b18-${Date.now()}@example.com`;
const TITLE = `B18-${Date.now()}`;

const HIGHLIGHTS = {
  version: 1,
  highlights: [
    {
      title: 'Gullfoss',
      kind: 'waterfall',
      lat: 64.3271,
      lon: -20.1199,
      description: 'Big.',
    },
  ],
};

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `x${String(++n).padStart(2, '0')}-${label}.png`),
  });

async function main() {
  const errs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Sign in', { timeout: 15000 });
    await page.click('text=Need an account? Register');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=New trip', { timeout: 15000 });
    await page.fill('label:has-text("Title") input', TITLE);
    await page.fill('label:has-text("Start date") input', '2027-06-10');
    await page.click('button:has-text("New trip")');
    await page.waitForSelector(`text=${TITLE}`);
    await page.click(`button:has-text("${TITLE}")`);
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 15000,
    });
    await page.click('button[aria-label="Add day"]');
    await page.waitForSelector('button:has-text("+ Stop")');

    // Seed one wishlist idea (also gives us blocks to eyeball for item 4).
    await page.click('header button:has-text("Import")');
    const dlg = page.locator('div.fixed.inset-0.z-30 > div').first();
    await dlg.locator('textarea').fill(JSON.stringify(HIGHLIGHTS));
    await dlg.locator('button:has-text("Validate")').click();
    await page.waitForTimeout(1500);
    await dlg.locator('button:has-text("Import")').first().click();
    await page.waitForSelector('text=/Imported \\d+ highlight/', {
      timeout: 60000,
    });
    await dlg.locator('button:has-text("Done")').click();
    await page.waitForTimeout(800);

    // --- (2) search opens a card first, no placement picker ---
    await page.click('header button:has-text("Search")');
    await page.waitForSelector('input[placeholder*="Search a place"]', {
      timeout: 10000,
    });
    // Paste a coordinate so no external geocoder is needed.
    await page.fill('input[placeholder*="Search a place"]', '63.99, -22.56');
    await page.waitForTimeout(400);
    await page.click('text=/Add at 63/');
    await page.waitForTimeout(800);
    await shot(page, 'search-opens-card');
    const cardOpen = await page
      .locator('text=/\\+ Day|Add to itinerary/')
      .count();
    const pickerOpen = await page.locator('text=/Best fit|Rank/i').count();
    console.log('card opened:', cardOpen > 0, '/ placement picker:', pickerOpen);
    if (cardOpen === 0)
      throw new Error('search did not open the unified card');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // --- (1) wishlist pin-style toggle ---
    const toggle = page.locator(
      'button[aria-label="Toggle wishlist pin style"]',
    );
    if ((await toggle.count()) === 0)
      throw new Error('pin-style toggle not found in the wishlist panel');
    const glyphBefore = (await toggle.innerText()).trim();
    await toggle.click();
    await page.waitForTimeout(800);
    const glyphAfter = (await toggle.innerText()).trim();
    console.log(`pin toggle glyph: ${glyphBefore} -> ${glyphAfter}`);
    if (glyphBefore === glyphAfter)
      throw new Error('the toggle did not change state');
    const stored = await page.evaluate(() =>
      localStorage.getItem('etappe.wishlistPinMode'),
    );
    console.log('persisted pin mode:', stored);
    if (stored !== 'icon') throw new Error('pin mode not persisted');
    await shot(page, 'pin-mode-icon');

    // --- (5) lat/lon paste in All details ---
    await page.click('button:has-text("+ Stop")');
    await page.waitForSelector('text=New stop', { timeout: 15000 });
    await page.click('span:has-text("uncategorized")');
    await page.waitForTimeout(400);
    await page.click('button:has-text("All details")');
    await page.waitForSelector('text=Latitude', { timeout: 10000 });
    const latInput = page.locator('label:has-text("Latitude") input');
    await latInput.focus();
    // Paste the Google-style pair into the Latitude field.
    await latInput.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text', '64.1466, -21.9426');
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }),
      );
    });
    await page.waitForTimeout(900);
    const latVal = await latInput.inputValue();
    const lonVal = await page
      .locator('label:has-text("Longitude") input')
      .inputValue();
    console.log('after paste -> lat:', latVal, 'lon:', lonVal);
    await shot(page, 'coord-paste');
    if (!latVal.startsWith('64.14') || !lonVal.startsWith('-21.94'))
      throw new Error('the coordinate paste did not fill both fields');

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err);
    await shot(page, 'FAILURE').catch(() => {});
    process.exitCode = 1;
  } finally {
    console.log(
      '\nconsole errors:',
      errs.length ? '\n' + errs.join('\n') : '(none)',
    );
    if (errs.length) process.exitCode = 1;
    await browser.close();
  }
}

main();
