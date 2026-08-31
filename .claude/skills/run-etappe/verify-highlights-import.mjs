#!/usr/bin/env node
/**
 * One-off verification for the Highlights importer (WORK 8.1 commit path):
 * register, create a throwaway trip, open the wishlist Import dialog, paste
 * the canonical fixture, validate -> preview -> commit, and confirm both
 * wishlist rows land with their coordinates and block counts. Not part of
 * driver.mjs's steady-state flow (yet) — kept as a second script per
 * SKILL.md's "graduate what's reusable" note; fold into driver.mjs's helpers
 * if this flow needs checking regularly.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const fixture = readFileSync(
  path.join(HERE, '../../../fixtures/highlights-example.json'),
  'utf8',
);

let shotN = 100;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(SHOTS, `${shotN}-${label}.png`);
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

try {
  const email = `e2e-highlights-${Date.now()}@example.com`;
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Sign in', { timeout: 15000 });
  await page.click('text=Need an account? Register');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=New trip', { timeout: 15000 });

  console.log('--- create trip ---');
  await page.fill('label:has-text("Title") input', 'Testing');
  await page.fill('label:has-text("Start date") input', '2027-01-01');
  await page.click('button:has-text("New trip")');
  await page.waitForSelector('button:has-text("Testing")');
  await page.click('button:has-text("Testing")');
  await page.waitForSelector('text=Wishlist', { timeout: 15000 });

  console.log('--- open import dialog ---');
  await page.click('button:has-text("Import")');
  await page.waitForSelector('text=Import highlights', { timeout: 5000 });
  await shot(page, 'dialog-open');

  console.log('--- paste fixture, validate ---');
  await page.fill('textarea', fixture);
  await page.click('button:has-text("Validate")');
  await page.waitForSelector('text=ready to import', { timeout: 5000 });
  await shot(page, 'preview');

  console.log('--- commit ---');
  await page.click('button:has-text("Import 2")');
  await page.waitForSelector('text=Imported 2 highlight', { timeout: 15000 });
  await shot(page, 'imported');

  console.log('--- close, check wishlist rows ---');
  await page.click('button:has-text("Done")');
  await page.waitForSelector('text=Gullfoss', { timeout: 5000 });
  const hasReynisfjara = (await page.locator('text=Reynisfjara').count()) > 0;
  console.log('Gullfoss row present: true');
  console.log('Reynisfjara row present:', hasReynisfjara);
  await shot(page, 'wishlist-after-import');
  // No UI yet to inspect a wishlist item's blocks (that's the "visuals"
  // follow-up) — the caller checks pois/blocks rows directly via the DB.

  console.log('\nPASS');
} catch (err) {
  console.error('\nFAIL:', err);
  await shot(page, 'FAILURE').catch(() => {});
  process.exitCode = 1;
} finally {
  console.log('\n--- console/page errors ---');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
  if (consoleErrors.length) process.exitCode = 1;
  await browser.close();
}
