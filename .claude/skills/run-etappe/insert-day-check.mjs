#!/usr/bin/env node
/** Does inserting a day *between* two existing days actually work?
 * (WORK 16.2 built it; this confirms it end to end.) */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `insert-${Date.now()}@example.com`;
const TRIP_TITLE = `Insert-${Date.now()}`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `i${String(++n).padStart(2, '0')}-${label}.png`),
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

    // Four days, so "between 3 and 4" is a real gap.
    for (let i = 0; i < 4; i++) {
      await page.click('button[aria-label="Add day"]');
      await page.waitForTimeout(500);
    }
    // Give day 3 a stop, so the reindex has something to carry.
    await page.click('button[aria-label="Insert a day before Day 3"]').catch(
      () => {},
    );
    await page.waitForTimeout(200);

    const before = await page
      .locator('header + * button[aria-label^="Insert a day before"]')
      .count()
      .catch(() => 0);
    console.log('insert affordances present:', before);

    const daysBefore = (await page.locator('h1 + span').innerText()).trim();
    console.log('header before:', daysBefore);

    // The real gesture: the hairline + between day 3 and day 4.
    const gap = page.locator('button[aria-label="Insert a day before Day 4"]');
    if ((await gap.count()) === 0)
      throw new Error('no "insert before Day 4" affordance in the day dock');
    await gap.click();
    await page.waitForTimeout(1200);

    const daysAfter = (await page.locator('h1 + span').innerText()).trim();
    console.log('header after: ', daysAfter);
    await shot(page, 'after-insert');

    const n1 = Number(daysBefore.match(/^(\d+)/)?.[1] ?? 0);
    const n2 = Number(daysAfter.match(/^(\d+)/)?.[1] ?? 0);
    if (n2 !== n1 + 1)
      throw new Error(`day count did not grow: ${daysBefore} -> ${daysAfter}`);

    console.log('\nPASS — inserting between days works');
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
