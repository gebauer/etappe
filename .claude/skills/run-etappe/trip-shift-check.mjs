#!/usr/bin/env node
/** Verification for WORK 18.4 — moving the whole trip to different dates. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `shift-${Date.now()}@example.com`;
const TRIP_TITLE = `Shift-${Date.now()}`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `s${String(++n).padStart(2, '0')}-${label}.png`),
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
    await page.click('button[aria-label="Add day"]');
    await page.waitForSelector('button:has-text("+ Stop")');
    await page.click('button[aria-label="Add day"]');
    await page.waitForTimeout(600);

    const shiftBtn = page.locator(
      'button[title="Move the trip to different dates"]',
    );
    const before = (await shiftBtn.innerText()).trim();
    console.log('header span before:', JSON.stringify(before));
    if (!before.includes('10 Jun'))
      throw new Error(`span did not start at 10 Jun: ${before}`);

    await shiftBtn.click();
    await page.waitForSelector('text=Move the trip', { timeout: 5000 });
    await page.fill('input[type="date"]', '2027-07-01');
    await page.waitForTimeout(300);
    await shot(page, 'popover');
    const preview = await page
      .locator('text=/^[+-]\\d+ days? ·/')
      .first()
      .innerText();
    console.log('shift preview:', JSON.stringify(preview.trim()));

    await page.click('button:has-text("Move trip")');
    await page.waitForTimeout(1200);

    const after = (await shiftBtn.innerText()).trim();
    console.log('header span after: ', JSON.stringify(after));
    if (!after.includes('1 Jul'))
      throw new Error(`span did not move to 1 Jul: ${after}`);

    // The itinerary column's day header must have re-derived too.
    const dayHeader = await page.locator('text=/Thu 1 Jul|1 Jul/').count();
    console.log('re-derived date visible in the column:', dayHeader > 0);
    await shot(page, 'after-shift');
    if (dayHeader === 0)
      throw new Error('the day header did not re-derive to the new date');

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
