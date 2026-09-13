#!/usr/bin/env node
/**
 * Capturing a wishlist idea on a phone (author, 2026-09-13: "we need the
 * possibility to add wishlist items in the mobile view, this is currently
 * missing").
 *
 * The header's search-and-place group is desktop-only (WORK 12.7), so the
 * phone's wishlist pill is the only route. This checks it exists on a trip
 * with nothing saved yet — the case that used to show nothing at all —
 * that it survives the drawer being open, that the search palette is
 * usable at 393px, and that what it saves is really on the wishlist.
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
const EMAIL = process.env.ETAPPE_EMAIL ?? `e2e-wish-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'WishlistPhoneCheck';
const HEADLESS = process.env.HEADLESS !== 'false';
const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 393, height: 851 };

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `wishphone-${String(shotN).padStart(2, '0')}-${label}.png`,
  );
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
}

function expect(cond, message) {
  if (!cond) throw new Error(message);
  console.log('  ok:', message);
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
    viewport: DESKTOP,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on(
    'console',
    (m) => m.type() === 'error' && consoleErrors.push(m.text()),
  );
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const addIdea = page.locator(
    'button[aria-label="Add a place to the wishlist"]',
  );

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

    console.log('--- narrow to a phone, wishlist empty ---');
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(900);
    expect(
      (await addIdea.count()) === 1,
      'an empty wishlist still offers a way to capture one',
    );
    expect(
      (await addIdea.innerText()).includes('+ Idea'),
      'and it says what it does while it is the only half of the pill',
    );
    // The drawer is open on arrival — the old rule hid this entirely.
    const drawerOpen = await page
      .locator('aside')
      .innerText()
      .then((t) => !/tap to open/i.test(t));
    expect(drawerOpen, 'the day drawer is open, as it is on arrival');
    expect(
      await addIdea.isVisible(),
      'the pill survives an open drawer — it used to need it folded away',
    );
    console.log('--- and it does not sit on the attribution ---');
    const boxes = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
      };
      return {
        attr: box(document.querySelector('.maplibregl-ctrl-attrib')),
        pill: box(
          document.querySelector(
            'button[aria-label="Add a place to the wishlist"]',
          )?.parentElement,
        ),
      };
    });
    console.log('  ', JSON.stringify(boxes));
    expect(
      boxes.pill.bottom <= boxes.attr.top,
      '"© OpenStreetMap" is a licence term, not something to cover',
    );
    await shot(page, 'empty-wishlist-pill');

    console.log('--- capture a place from the phone ---');
    await addIdea.click();
    await page.waitForSelector('input[placeholder*="Search a place"]', {
      timeout: 15000,
    });
    const palette = await page
      .locator('input[placeholder*="Search a place"]')
      .boundingBox();
    console.log(`  palette input ${Math.round(palette.width)}px wide`);
    expect(
      palette.width > 200 && palette.x >= 0 && palette.x + palette.width <= 393,
      'the search palette fits the phone',
    );
    await shot(page, 'search-palette');
    await page.fill('input[placeholder*="Search a place"]', '64.15, -21.94');
    await page.click('button:has-text("📍 Add at")');
    await page.waitForTimeout(1500);

    console.log('--- it lands on the wishlist ---');
    // Close whatever card the capture opened, back to the map.
    await page
      .locator('button[aria-label="Close"]')
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(600);
    const pill = page.locator('button:has-text("Explore")');
    await page.waitForSelector('button:has-text("Explore")', {
      timeout: 10000,
    });
    console.log('  pill now reads:', (await pill.innerText()).trim());
    expect(
      (await pill.innerText()).includes('Explore 1 place'),
      'the pill counts the captured place',
    );
    expect(
      (await addIdea.count()) === 1,
      'and still offers to capture another',
    );
    await shot(page, 'one-place-saved');

    console.log('--- Explore hands the map the screen ---');
    await pill.click();
    await page.waitForTimeout(800);
    expect(
      /tap to open/i.test(await page.locator('aside').innerText()),
      'browsing folds the drawer, rather than opening a carousel nothing shows',
    );
    const cards = await page
      .locator('button:has-text("Pasted location")')
      .count();
    console.log('  carousel entries:', cards);
    expect(cards > 0, 'the carousel shows the captured place');
    await shot(page, 'carousel');

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
