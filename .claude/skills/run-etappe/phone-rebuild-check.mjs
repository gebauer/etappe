#!/usr/bin/env node
/**
 * The rebuilt phone layout (design handoff rev 12): map always `flex:1`, a
 * content-sized day drawer with a grab handle, a days-only dock, one
 * swipeable stop card with progress dots, and a fixed 50vh detail sheet.
 *
 * The thing worth checking is the *proportion* — the whole rebuild exists
 * because three stacked surfaces left the map about a third of the screen —
 * so this measures boxes, not just presence.
 *
 * Not part of the permanent driver; see SKILL.md's "Extending it" note and
 * its Gotcha on the stale scripts.
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
const EMAIL = process.env.ETAPPE_EMAIL ?? `e2e-phone-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'PhoneRebuildCheck';
const HEADLESS = process.env.HEADLESS !== 'false';
const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 393, height: 851 };

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `phone-${String(shotN).padStart(2, '0')}-${label}.png`,
  );
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
}

function expect(cond, message) {
  if (!cond) throw new Error(message);
  console.log('  ok:', message);
}

async function box(page, selector) {
  return page.locator(selector).first().boundingBox();
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
  // Seeded at desktop width, then narrowed: adding a stop is a desktop
  // affordance (mobile structural editing is out of scope — CLAUDE.md), so
  // a phone-only run has no way to build a day to step through. `hasTouch`
  // is set from the start because it is fixed per context.
  const context = await browser.newContext({
    viewport: DESKTOP,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  const addDay = page.locator('button[aria-label^="Add day"]');
  const handle = page.locator('button[aria-label$="the day\'s stops"]');

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

    console.log('--- a day, then two stops on it (at desktop width) ---');
    await addDay.click();
    await page.waitForSelector('button[aria-label^="Day 1"]', {
      timeout: 10000,
    });
    for (const [name, coords] of [
      ['Geysir', '64.31, -20.30'],
      ['Gullfoss', '64.33, -20.12'],
    ]) {
      await page.click('button:has-text("+ Add a stop")');
      await page.waitForSelector('input[placeholder*="Search a place"]', {
        timeout: 15000,
      });
      await page.fill('input[placeholder*="Search a place"]', coords);
      await page.click('button:has-text("📍 Add at")');
      await page.waitForTimeout(1500);
      console.log(`  added ${name}`);
      // The new stop opens its sheet; close it before adding the next.
      await page
        .locator('button[aria-label="Close"]')
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(400);
    }
    console.log('--- narrow to a phone ---');
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(800);
    await shot(page, 'drawer-open');

    console.log('--- the map keeps the screen ---');
    const viewport = PHONE;
    const mapBox = await box(page, '.maplibregl-map');
    const asideBox = await box(page, 'aside');
    const mapShare = mapBox.height / viewport.height;
    console.log(
      `  map ${Math.round(mapBox.height)}px of ${viewport.height}px ` +
        `(${Math.round(mapShare * 100)}%), drawer ${Math.round(asideBox.height)}px`,
    );
    expect(
      mapShare > 0.55,
      'the map takes more than half the screen (it used to get ~a third)',
    );
    expect(
      asideBox.height < viewport.height * 0.4,
      'the drawer is sized by its content, not a 58% pane',
    );

    // Headless has no dynamic browser toolbar, so it cannot reproduce what
    // this guards (author, 2026-09-10: the drawer first sat behind
    // Vivaldi's URL bar, then, installed as a PWA, the shell spilled below
    // the fold and scrolling revealed white). What it can check is that the
    // editor is a fixed box the page cannot scroll, whatever the viewport
    // turns out to be on the device.
    console.log('--- the editor is pinned, and the page cannot scroll ---');
    const shell = await page.evaluate(() => {
      const el = document.querySelector('#root > div');
      const doc = document.documentElement;
      return {
        position: el ? getComputedStyle(el).position : '',
        height: el?.getBoundingClientRect().height ?? 0,
        visible: window.innerHeight,
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });
    console.log(
      `  shell ${Math.round(shell.height)}px ${shell.position}, window ` +
        `${shell.visible}px, document ${shell.scrollHeight}px`,
    );
    expect(
      shell.position === 'fixed',
      'the editor shell is pinned to the viewport',
    );
    expect(
      Math.abs(shell.height - shell.visible) < 2,
      'the shell fills the visible viewport exactly',
    );
    expect(
      shell.scrollHeight <= shell.clientHeight,
      'the editor page has nothing to scroll — no slab of white below it',
    );
    expect(
      shell.bodyBg !== 'rgba(0, 0, 0, 0)' &&
        shell.bodyBg !== 'rgb(255, 255, 255)',
      'the page itself is painted, so no white can show through',
    );

    console.log('--- the day dock is days only ---');
    const pill = page.locator('button[aria-label^="Day 1"]').first();
    const pillBox = await pill.boundingBox();
    console.log(`  pill ${Math.round(pillBox.height)}px tall`);
    expect(pillBox.height >= 32, 'the day pill is a 34px touch target');
    expect(
      (await pill.innerText()).trim() === '1',
      'the pill carries the number and nothing else',
    );
    expect(
      (await page
        .locator('button[aria-label="Scroll to later days"]')
        .count()) === 0,
      'the ‹ › scroll buttons are gone on phone',
    );

    console.log('--- one stop card, stepped, with dots ---');
    const dots = page.locator('[aria-label^="Stop "][aria-label*=" of "]');
    expect((await dots.count()) === 1, 'the day shows progress dots');
    expect(
      (await dots.getAttribute('aria-label')) === 'Stop 1 of 2',
      'the card starts on stop 1 of 2',
    );
    await page.click('button[aria-label="Next stop"]');
    await page.waitForTimeout(300);
    expect(
      (await dots.getAttribute('aria-label')) === 'Stop 2 of 2',
      '› steps to the next stop',
    );
    await page.click('button[aria-label="Next stop"]');
    await page.waitForTimeout(300);
    expect(
      (await dots.getAttribute('aria-label')) === 'Stop 1 of 2',
      'stepping past the last stop wraps to the first',
    );
    await shot(page, 'stepped-card');

    console.log('--- the grab handle collapses the drawer ---');
    const openHeight = (await box(page, 'aside')).height;
    await handle.click();
    await page.waitForTimeout(400);
    const shutHeight = (await box(page, 'aside')).height;
    console.log(
      `  drawer ${Math.round(openHeight)}px -> ${Math.round(shutHeight)}px`,
    );
    expect(shutHeight < openHeight, 'the handle folds the drawer down');
    expect(
      // innerText applies text-transform, so this comes back uppercased.
      /tap to open/i.test(await page.locator('body').innerText()),
      'the collapsed drawer says how to get back in',
    );
    await shot(page, 'collapsed');
    await handle.click();
    await page.waitForTimeout(400);

    console.log('--- tapping the card raises a half-screen sheet ---');
    await page.click('[aria-label^="Stop "] >> xpath=../div//button[2]');
    await page.waitForTimeout(700);
    const sheet = await box(page, '.shadow-phone-card');
    const sheetShare = sheet.height / viewport.height;
    console.log(
      `  sheet ${Math.round(sheet.height)}px (${Math.round(sheetShare * 100)}% of the screen)`,
    );
    expect(Math.abs(sheetShare - 0.5) < 0.03, 'the stop sheet is a fixed 50vh');
    expect(sheet.x === 0, 'the sheet is full width, not an inset strip');
    expect(
      (await box(page, 'aside')).height < openHeight,
      'selecting a stop collapses the drawer without a second flag',
    );
    await shot(page, 'stop-sheet');

    console.log('--- the timing trio fits the sheet ---');
    const clipped = await page.evaluate(() =>
      [
        ...document.querySelectorAll('.shadow-phone-card input[type="time"]'),
      ].map((el) => ({
        label: el.getAttribute('aria-label'),
        over: el.scrollWidth - el.clientWidth,
      })),
    );
    console.log('  time inputs:', JSON.stringify(clipped));
    expect(clipped.length === 2, 'the sheet shows both clocks');
    expect(
      clipped.every((c) => c.over <= 0),
      'neither clock is clipped at phone width',
    );

    console.log('--- the sheet body scrolls ---');
    const scrollable = await page.evaluate(() => {
      const el = document.querySelector(
        '.shadow-phone-card div[class*="overflow-y-auto"]',
      );
      return el ? { h: el.clientHeight, scroll: el.scrollHeight } : null;
    });
    console.log('  body:', JSON.stringify(scrollable));
    expect(
      !!scrollable && scrollable.h > 60,
      'the sheet has a scrollable body',
    );

    console.log('--- Fit trip zooms out without the day list ---');
    await page.locator('button[aria-label="Close"]').first().click();
    await page.waitForTimeout(400);
    await page.click('button[aria-label="Fit trip"]');
    await page.waitForTimeout(700);
    const afterFit = await page.locator('body').innerText();
    expect(
      !afterFit.includes('Whole trip'),
      'phone Fit trip does not enter the trip overview',
    );
    expect(
      await page
        .locator('button[aria-label^="Day 1"]')
        .first()
        .evaluate(
          (el) => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)',
        ),
      'the day stays selected, its pill still active',
    );
    expect(
      /tap to open/i.test(afterFit),
      'Fit trip collapses the drawer and hands the map the screen',
    );
    await shot(page, 'after-fit-trip');

    console.log('--- but the trip list is still a scrolling document ---');
    await page.click('button:has-text("← Trips")');
    await page.waitForSelector('text=Your trips', { timeout: 10000 });
    await page.waitForTimeout(500);
    const list = await page.evaluate(() => {
      const el = document.querySelector('#root > div');
      const doc = document.documentElement;
      return {
        position: el ? getComputedStyle(el).position : '',
        overflow: el ? getComputedStyle(el).overflowY : '',
        scrollable: doc.scrollHeight > doc.clientHeight,
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
      };
    });
    console.log(
      `  list shell ${list.position}/${list.overflow}, document ` +
        `${list.scrollHeight}px in ${list.clientHeight}px`,
    );
    expect(
      list.position === 'static',
      'the trip list keeps flow layout — it has no scroller of its own',
    );
    expect(
      list.overflow !== 'hidden',
      'nothing clips the trip list off the bottom of the page',
    );

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
