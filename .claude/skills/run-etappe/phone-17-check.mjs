#!/usr/bin/env node
/**
 * One-off verification for WORK 17.2 + 17.3 (phone day-detail collapse and
 * the "Explore N places" carousel entry). Not part of the smoke suite —
 * kept around as a reference for driving the phone layout.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = 'TestPass123!';
const TRIP_TITLE = `Phone17-${Date.now()}`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `p${String(++n).padStart(2, '0')}-${label}.png`),
  });

async function main() {
  const consoleErrors = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Sign in', { timeout: 15000 });
    await page.click('text=Need an account? Register');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=New trip', { timeout: 15000 });

    await page.fill('label:has-text("Title") input', TRIP_TITLE);
    await page.fill('label:has-text("Start date") input', '2027-01-01');
    await page.click('button:has-text("New trip")');
    await page.waitForSelector(`text=${TRIP_TITLE}`);
    await page.click(`button:has-text("${TRIP_TITLE}")`);
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 15000,
    });

    await page.click('button[aria-label="Add day"]');
    await page.waitForSelector('button:has-text("+ Stop")', { timeout: 15000 });
    await shot(page, 'day-open');

    const mapH = () =>
      page.locator('.maplibregl-canvas').first().boundingBox().then((b) => b.height);
    const heightBefore = await mapH();

    // Collapse the day detail.
    const chevron = page.locator(
      'button[aria-label="Hide the day\'s stops"]',
    );
    if ((await chevron.count()) !== 1) throw new Error('collapse chevron missing');
    await chevron.click();
    await page.waitForTimeout(500);
    await shot(page, 'day-collapsed');

    const stopBtnVisible = await page
      .locator('button:has-text("+ Stop")')
      .isVisible()
      .catch(() => false);
    if (stopBtnVisible) throw new Error('day body still visible after collapse');

    const heightAfter = await mapH();
    if (!(heightAfter > heightBefore + 40))
      throw new Error(
        `map did not grow on collapse (${heightBefore} -> ${heightAfter})`,
      );

    // Wishlist is empty on a fresh trip, so the Explore pill must be absent.
    const explore = page.locator('button:has-text("Explore")');
    if ((await explore.count()) !== 0)
      throw new Error('Explore pill shown with an empty wishlist');

    // Restore.
    await page.locator('button[aria-label="Show the day\'s stops"]').click();
    await page.waitForTimeout(500);
    if (!(await page.locator('button:has-text("+ Stop")').isVisible()))
      throw new Error('day body did not restore');
    const heightRestored = await mapH();
    if (!(Math.abs(heightRestored - heightBefore) < 40))
      throw new Error('map height did not return on expand');
    await shot(page, 'day-restored');

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err);
    await shot(page, 'FAILURE').catch(() => {});
    process.exitCode = 1;
  } finally {
    console.log(
      '\nconsole errors:',
      consoleErrors.length ? '\n' + consoleErrors.join('\n') : '(none)',
    );
    if (consoleErrors.length) process.exitCode = 1;
    await browser.close();
  }
}

main();
