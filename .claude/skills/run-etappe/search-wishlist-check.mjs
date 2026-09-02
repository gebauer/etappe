#!/usr/bin/env node
/** WORK 18.9 — the search palette offers saved wishlist ideas above the
 * geocoder's new places, under their own headings. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `wsearch-${Date.now()}@example.com`;
const TITLE = `WSearch-${Date.now()}`;

// Imported as the wishlist, so there is something saved to find by name.
const HIGHLIGHTS = {
  version: 1,
  highlights: [
    {
      title: 'Seljalandsfoss',
      kind: 'waterfall',
      lat: 63.6156,
      lon: -19.9886,
      description: 'Walk behind it.',
    },
    {
      title: 'Reynisfjara',
      kind: 'coast',
      lat: 63.4064,
      lon: -19.0448,
      description: 'Black sand.',
    },
  ],
};

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `w${String(++n).padStart(2, '0')}-${label}.png`),
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

    await page.fill('label:has-text("Title") input', TITLE);
    await page.fill('label:has-text("Start date") input', '2027-06-10');
    await page.click('button:has-text("New trip")');
    await page.waitForSelector(`text=${TITLE}`);
    await page.click(`button:has-text("${TITLE}")`);
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 15000,
    });

    // Seed the wishlist through the Highlights importer.
    await page.click('header button:has-text("Import")');
    await page.waitForSelector('textarea', { timeout: 10000 });
    // Scope every click to the dialog: the header behind it has its own
    // Import/Search buttons that would otherwise swallow them.
    const dialog = page.locator('div.fixed.inset-0.z-30 > div').first();
    await dialog.locator('textarea').fill(JSON.stringify(HIGHLIGHTS));
    await dialog.locator('button:has-text("Validate")').click();
    await page.waitForTimeout(2000);
    await dialog.locator('button:has-text("Import")').first().click();
    await page.waitForSelector('text=/Imported \\d+ highlight/', {
      timeout: 60000,
    });
    await dialog.locator('button:has-text("Close"), button[aria-label="Close"]')
      .first()
      .click()
      .catch(() => {});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);

    const wishCount = await page.locator('text=/WISHLIST · [12]/').count();
    console.log('wishlist seeded:', wishCount > 0);

    // Now search for a saved idea by name.
    await page.click('header button:has-text("Search")');
    await page.waitForSelector('input[placeholder*="Search a place"]', {
      timeout: 10000,
    });
    await page.fill('input[placeholder*="Search a place"]', 'Seljaland');
    await page.waitForTimeout(1800);
    await shot(page, 'both-sections');

    const fromWishlist = await page.locator('text=From the wishlist').count();
    const newPlaces = await page.locator('text=New places').count();
    console.log('"From the wishlist" heading:', fromWishlist > 0);
    console.log('"New places" heading:', newPlaces > 0);
    if (fromWishlist === 0)
      throw new Error('the wishlist section did not render');

    // The saved idea must appear above the geocoder's results.
    const order = await page.evaluate(() => {
      const items = [...document.querySelectorAll('li')].map((li) =>
        (li.textContent || '').trim(),
      );
      return {
        wishIdx: items.findIndex((t) => t === 'From the wishlist'),
        newIdx: items.findIndex((t) => t === 'New places'),
      };
    });
    console.log('section order:', order);
    if (!(order.wishIdx >= 0 && order.newIdx > order.wishIdx))
      throw new Error('the wishlist section is not above the new places');

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
