#!/usr/bin/env node
/** WORK 18.7 — a trip document without a start_date imports, and the
 * importer asks for the date instead. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `impdate-${Date.now()}@example.com`;
const TITLE = `Dateless-${Date.now()}`;

const DOC = {
  version: 1,
  title: TITLE,
  timezone: 'Atlantic/Reykjavik',
  days: [
    {
      index: 1,
      title: 'South coast',
      kind: 'travel',
      stops: [
        {
          title: 'Seljalandsfoss',
          kind: 'waterfall',
          lat: 63.6156,
          lon: -19.9886,
          dwell_min: 45,
        },
        {
          title: 'Skogafoss',
          kind: 'waterfall',
          lat: 63.5321,
          lon: -19.5113,
          dwell_min: 45,
          is_accommodation: true,
        },
      ],
      legs: [{ from: 0, to: 1, mode: 'car' }],
    },
    { index: 2, title: 'Rest', kind: 'rest', stops: [], legs: [] },
  ],
};

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `m${String(++n).padStart(2, '0')}-${label}.png`),
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

    await page.click('button:has-text("Import a trip")');
    await page.waitForSelector('textarea', { timeout: 10000 });
    await page.fill('textarea', JSON.stringify(DOC));
    await page.click('button:has-text("Validate")');
    await page.waitForSelector('text=When does the trip start?', {
      timeout: 10000,
    });
    await shot(page, 'preview-asks-for-date');

    const hint = await page.locator('text=/carried no date/').count();
    console.log('says the document carried no date:', hint > 0);
    if (hint === 0)
      throw new Error('expected the "carried no date" hint on a dateless doc');

    // Scope to the dialog: the trip-list form behind it has its own
    // `input[type=date]`, and an unscoped fill lands on that one instead.
    const dialog = page.locator('div.shadow-card').filter({
      has: page.locator('text=When does the trip start?'),
    });
    await dialog.locator('input[type="date"]').fill('2027-08-14');
    await page.waitForTimeout(300);
    console.log(
      'importer date field:',
      await dialog.locator('input[type="date"]').inputValue(),
    );
    await dialog.locator('button:has-text("Create trip")').click();
    await page.waitForSelector('text=Open the trip', { timeout: 60000 });
    await shot(page, 'imported');
    await page.click('button:has-text("Open the trip")');
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 20000,
    });
    await page.waitForTimeout(800);

    const span = (
      await page
        .locator('button[title="Move the trip to different dates"]')
        .innerText()
    ).trim();
    console.log('trip span after import:', JSON.stringify(span));
    if (!span.includes('14 Aug'))
      throw new Error(`the chosen start date was not used: ${span}`);
    await shot(page, 'opened');

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
