#!/usr/bin/env node
/**
 * The add-day confirmation (author, 2026-09-10: "it's too easy to add empty
 * days in the android view").
 *
 * Covers the three routes in — the dock's `+`, the insert hairlines and the
 * `d` shortcut — plus the two things that make the prompt worth having: it
 * can be declined, and it says what an *insert* costs, which is every later
 * day's date. Also checks that the hover-only hairlines are gone on phone,
 * where they were invisible but still tappable.
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
const EMAIL =
  process.env.ETAPPE_EMAIL ?? `e2e-addday-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'AddDayConfirmCheck';
const HEADLESS = process.env.HEADLESS !== 'false';
const PHONE = { width: 393, height: 851 };

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `addday-${String(shotN).padStart(2, '0')}-${label}.png`,
  );
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
}

function expect(cond, message) {
  if (!cond) throw new Error(message);
  console.log('  ok:', message);
}

const dayCount = (page) =>
  page.evaluate(
    () =>
      document.querySelectorAll('button > span.font-mono.font-semibold').length,
  );

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
    viewport: { width: 1280, height: 900 },
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on(
    'console',
    (m) => m.type() === 'error' && consoleErrors.push(m.text()),
  );
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const addDay = page.locator('button[aria-label^="Add day"]');

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

    console.log('--- the + asks before adding ---');
    expect((await dayCount(page)) === 0, 'a new trip starts with no days');
    await addDay.click();
    await page.waitForSelector('text=Add Day 1?', { timeout: 10000 });
    await shot(page, 'confirm-append');
    expect(
      (await page.locator('body').innerText()).includes('Nothing else moves.'),
      'appending says nothing else moves',
    );

    console.log('--- declining leaves the trip alone ---');
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(400);
    expect((await dayCount(page)) === 0, 'Cancel adds no day');

    await addDay.click();
    await page.waitForSelector('text=Add Day 1?', { timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect((await dayCount(page)) === 0, 'Escape adds no day either');

    console.log('--- confirming adds exactly one ---');
    for (const n of [1, 2, 3]) {
      await addDay.click();
      await page.waitForSelector(`text=Add Day ${n}?`, { timeout: 10000 });
      await page.click('button:has-text("Add day")');
      await page.waitForFunction(
        (want) =>
          document.querySelectorAll('button > span.font-mono.font-semibold')
            .length === want,
        n,
        { timeout: 10000 },
      );
    }
    expect((await dayCount(page)) === 3, 'three confirmations, three days');

    console.log('--- the d shortcut goes through the same gate ---');
    // No focus click first: the shell is `fixed`, so <body> has no box to
    // click, and the shortcut listens on window anyway.
    await page.keyboard.press('d');
    await page.waitForSelector('text=Add Day 4?', { timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect(
      (await dayCount(page)) === 3,
      'the shortcut asks too, and can be declined',
    );

    console.log('--- inserting says what it costs ---');
    await page.click('button[aria-label="Insert a day before Day 2"]');
    await page.waitForSelector('text=Insert a day before Day 2?', {
      timeout: 10000,
    });
    const insertText = await page.locator('body').innerText();
    console.log(
      '  copy:',
      insertText.split('\n').find((l) => l.includes('move one day later')),
    );
    expect(
      insertText.includes('Days 2–3 each move one day later'),
      'the insert prompt names the days whose dates move',
    );
    await shot(page, 'confirm-insert');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    console.log('--- on phone the invisible hairlines are gone ---');
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(700);
    expect(
      (await page
        .locator('button[aria-label^="Insert a day before"]')
        .count()) === 0,
      'no hover-only insert targets for a thumb to hit',
    );
    expect(
      (await addDay.count()) === 1,
      'the dock keeps its + — the phone way to add a day',
    );
    await addDay.click();
    await page.waitForSelector('text=Add Day 4?', { timeout: 10000 });
    await shot(page, 'confirm-on-phone');
    expect(true, 'and it asks on phone too');
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(400);
    expect((await dayCount(page)) === 3, 'declined on phone, still three days');

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
