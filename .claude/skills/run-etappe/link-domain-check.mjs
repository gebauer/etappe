#!/usr/bin/env node
/**
 * One-off verification for the link-domain header (author request
 * 2026-09-04): an untitled link block from a recognised domain (Airbnb,
 * Booking.com, Google Maps, ...) should show that domain's name instead of
 * the generic "Official site" fallback.
 *
 * Not part of the permanent driver — see SKILL.md's "Extending it" note and
 * its Gotcha on driver.mjs/most *-check.mjs scripts being stale; this one is
 * re-derived against the live UI, same as cafe-icon-fallback-check.mjs.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const API_URL = process.env.ETAPPE_API_URL ?? 'http://127.0.0.1:8090';
const EMAIL = process.env.ETAPPE_EMAIL ?? `e2e-link-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'LinkDomainCheck';
const HEADLESS = process.env.HEADLESS !== 'false';

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `link-${String(shotN).padStart(2, '0')}-${label}.png`,
  );
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
}

async function preflight() {
  for (const [name, url] of [
    ['frontend', BASE_URL],
    ['backend', `${API_URL}/api/health`],
  ]) {
    try {
      const res = await fetch(url);
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(
        `Preflight failed: ${name} (${url}) not reachable (${err.message}).`,
      );
      process.exit(1);
    }
  }
}

async function main() {
  await preflight();
  const consoleErrors = [];
  const pageErrors = [];
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  try {
    console.log(`--- register/login as ${EMAIL} ---`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Sign in', { timeout: 15000 });
    await page.click('button:has-text("Register")');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=New trip', { timeout: 15000 });

    console.log(`--- create + open trip "${TRIP_TITLE}" ---`);
    await page.click('button:has-text("New trip")');
    await page.fill('label:has-text("Title") input', TRIP_TITLE);
    await page.fill('label:has-text("Start date") input', '2027-01-01');
    await page.click('button:has-text("Create")');
    await page.waitForSelector(`text=${TRIP_TITLE}`, { timeout: 15000 });
    await page.click(`button:has-text("${TRIP_TITLE}")`);
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 15000,
    });

    console.log('--- add a wishlist idea, open its card ---');
    await page.click('button:has-text("+ Idea")');
    await page.waitForSelector('input[placeholder*="Search a place"]', {
      timeout: 15000,
    });
    await page.fill('input[placeholder*="Search a place"]', '64.15, -21.94');
    await page.click('button:has-text("📍 Add at")');
    await page.waitForTimeout(600);
    await page.click('button:has-text("Pasted location")');
    await page.waitForSelector('button:has-text("All details")', {
      timeout: 10000,
    });

    console.log('--- open "All details", add an Airbnb link with no title ---');
    await page.click('button:has-text("All details")');
    await page.waitForSelector('button:has-text("Link")', { timeout: 10000 });
    await page.click('button:has-text("Link")');
    await page.waitForSelector('text=Empty link', { timeout: 10000 });
    await page.click('text=Empty link');
    await page.waitForSelector('input[placeholder="https://…"]', {
      timeout: 10000,
    });
    await page.fill(
      'input[placeholder="https://…"]',
      'https://www.airbnb.com/rooms/123456',
    );
    await page.locator('input[placeholder="https://…"]').blur();
    await page.waitForTimeout(400);
    await shot(page, 'link-block-open');

    // Placeholder should propose "Airbnb (proposed)" without writing it.
    const titlePlaceholder = await page
      .locator('input[placeholder$="(proposed)"]')
      .getAttribute('placeholder')
      .catch(() => null);
    console.log('Title field placeholder:', JSON.stringify(titlePlaceholder));
    if (titlePlaceholder !== 'Airbnb (proposed)') {
      throw new Error(
        `Expected placeholder "Airbnb (proposed)", got: ${titlePlaceholder}`,
      );
    }

    console.log('--- close details, check the read-only card link label ---');
    // Escape closes the whole card (both "All details" and the card
    // beneath it), not just the details screen — reopen it read-only.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    await page.click('button:has-text("Pasted location")');
    await page.waitForSelector('button:has-text("All details")', {
      timeout: 10000,
    });
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    const hasAirbnbLabel = bodyText.includes('🏠 Airbnb');
    const hasGenericFallback = bodyText.includes('Official site');
    console.log('read-only card shows "🏠 Airbnb":', hasAirbnbLabel);
    console.log(
      'read-only card still shows "Official site":',
      hasGenericFallback,
    );
    await shot(page, 'read-only-card-with-airbnb-label');
    if (!hasAirbnbLabel) {
      throw new Error(
        'Expected the read-only card to show "🏠 Airbnb" for the untitled Airbnb link.',
      );
    }

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err);
    await shot(page, 'FAILURE').catch(() => {});
    process.exitCode = 1;
  } finally {
    console.log('\n--- console errors ---');
    console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
    console.log('\n--- uncaught page exceptions ---');
    console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');
    if (consoleErrors.length || pageErrors.length) process.exitCode = 1;
    await browser.close();
  }
}

main();
