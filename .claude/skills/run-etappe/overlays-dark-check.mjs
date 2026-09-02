#!/usr/bin/env node
/** Visual check for the dark-theme retrofit of the search overlay and the
 * kind picker (WORK 18.1). Screenshots both; assert no light panel remains. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `dark-${Date.now()}@example.com`;
const TRIP_TITLE = `Dark-${Date.now()}`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `d${String(++n).padStart(2, '0')}-${label}.png`),
  });

async function main() {
  const errs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
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

    await page.fill('label:has-text("Title") input', TRIP_TITLE);
    await page.fill('label:has-text("Start date") input', '2027-06-10');
    await page.click('button:has-text("New trip")');
    await page.waitForSelector(`text=${TRIP_TITLE}`);
    await page.click(`button:has-text("${TRIP_TITLE}")`);
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 15000,
    });

    // --- search overlay ---
    await page.click('button:has-text("Search")');
    const field = page.locator('input[placeholder*="Search a place"]');
    await field.waitFor({ timeout: 10000 });
    await field.fill('Reykjavik');
    await page.waitForTimeout(1600);
    await shot(page, 'search-overlay');
    const panelBg = await field.evaluate(
      (el) => getComputedStyle(el.parentElement).backgroundColor,
    );
    console.log('search panel background:', panelBg);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // --- kind picker ---
    await page.click('button[aria-label="Add day"]');
    await page.click('button:has-text("+ Stop")');
    await page.waitForSelector('text=New stop', { timeout: 15000 });
    await page.click('span:has-text("uncategorized")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(400);
    await page.click('button[title="Change kind (k)"]');
    await page.waitForSelector('input[placeholder="Type to filter…"]', {
      timeout: 10000,
    });
    await page.waitForTimeout(600);
    await shot(page, 'kind-picker');
    const filterBg = await page
      .locator('input[placeholder="Type to filter…"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    console.log('kind filter background:', filterBg);

    console.log('\nPASS (inspect the two screenshots)');
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
