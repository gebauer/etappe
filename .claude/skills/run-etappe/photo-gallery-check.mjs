#!/usr/bin/env node
/** WORK 18.15 — All details can browse a stop's other photos. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `gal-${Date.now()}@example.com`;
const TITLE = `Gal-${Date.now()}`;

// Two photos on one highlight → a wishlist idea with two photo blocks.
const HIGHLIGHTS = {
  version: 1,
  highlights: [
    {
      title: 'Gullfoss',
      kind: 'waterfall',
      lat: 64.3271,
      lon: -20.1199,
      description: 'Two-tier falls.',
      photos: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Gullfoss%2C_an_iconic_waterfall_of_Iceland.jpg/640px-Gullfoss%2C_an_iconic_waterfall_of_Iceland.jpg',
          title: 'From the path',
        },
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Gullfoss_1.jpg/640px-Gullfoss_1.jpg',
          title: 'Upper tier',
        },
      ],
    },
  ],
};

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `g${String(++n).padStart(2, '0')}-${label}.png`),
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

    // Open the idea → All details.
    await page.getByText('Gullfoss').first().click();
    await page.waitForTimeout(700);
    await page.click('button:has-text("All details")');
    await page.waitForSelector('text=/^1 \\/ 2$/', { timeout: 10000 });
    await shot(page, 'photo-1');

    // The strip + arrows only appear with >1 photo.
    const nextBtn = page.locator('button[aria-label="Next photo"]');
    if ((await nextBtn.count()) === 0)
      throw new Error('no next-photo control with 2 photos');
    const thumbs = await page
      .locator('button[aria-label^="Photo "]')
      .count();
    console.log('thumbnail-strip buttons:', thumbs);
    if (thumbs !== 2) throw new Error('thumbnail strip did not render 2 thumbs');

    await nextBtn.click();
    await page.waitForTimeout(400);
    const counter = (
      await page.locator('text=/^\\d \\/ 2$/').first().innerText()
    ).trim();
    console.log('counter after Next:', counter);
    await shot(page, 'photo-2');
    if (counter !== '2 / 2')
      throw new Error(`counter did not advance: ${counter}`);

    // Wrap around.
    await nextBtn.click();
    await page.waitForTimeout(300);
    const wrapped = (
      await page.locator('text=/^\\d \\/ 2$/').first().innerText()
    ).trim();
    console.log('counter after wrap:', wrapped);
    if (wrapped !== '1 / 2') throw new Error('next did not wrap to 1 / 2');

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
