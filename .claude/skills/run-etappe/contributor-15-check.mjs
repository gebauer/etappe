#!/usr/bin/env node
/** One-off verification for WORK 15 (wishlist contributor attribution). */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `contrib-${Date.now()}@example.com`;
const PASSWORD = 'TestPass123!';
const TRIP_TITLE = `Contrib15-${Date.now()}`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `c${String(++n).padStart(2, '0')}-${label}.png`),
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

    // Add a wishlist idea via "+ Idea" → paste coordinates (no Photon).
    await page.click('button:has-text("+ Idea")');
    await page.waitForSelector('input[placeholder*="Search a place"]', {
      timeout: 10000,
    });
    await page.fill('input[placeholder*="Search a place"]', '63.5321, -19.5113');
    await page.waitForTimeout(400);
    await page.click('text=/use these coordinates|Use coordinates|63.5321/i');
    await page.waitForTimeout(1200);
    await shot(page, 'idea-added');

    // The wishlist panel row should carry an 18px contributor chip.
    const chip = page.locator('span[title^="Added by "]');
    if ((await chip.count()) === 0)
      throw new Error('no "Added by" contributor chip on the wishlist panel');
    const box = await chip.first().boundingBox();
    console.log('chip size:', box && `${Math.round(box.width)}x${Math.round(box.height)}`);

    // Open the card by clicking the row text, then look for the title-row
    // pill (dot + nickname).
    await page.getByText('Pasted location').first().click();
    await page.waitForTimeout(1000);
    await shot(page, 'card-open');
    const pill = page.locator('span[title^="Added by "]');
    const pillCount = await pill.count();
    console.log('contributor marks visible with the card open:', pillCount);
    // Panel is hidden while the card is open, so any mark now is the card's.
    if (pillCount === 0) throw new Error('contributor pill missing on the card');
    const pillText = (await pill.first().innerText()).trim();
    console.log('card pill text:', JSON.stringify(pillText));

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
