#!/usr/bin/env node
/**
 * The owner's backend link (author, 2026-09-13: "can we add a PB backend
 * link to the GUI for the owner (set in the env)").
 *
 * Two accounts, one answer each: the address in `OWNER_EMAIL` sees the link
 * in Account, anyone else sees no trace of it. Needs a backend started with
 * `OWNER_EMAIL` set — `.env` carries it for local dev.
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
const OWNER = process.env.OWNER_EMAIL ?? 'owner@etappe.test';
const PASSWORD = 'TestPass123!';

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
      console.error(`Preflight failed: ${name} (${url}) — ${err.message}`);
      process.exit(1);
    }
  }
}

/** Register (or sign in, if the address is already taken) and open Account. */
async function openAccount(page, email) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Sign in', { timeout: 15000 });
  await page.click('button:has-text("Register")');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  const landed = await page
    .waitForSelector('text=New trip', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!landed) {
    // Already registered by an earlier run — sign in instead.
    await page.click('button:has-text("Sign in")').catch(() => {});
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=New trip', { timeout: 15000 });
  }
  await page.click('button:has-text("Account")');
  await page.waitForSelector('text=Open routes in', { timeout: 10000 });
  await page.waitForTimeout(600);
}

async function main() {
  await preflight();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const pageErrors = [];

  try {
    console.log(`--- the owner (${OWNER}) ---`);
    const ownerCtx = await browser.newContext({
      viewport: { width: 1100, height: 900 },
    });
    const ownerPage = await ownerCtx.newPage();
    ownerPage.on('pageerror', (e) => pageErrors.push(String(e)));
    await openAccount(ownerPage, OWNER);
    const link = ownerPage.locator('a:has-text("Open the backend")');
    expect((await link.count()) === 1, 'Account offers the backend link');
    expect(
      (await link.getAttribute('href')) === '/_/',
      "it points at PocketBase's own dashboard on this origin",
    );
    expect(
      (await link.getAttribute('target')) === '_blank',
      'and opens beside the app rather than replacing it',
    );
    // The panel scrolls; the section sits at the bottom of it.
    await link.scrollIntoViewIfNeeded();
    await ownerPage.waitForTimeout(300);
    expect(await link.isVisible(), 'and it is reachable in the panel');
    await ownerPage.screenshot({
      path: path.join(SHOTS, 'owner-01-account-owner.png'),
    });

    console.log('--- and it really is the dashboard ---');
    const dash = await fetch(`${API_URL}/_/`);
    expect(dash.status === 200, 'the dashboard answers at that URL');

    console.log('--- anybody else ---');
    const otherCtx = await browser.newContext({
      viewport: { width: 1100, height: 900 },
    });
    const otherPage = await otherCtx.newPage();
    otherPage.on('pageerror', (e) => pageErrors.push(String(e)));
    await openAccount(otherPage, `notowner-${Date.now()}@example.com`);
    const body = await otherPage.locator('body').innerText();
    expect(!body.includes('Open the backend'), 'sees no backend link');
    expect(
      !body.includes('The PocketBase dashboard'),
      'and not even the section it sits in',
    );
    await otherPage.screenshot({
      path: path.join(SHOTS, 'owner-02-account-other.png'),
    });

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err.message ?? err);
    process.exitCode = 1;
  } finally {
    console.log(
      'page errors:',
      pageErrors.length ? pageErrors.join('\n') : '(none)',
    );
    if (pageErrors.length) process.exitCode = 1;
    await browser.close();
  }
}

main();
