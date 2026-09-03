#!/usr/bin/env node
/** WORK 19.1 — per-owner routing credentials + the account panel.
 * Asserts the key is stored but never readable back, the readable
 * `routing_providers` list tracks it, and the link-out choice persists. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `rs-${Date.now()}@example.com`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `rs${String(++n).padStart(2, '0')}-${label}.png`),
  });

async function main() {
  const errs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 } })
  ).newPage();
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/AbortError|Failed to fetch|502|net::ERR/.test(m.text()) &&
      errs.push(m.text()),
  );

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Sign in', { timeout: 15000 });
    await page.click('text=Need an account? Register');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=New trip', { timeout: 15000 });

    await page.click('header button:has-text("Account")');
    await page.waitForSelector('text=Routing engine', { timeout: 10000 });
    await shot(page, 'panel');

    // Store a HERE key.
    const hereRow = page
      .locator('div')
      .filter({ hasText: /^HERE/ })
      .filter({ has: page.locator('input[type="password"]') })
      .last();
    await hereRow.locator('input[type="password"]').fill('FAKE-HERE-KEY-123');
    await hereRow.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1200);

    const stored = await page.locator('text=key stored').count();
    console.log('shows "key stored":', stored > 0);
    if (stored === 0) throw new Error('the key was not recorded');

    // The key must never come back to the client.
    const leaked = await page.evaluate(() => {
      const raw = localStorage.getItem('pocketbase_auth') || '';
      return raw.includes('FAKE-HERE-KEY-123');
    });
    console.log('key present in the persisted auth store:', leaked);
    if (leaked) throw new Error('the API key leaked into the client');

    const providers = await page.evaluate(async () => {
      const raw = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}');
      return raw?.record?.routing_providers ?? null;
    });
    console.log('routing_providers on the auth record:', providers);
    if (!Array.isArray(providers) || !providers.includes('here'))
      throw new Error('routing_providers did not track the stored key');

    // Pick the engine + a link-out app, then reopen and confirm they stuck.
    await page.locator('button:has-text("HERE")').first().click();
    await page.waitForTimeout(800);
    await page.click('button:has-text("OpenStreetMap")');
    await page.waitForTimeout(800);
    await shot(page, 'configured');
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(400);

    await page.click('header button:has-text("Account")');
    await page.waitForSelector('text=Routing engine', { timeout: 10000 });
    const settings = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}');
      return {
        backend: raw?.record?.routing_backend,
        linkOut: raw?.record?.link_out,
      };
    });
    console.log('persisted settings:', settings);
    if (settings.backend !== 'here' || settings.linkOut !== 'osm')
      throw new Error('engine / link-out did not persist');

    // Clearing forgets just that provider.
    await page.locator('button[aria-label="Forget the HERE key"]').click();
    await page.waitForTimeout(1000);
    const after = await page.locator('text=key stored').count();
    console.log('"key stored" after clearing:', after);
    if (after !== 0) throw new Error('clearing the key did not take effect');

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err);
    await shot(page, 'FAILURE').catch(() => {});
    process.exitCode = 1;
  } finally {
    console.log(
      '\nconsole errors:',
      errs.length ? '\n' + errs.join('\n') : '(none)',
    );
    if (errs.length) process.exitCode = 1;
    await browser.close();
  }
}

main();
