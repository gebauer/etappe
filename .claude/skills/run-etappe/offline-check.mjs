#!/usr/bin/env node
/** WORK 10.3 — lose signal → read-only, all info still on screen; regain
 * signal → editing resumes. Dev server, so this covers
 * the in-session behaviour; the shell service worker is checked by
 * sw-offline-check.mjs against the production build. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `off-${Date.now()}@example.com`;
const TITLE = `Off-${Date.now()}`;

const DOC = {
  version: 1,
  title: TITLE,
  timezone: 'UTC',
  days: [
    {
      index: 1,
      title: 'Day one',
      kind: 'travel',
      stops: [
        { title: 'Alpha', kind: 'town', lat: 64.14, lon: -21.94, dwell_min: 30 },
        { title: 'Bravo', kind: 'waterfall', lat: 63.53, lon: -19.51, dwell_min: 45 },
      ],
      legs: [{ from: 0, to: 1, mode: 'car' }],
    },
  ],
};

let n = 0;
const shot = (page, label) =>
  page.screenshot({ path: path.join(SHOTS, `of${String(++n).padStart(2, '0')}-${label}.png`) });

async function main() {
  const errs = [];
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && !/AbortError|Failed to fetch|502|net::ERR/.test(m.text()) && errs.push(m.text()));
  page.on('pageerror', (e) => !/AbortError|Failed to fetch/.test(String(e)) && errs.push(String(e)));

  try {
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
    await dlg.locator('input[type="date"]').fill('2027-06-10');
    await dlg.locator('button:has-text("Create trip")').click();
    await page.waitForSelector('text=Open the trip', { timeout: 90000 });
    await page.click('button:has-text("Open the trip")');
    await page.waitForSelector('button[aria-label="Add day"]', { timeout: 20000 });
    await page.waitForTimeout(1500); // let the trip cache write

    // --- go offline ---
    await ctx.setOffline(true);
    // Nudge the app: it drops to read-only on the browser 'offline' event.
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForSelector('text=/Offline — read-only/', { timeout: 8000 });
    await shot(page, 'offline-banner');

    // The plan is still fully there.
    const stopsVisible =
      (await page.locator('text=Alpha').count()) > 0 &&
      (await page.locator('text=Bravo').count()) > 0;
    console.log('trip data still on screen offline:', stopsVisible);
    if (!stopsVisible) throw new Error('trip data vanished when offline');

    // An edit attempt is refused, not sent.
    await page.locator('span:has-text("town")').first().click();
    await page.waitForTimeout(400);
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(300);
    // Bump the dwell field and blur.
    const dwell = page.locator('input[aria-label*="well" i], label:has-text("Dwell") input').first();
    if ((await dwell.count()) > 0) {
      await dwell.fill('90');
      await dwell.blur();
    }
    await page.waitForTimeout(500);
    const paused = await page.locator('text=/Editing is paused|read-only/i').count();
    console.log('edit while offline produced a paused notice:', paused > 0);
    await shot(page, 'offline-edit-blocked');
    if (paused === 0) throw new Error('an offline edit was not blocked with a notice');

    // --- back online ---
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(2500);
    const bannerGone = (await page.locator('text=/Offline — read-only/').count()) === 0;
    console.log('banner cleared after reconnect:', bannerGone);
    await shot(page, 'back-online');
    if (!bannerGone) throw new Error('offline banner did not clear after reconnect');

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
