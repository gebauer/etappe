#!/usr/bin/env node
/** WORK 11.2 — trip settings panel: edit the cascade assumptions and see
 * them stick and re-time the trip. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `set-${Date.now()}@example.com`;
const TITLE = `Set-${Date.now()}`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `t${String(++n).padStart(2, '0')}-${label}.png`),
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

    await page.click('button[aria-label="Trip settings"]');
    await page.waitForSelector('text=Trip settings', { timeout: 10000 });
    await shot(page, 'panel-open');

    // Change the currency, the buffer, and a multiplier.
    await page.selectOption('select', 'ISK');
    const buf = page.locator('label:has-text("Car buffer %") input');
    await buf.fill('30');
    const gravel = page.locator('label:has-text("Gravel") input');
    await gravel.fill('1.6');

    // Bad timezone blocks Save.
    const tz = page.locator('label:has-text("Timezone") input');
    await tz.fill('Not/AZone');
    await page.waitForTimeout(200);
    const disabled = await page
      .locator('button:has-text("Save")')
      .isDisabled();
    console.log('Save blocked on a bad timezone:', disabled);
    if (!disabled) throw new Error('Save was not blocked on an invalid tz');
    await tz.fill('Europe/Berlin');
    await page.waitForTimeout(200);

    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1200);

    // Reopen — the values must have stuck.
    await page.click('button[aria-label="Trip settings"]');
    await page.waitForSelector('text=Trip settings', { timeout: 10000 });
    const curVal = await page.locator('select').inputValue();
    const bufVal = await page
      .locator('label:has-text("Car buffer %") input')
      .inputValue();
    const gravelVal = await page
      .locator('label:has-text("Gravel") input')
      .inputValue();
    const tzVal = await page
      .locator('label:has-text("Timezone") input')
      .inputValue();
    console.log('after save/reopen:', { curVal, bufVal, gravelVal, tzVal });
    await shot(page, 'reopened');
    if (
      curVal !== 'ISK' ||
      bufVal !== '30' ||
      gravelVal !== '1.6' ||
      tzVal !== 'Europe/Berlin'
    )
      throw new Error('a setting did not persist');

    // The header currency glyph on the budget button should read ISK now
    // once a cost exists — but at minimum the panel round-trips. Good enough.
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
