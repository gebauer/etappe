#!/usr/bin/env node
/**
 * The in-app install invitation (author, 2026-09-10: "neither Vivaldi nor
 * Chrome asks for install").
 *
 * Headless Chromium does not fire `beforeinstallprompt` on its own, so the
 * event is dispatched here the way the browser would. That still exercises
 * everything this owns: the listener, the suppression of the browser's own
 * banner, the button, the call into `prompt()`, and the button going away
 * once the app reports itself installed.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL =
  process.env.ETAPPE_EMAIL ?? `e2e-install-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';

function expect(cond, message) {
  if (!cond) throw new Error(message);
  console.log('  ok:', message);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 900, height: 800 },
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Sign in', { timeout: 15000 });
  await page.click('button:has-text("Register")');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=New trip', { timeout: 15000 });

  const button = page.locator('button:has-text("Install")');
  expect(
    (await button.count()) === 0,
    'no Install button until the browser offers one',
  );

  console.log('--- the browser offers to install ---');
  const fired = await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    let promptCalled = false;
    e.prompt = async () => {
      promptCalled = true;
      window.__promptCalled = true;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
    return { defaultPrevented: e.defaultPrevented, promptCalled };
  });
  expect(
    fired.defaultPrevented,
    "the browser's own mini-infobar is suppressed, since we invite instead",
  );
  await page.waitForSelector('button:has-text("Install")', { timeout: 5000 });
  expect(true, 'the Install button appears');
  await page.screenshot({ path: path.join(SHOTS, 'install-01-offered.png') });

  console.log('--- clicking it hands the prompt back to the browser ---');
  await button.click();
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(() => window.__promptCalled === true),
    "the click calls the browser's prompt()",
  );
  await page.waitForTimeout(300);
  expect(
    (await button.count()) === 0,
    'the button retires — the prompt is single-use',
  );

  console.log('--- and an installed app never sees it again ---');
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.waitForTimeout(300);
  expect((await button.count()) === 1, 'a fresh offer brings it back');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await page.waitForTimeout(300);
  expect(
    (await button.count()) === 0,
    'and `appinstalled` puts it away for good',
  );

  console.log('\nPASS');
} catch (err) {
  console.error('\nFAIL:', err);
  await page
    .screenshot({ path: path.join(SHOTS, 'install-FAILURE.png') })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  console.log(
    'page errors:',
    pageErrors.length ? pageErrors.join('\n') : '(none)',
  );
  if (pageErrors.length) process.exitCode = 1;
  await browser.close();
}
