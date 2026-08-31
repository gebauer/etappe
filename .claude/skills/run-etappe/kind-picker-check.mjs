#!/usr/bin/env node
/**
 * One-off verification for the kind picker + uncategorized review (WORK
 * 7.3): a fresh stop defaults to "uncategorized" (taxonomy.ts), so this
 * exercises both halves without any extra setup — click the Kind field to
 * open the icon grid inline, filter/pick a real kind, then re-add a second
 * stop and use the trip header's uncategorized counter + review drawer to
 * clear it via the same picker.
 *
 * Not part of the permanent driver (driver.mjs) — a throwaway check, same
 * pattern, kept alongside it per SKILL.md's "Extending it" note.
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
const EMAIL = process.env.ETAPPE_EMAIL ?? `e2e-kind-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'KindPickerCheck';
const HEADLESS = process.env.HEADLESS !== 'false';

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `kind-${String(shotN).padStart(2, '0')}-${label}.png`,
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

async function registerAndLogin(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const alreadyIn = await page
    .locator('text=New trip')
    .isVisible()
    .catch(() => false);
  if (alreadyIn) return;
  await page.waitForSelector('text=Sign in', { timeout: 15000 });
  await page.click('text=Need an account? Register');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=New trip', { timeout: 15000 });
}

async function createAndOpenTrip(page, title) {
  await page.fill('label:has-text("Title") input', title);
  await page.fill('label:has-text("Start date") input', '2027-01-01');
  await page.click('button:has-text("New trip")');
  await page.waitForSelector(`text=${title}`);
  await page.click(`button:has-text("${title}")`);
  await page.waitForSelector('text=+ Day', { timeout: 15000 });
}

async function addDayAndStop(page) {
  await page.click('button:has-text("+ Day")');
  await page.waitForSelector('text=+ Stop', { timeout: 15000 });
  await page.click('button:has-text("+ Stop")');
  await page.waitForSelector('input[value="New stop"]', { timeout: 15000 });
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
    await registerAndLogin(page);

    console.log(`--- create + open trip "${TRIP_TITLE}" ---`);
    await createAndOpenTrip(page, TRIP_TITLE);

    console.log('--- add day + stop #1, select it ---');
    await addDayAndStop(page);
    await page.click('span:has-text("uncategorized")');
    await page.waitForSelector('text=Access point', { timeout: 15000 });

    console.log('--- click the Kind field to open the picker ---');
    await page.click('button[title="Change kind (k)"]');
    await page.waitForSelector('input[placeholder="Type to filter…"]', {
      timeout: 5000,
    });
    await shot(page, 'picker-open');

    console.log('--- type to filter, press Enter ---');
    // pressSequentially (real keystrokes, not an instant fill()) — a fill()
    // immediately followed by Enter can race React's state update, since
    // fill() resolves right after dispatching the DOM input event, before
    // React necessarily re-renders; real typing never lands in that gap.
    await page
      .locator('input[placeholder="Type to filter…"]')
      .pressSequentially('waterfall', { delay: 20 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const kindAfterClick = await page
      .locator('button[title="Change kind (k)"]')
      .innerText();
    console.log('Kind field now reads:', JSON.stringify(kindAfterClick));
    if (!kindAfterClick.includes('Waterfall')) {
      throw new Error(
        `Expected "Waterfall" after filter+Enter, got: ${kindAfterClick}`,
      );
    }
    await shot(page, 'picked-waterfall');

    console.log('--- bare "k" shortcut ---');
    // A settle pause: right after the picker closes, focus is transitioning
    // off its (now-removed) filter input, and pressing 'k' before that
    // transition lands can hit the global handler's "focus still in an
    // input" guard — a scripted back-to-back keypress can occasionally
    // outrace it in a way a real user pausing to look at the result never
    // would (confirmed by re-running: the exact same code path passes the
    // large majority of the time).
    await page.waitForTimeout(300);
    const stillSelected = await page
      .locator('h2:text-is("Stop")')
      .isVisible()
      .catch(() => false);
    if (!stillSelected) {
      await page.click('span:has-text("waterfall")');
      await page.waitForSelector('text=Access point', { timeout: 10000 });
    }
    await page.keyboard.press('k');
    const pickerOpenedViaKey = await page
      .locator('input[placeholder="Type to filter…"]')
      .isVisible()
      .catch(() => false);
    console.log('"k" opened the kind picker:', pickerOpenedViaKey);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    if (!pickerOpenedViaKey) {
      throw new Error(
        'Pressing "k" with a stop selected did not open the kind picker.',
      );
    }

    console.log(
      '--- add stop #2 (stays uncategorized), check the header counter ---',
    );
    await page.click('button:has-text("+ Stop")');
    await page.waitForSelector('button:has-text("⚠ 1 uncategorized")', {
      timeout: 10000,
    });
    console.log('header counter shows 1 uncategorized: true');

    console.log('--- open the uncategorized review drawer ---');
    await page.click('button:has-text("⚠ 1 uncategorized")');
    await page.waitForSelector('text=1 uncategorized', { timeout: 5000 });
    await shot(page, 'review-drawer');

    console.log('--- pick a kind inline in the review row ---');
    // The review drawer's grid has no filter typed yet — click a kind icon
    // directly rather than typing, to prove the row-inline grid (not just
    // the inspector's) is wired to onUpdateKind.
    await page.click('button[title="Museum"]');
    await page.waitForSelector('text=All caught up.', { timeout: 10000 });
    console.log('review list emptied after picking a kind: true');
    await shot(page, 'review-cleared');

    // Scoped to the Timeline header's button specifically — the drawer's own
    // title ("0 uncategorized") also contains the substring "uncategorized".
    const counterGone =
      (await page.locator('button:has-text("uncategorized")').count()) === 0;
    console.log(
      'header counter button disappeared once count hit 0:',
      counterGone,
    );
    if (!counterGone) {
      throw new Error(
        'Header uncategorized counter still present after clearing the list.',
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
