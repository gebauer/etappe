#!/usr/bin/env node
/* Screenshot the redesigned sign-in at desktop + phone widths. Not a
 * pass/fail check — a visual for reviewing the Phase 20 login. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.ETAPPE_URL ?? 'http://localhost:5173';

const browser = await chromium.launch();
const errors = [];
for (const [label, w, h] of [
  ['desktop', 1440, 900],
  ['phone', 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Where are you going next?', {
    timeout: 15000,
  });
  await page.waitForTimeout(800);
  const file = path.join(SHOTS, `login-${label}.png`);
  await page.screenshot({ path: file });
  console.log('screenshot:', file);
  // register-mode copy swap
  await page.click('button:has-text("Register")');
  await page.waitForSelector('button:has-text("Create account")', {
    timeout: 5000,
  });
  console.log(`[${label}] register toggle OK`);
  await page.close();
}
await browser.close();
if (errors.length) {
  console.error('CONSOLE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('no console errors');
