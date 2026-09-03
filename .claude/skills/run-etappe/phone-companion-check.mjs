#!/usr/bin/env node
/** WORK 10.1 / 10.2 — phone companion: opens on today, swipe the day
 * header to step days, the stop card offers a Maps link + a reorder and
 * hides delete / downgrade. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `pc-${Date.now()}@example.com`;
const TITLE = `PC-${Date.now()}`;

const start = new Date();
start.setDate(start.getDate() - 1); // day 1 = yesterday, day 2 = today (UTC)
const startISO = start.toISOString().slice(0, 10);

const DOC = {
  version: 1,
  title: TITLE,
  timezone: 'UTC',
  days: [
    {
      index: 1,
      title: 'Arrival',
      kind: 'travel',
      stops: [{ title: 'Keflavik', kind: 'airport', lat: 63.985, lon: -22.605, dwell_min: 30 }],
      legs: [],
    },
    {
      index: 2,
      title: 'South coast',
      kind: 'travel',
      stops: [
        { title: 'Seljalandsfoss', kind: 'waterfall', lat: 63.6156, lon: -19.9886, dwell_min: 45 },
        { title: 'Skogafoss', kind: 'waterfall', lat: 63.5321, lon: -19.5113, dwell_min: 45 },
        { title: 'Vik', kind: 'town', lat: 63.4187, lon: -19.006, dwell_min: 30, is_accommodation: true },
      ],
      legs: [{ from: 0, to: 1, mode: 'car' }, { from: 1, to: 2, mode: 'car' }],
    },
  ],
};

let n = 0;
const shot = (page, label) =>
  page.screenshot({ path: path.join(SHOTS, `pc${String(++n).padStart(2, '0')}-${label}.png`) });

/** Fire a horizontal swipe (real Touch objects) on the day-header bar. */
async function swipeDayHeader(page, headerText, dir) {
  await page.evaluate(
    ({ headerText, dir }) => {
      const label = [...document.querySelectorAll('div')].find(
        (d) => d.textContent?.trim() === headerText,
      );
      const el = label?.closest('div[class*="border-b"]');
      if (!el) throw new Error('day header not found: ' + headerText);
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const x0 = dir < 0 ? r.right - 20 : r.left + 20;
      const x1 = dir < 0 ? r.left + 20 : r.right - 20;
      const mk = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(x0)], bubbles: true, cancelable: true }));
      el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [mk(x1)], bubbles: true, cancelable: true }));
    },
    { headerText, dir },
  );
  await page.waitForTimeout(600);
}

async function main() {
  const errs = [];
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && !/AbortError/.test(m.text()) && errs.push(m.text()));
  page.on('pageerror', (e) => !/AbortError/.test(String(e)) && errs.push(String(e)));

  try {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Sign in', { timeout: 15000 });
    await page.click('text=Need an account? Register');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=New trip', { timeout: 15000 });

    await page.click('button:has-text("Import a trip")');
    const dlg = page.locator('div.fixed.inset-0.z-30 > div').first();
    await dlg.locator('textarea').fill(JSON.stringify(DOC));
    await dlg.locator('button:has-text("Validate")').click();
    await page.waitForSelector('text=When does the trip start?', { timeout: 10000 });
    await dlg.locator('input[type="date"]').fill(startISO);
    await dlg.locator('button:has-text("Create trip")').click();
    await page.waitForSelector('text=Open the trip', { timeout: 90000 });
    await page.locator('button:has-text("Open the trip")').click();
    await page.waitForSelector('button[aria-label="Add day"]', { timeout: 20000 });
    await page.click('button:has-text("← Trips")');
    await page.waitForSelector(`text=${TITLE}`, { timeout: 10000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.click(`button:has-text("${TITLE}")`);
    await page.waitForTimeout(2800);
    await shot(page, 'opened');

    const dayHead = (await page.locator('text=/^Day \\d/').first().innerText()).trim();
    console.log('opened on:', dayHead);
    if (!dayHead.startsWith('Day 2'))
      throw new Error(`opens-on-today should land on day 2, got "${dayHead}"`);

    await swipeDayHeader(page, 'Day 2 · South coast', 1); // swipe left → next... wait
    // dx<0 (finger moves left) → next day; we want day 1, so swipe right (dir 1).
    let head = (await page.locator('text=/^Day \\d/').first().innerText()).trim();
    console.log('after swipe right:', head);
    await shot(page, 'after-swipe');
    if (!head.startsWith('Day 1'))
      throw new Error(`swipe-right did not step back to day 1, got "${head}"`);

    await swipeDayHeader(page, 'Day 1 · Arrival', -1); // swipe left → day 2
    head = (await page.locator('text=/^Day \\d/').first().innerText()).trim();
    console.log('after swipe left:', head);
    if (!head.startsWith('Day 2'))
      throw new Error(`swipe-left did not step to day 2, got "${head}"`);

    await page.click('text=Seljalandsfoss');
    await page.waitForTimeout(800);
    await shot(page, 'stop-card');

    const hasMaps = await page.locator('a:has-text("Maps")').count();
    const hasDelete = await page.locator('button:has-text("🗑")').count();
    const hasDowngrade = await page.locator('button:has-text("♻")').count();
    const hasMoveDown = await page.locator('button[aria-label="Move stop later"]').count();
    console.log({ hasMaps, hasDelete, hasDowngrade, hasMoveDown });
    if (hasMaps === 0) throw new Error('no Maps link on the phone stop card');
    if (hasDelete > 0 || hasDowngrade > 0)
      throw new Error('phone stop card still exposes delete / downgrade');
    if (hasMoveDown === 0) throw new Error('no reorder arrows on the phone stop card');

    const href = await page.locator('a:has-text("Maps")').getAttribute('href');
    console.log('maps href:', href);
    if (!/google\.com\/maps\/dir\/.*destination=63\.6156/.test(href))
      throw new Error('Maps link is not a directions URL to the stop');

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
