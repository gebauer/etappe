#!/usr/bin/env node
/** Verification for WORK 18.2 — the redesigned block editor. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `blocks-${Date.now()}@example.com`;
const TRIP_TITLE = `Blocks-${Date.now()}`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `b${String(++n).padStart(2, '0')}-${label}.png`),
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
    await page.click('button:has-text("+ Stop")');
    await page.waitForSelector('text=New stop', { timeout: 15000 });
    await page.click('span:has-text("uncategorized")');
    await page.waitForTimeout(400);
    await page.click('button:has-text("All details")');
    await page.waitForSelector('text=Blocks', { timeout: 10000 });
    await page.waitForTimeout(400);

    // Add two blocks from the buttons below the list.
    const modal = page.locator('div.shadow-expanded');
    await modal.locator('button:has-text("+ Note")').click();
    await page.waitForTimeout(900);
    await modal.locator('button:has-text("+ Link")').click();
    await page.waitForTimeout(900);
    await shot(page, 'collapsed-list');

    const rows = modal.locator('div.h-\\[42px\\]');
    const rowCount = await rows.count();
    console.log('collapsed rows:', rowCount);
    if (rowCount < 2) throw new Error('expected two collapsed block rows');

    // No native select anywhere in the modal — the segmented control replaced it.
    const selects = await modal.locator('select').count();
    console.log('native <select> elements in the modal:', selects);
    if (selects > 0) throw new Error('a native visibility select survived');

    // Open one row; the other must stay collapsed.
    await rows.first().click();
    await page.waitForTimeout(500);
    const openPanels = await modal.locator('button:has-text("Private")').count();
    console.log('visibility segmented controls visible:', openPanels);
    if (openPanels !== 1)
      throw new Error('expected exactly one open block at a time');
    await shot(page, 'one-open');

    // A photo block shows the dashed dropzone instead of a file input.
    await modal.locator('button:has-text("+ Photo")').click();
    await page.waitForTimeout(900);
    await modal.locator('div.h-\\[42px\\]').last().click();
    await page.waitForTimeout(500);
    const dropzone = await modal
      .locator('text=Drop an image, or click to browse')
      .count();
    console.log('dashed dropzone present:', dropzone > 0);
    await shot(page, 'photo-dropzone');
    if (dropzone === 0) throw new Error('the dropzone did not render');

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
