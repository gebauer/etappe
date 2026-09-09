#!/usr/bin/env node
/**
 * One-off verification for the trip lock (author request 2026-09-09): a
 * padlock in the header freezes the itinerary, the frozen `+` still answers
 * with a notice that names the way out, and one click lifts it again.
 *
 * The point of the feature is that a forgotten lock never reads as a broken
 * app, so this checks the *explanation*, not just the refusal.
 *
 * Not part of the permanent driver — see SKILL.md's "Extending it" note and
 * its Gotcha on driver.mjs/most *-check.mjs scripts being stale; this one is
 * re-derived against the live UI, same as link-domain-check.mjs.
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
const EMAIL = process.env.ETAPPE_EMAIL ?? `e2e-lock-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'TripLockCheck';
const HEADLESS = process.env.HEADLESS !== 'false';

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `lock-${String(shotN).padStart(2, '0')}-${label}.png`,
  );
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
}

function expect(cond, message) {
  if (!cond) throw new Error(message);
  console.log('  ok:', message);
}

/** Day pills carry no stable label (the number lives in a `font-mono`
 * span), so count those — verified unique to DayPills.tsx. */
async function dayCount(page) {
  return page.evaluate(
    () =>
      document.querySelectorAll('button > span.font-mono.font-semibold').length,
  );
}

/** Adding a day is a server round-trip, so poll rather than sleep — an
 * 800ms wait was long enough locally to look like a lock. */
async function waitForDayCount(page, n, timeout = 10000) {
  await page.waitForFunction(
    (want) =>
      document.querySelectorAll('button > span.font-mono.font-semibold')
        .length === want,
    n,
    { timeout },
  );
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

  const addDay = page.locator('button[aria-label^="Add day"]');
  const padlock = page.locator(
    'button[aria-label="Lock this trip"], button[aria-label$="Change or unlock"]',
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

    console.log('--- an unlocked trip adds a day ---');
    // A freshly created trip has no days at all; the dock's `+` makes the
    // first one.
    const daysBefore = await dayCount(page);
    await addDay.click();
    await waitForDayCount(page, daysBefore + 1);
    expect(
      true,
      `+ added a day while open (${daysBefore} -> ${daysBefore + 1})`,
    );
    await shot(page, 'open');

    console.log('--- lock the days from the header padlock ---');
    expect(
      (await padlock.getAttribute('aria-label')) === 'Lock this trip',
      'padlock reads "Lock this trip" while open',
    );
    await padlock.click();
    await page.waitForSelector('text=Guards against accidental edits', {
      timeout: 10000,
    });
    await shot(page, 'lock-menu');
    await page.click('button:has-text("Days locked")');
    await page.waitForTimeout(800);

    const chipText = await padlock.innerText();
    console.log('  header chip:', JSON.stringify(chipText));
    expect(
      chipText.includes('🔒 Days locked'),
      'header shows a "🔒 Days locked" chip',
    );

    console.log('--- the + is dimmed but still answers ---');
    expect(
      (await addDay.getAttribute('aria-label')) === 'Add day — days are locked',
      'the + is labelled as locked, not removed',
    );
    expect(
      await addDay.isEnabled(),
      'the + is still clickable (not `disabled`)',
    );
    const daysLocked1 = await dayCount(page);
    await addDay.click();
    // Generous: a day that *did* get through would need this long to show,
    // so a short wait here would pass for the wrong reason.
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText();
    const REFUSAL =
      "Days are locked, so they can't be added or removed. Click the 🔒 in the header to unlock.";
    console.log('  notice present:', bodyText.includes(REFUSAL));
    await shot(page, 'days-locked-refusal');
    expect(bodyText.includes(REFUSAL), 'the refusal names the way out');
    expect(
      (await dayCount(page)) === daysLocked1,
      'no day was added while locked',
    );

    console.log('--- stops/times stay editable at the "days" level ---');
    expect(
      await page.locator('button:has-text("+ Idea")').isEnabled(),
      'the wishlist still takes ideas',
    );

    console.log('--- one click lifts it again ---');
    await padlock.click();
    await page.waitForSelector('text=Guards against accidental edits', {
      timeout: 10000,
    });
    await page.click('button:has-text("🔓 Open")');
    await page.waitForTimeout(800);
    expect(
      (await padlock.getAttribute('aria-label')) === 'Lock this trip',
      'the padlock is back to its open state',
    );
    const daysBeforeReopen = await dayCount(page);
    await addDay.click();
    await waitForDayCount(page, daysBeforeReopen + 1);
    expect(true, 'a day can be added again after unlocking');
    await shot(page, 'unlocked-again');

    console.log('--- the "all" level freezes the itinerary too ---');
    await padlock.click();
    await page.waitForSelector('text=Guards against accidental edits', {
      timeout: 10000,
    });
    await page.click('button:has-text("🔒 Locked")');
    await page.waitForTimeout(800);
    expect(
      (await padlock.innerText()).includes('🔒 Locked'),
      'header shows a "🔒 Locked" chip',
    );
    await addDay.click();
    await page.waitForTimeout(600);
    const allText = await page.locator('body').innerText();
    expect(
      allText.includes(
        'This trip is locked. Click the 🔒 in the header to unlock.',
      ),
      'the "all" refusal also names the way out',
    );
    await shot(page, 'all-locked');

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
