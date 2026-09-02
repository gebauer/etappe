#!/usr/bin/env node
/** One-off verification for WORK 17.6 (Fit trip → trip overview). */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = 'TestPass123!';
const TRIP_TITLE = `Overview176-${Date.now()}`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `o${String(++n).padStart(2, '0')}-${label}.png`),
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
    await page.fill('input[type="password"]', PASSWORD);
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

    // Two days, one stop on day 1 (coordinates not needed for this check).
    await page.click('button[aria-label="Add day"]');
    await page.waitForSelector('button:has-text("+ Stop")');
    await page.click('button[aria-label="Add day"]');
    await page.click('button:has-text("+ Stop")');
    await page.waitForSelector('text=New stop', { timeout: 15000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Fit trip.
    await page.click('button[aria-label="Fit trip"]');
    await page.waitForTimeout(900);
    await shot(page, 'overview');

    if (!(await page.locator('text=Whole trip').isVisible()))
      throw new Error('column did not switch to the day list');
    if (!(await page.locator('text=/^2 days ·/').first().isVisible()))
      throw new Error('day-list header missing the "N days · range" line');
    const dayOneHeaderGone = !(await page
      .locator('.flex-1 >> text=/^Day 1$/')
      .first()
      .isVisible()
      .catch(() => false));
    if (!dayOneHeaderGone) console.log('note: "Day 1" text still present');

    // Click the first day-list row → back to that day.
    await page.locator('button:has-text("no stops yet"), button:has-text("New stop")').first().click();
    await page.waitForTimeout(500);
    if (!(await page.locator('button:has-text("+ Stop")').isVisible()))
      throw new Error('clicking a day row did not return to the single-day view');
    await shot(page, 'back-to-day');

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err);
    await shot(page, 'FAILURE').catch(() => {});
    process.exitCode = 1;
  } finally {
    console.log('\nconsole errors:', errs.length ? '\n' + errs.join('\n') : '(none)');
    if (errs.length) process.exitCode = 1;
    await browser.close();
  }
}

main();
