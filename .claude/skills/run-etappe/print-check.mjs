#!/usr/bin/env node
/** WORK 9.3 — the print view: one page per day, a client-rendered map per
 * day, blocks with attribution, private-note toggle. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `print-${Date.now()}@example.com`;
const TITLE = `Print-${Date.now()}`;

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
        { title: 'Seljalandsfoss', kind: 'waterfall', lat: 63.6156, lon: -19.9886, dwell_min: 45 },
        { title: 'Skogafoss', kind: 'waterfall', lat: 63.5321, lon: -19.5113, dwell_min: 45, is_accommodation: true, notes: 'Book the guesthouse.' },
      ],
      legs: [{ from: 0, to: 1, mode: 'car' }],
    },
    {
      index: 2,
      title: 'Golden circle',
      kind: 'travel',
      stops: [
        { title: 'Gullfoss', kind: 'waterfall', lat: 64.3271, lon: -20.1199, dwell_min: 40 },
        { title: 'Geysir', kind: 'hot_spring', lat: 64.3104, lon: -20.3024, dwell_min: 40 },
      ],
      legs: [{ from: 0, to: 1, mode: 'car' }],
    },
  ],
};

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `pr${String(++n).padStart(2, '0')}-${label}.png`),
    fullPage: true,
  });

async function main() {
  const errs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 } })
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

    await page.click('button:has-text("Import a trip")');
    const dlg = page.locator('div.fixed.inset-0.z-30 > div').first();
    await dlg.locator('textarea').fill(JSON.stringify(DOC));
    await dlg.locator('button:has-text("Validate")').click();
    await page.waitForSelector('text=When does the trip start?', {
      timeout: 10000,
    });
    await dlg.locator('input[type="date"]').fill('2027-06-10');
    await dlg.locator('button:has-text("Create trip")').click();
    await page.waitForSelector('text=Open the trip', { timeout: 90000 });
    await page.click('button:has-text("Open the trip")');
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 20000,
    });
    await page.waitForTimeout(1000);

    await page.click('header button:has-text("Print")');
    await page.waitForSelector('.print-portal', { timeout: 10000 });
    // Two "Day N" headers.
    const dayHeads = await page.locator('.pv-day-h').count();
    console.log('day sections:', dayHeads);
    if (dayHeads !== 2) throw new Error('expected one section per day');

    // Wait for the maps to finish (button enables on "Maps ready").
    await page.waitForFunction(
      () => {
        const b = [...document.querySelectorAll('.pv-btn-primary')][0];
        return b && !b.disabled;
      },
      { timeout: 60000 },
    );
    await page.waitForTimeout(300);
    await shot(page, 'print-doc');

    const maps = await page.$$eval('img.pv-map', (imgs) =>
      imgs.map((i) => (i.getAttribute('src') || '').slice(0, 24) + ':' + (i.getAttribute('src') || '').length),
    );
    console.log('map images:', maps);
    const realMaps = maps.filter(
      (m) => m.startsWith('data:image/png') && Number(m.split(':').pop()) > 3000,
    );
    if (realMaps.length !== 2)
      throw new Error(`expected 2 rendered day maps, got ${realMaps.length}`);

    // The private note toggle.
    const noteVisible = await page.locator('text=Book the guesthouse').isVisible();
    console.log('note (trip-visibility) shown:', noteVisible);
    if (!noteVisible) throw new Error('a trip note is missing from the print doc');

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
