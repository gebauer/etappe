#!/usr/bin/env node
/** WORK 18.6 — the remaining light-theme surfaces are dark now.
 * Screenshots the login screen, the trip list, and two dialogs. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `dark-${Date.now()}@example.com`;

let n = 0;
const shot = (page, label) =>
  page.screenshot({
    path: path.join(SHOTS, `y${String(++n).padStart(2, '0')}-${label}.png`),
  });

const nearWhite = (rgb) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
  if (!m) return false;
  return Number(m[1]) > 230 && Number(m[2]) > 230 && Number(m[3]) > 230;
};

async function main() {
  const errs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 860 } })
  ).newPage();
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Sign in', { timeout: 15000 });
    await shot(page, 'login');
    const formBg = await page
      .locator('form')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    console.log('login form bg:', formBg);
    if (nearWhite(formBg)) throw new Error('login form is still light');

    await page.click('text=Need an account? Register');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=New trip', { timeout: 15000 });
    await shot(page, 'trip-list');
    const listForm = await page
      .locator('form')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    console.log('trip-list form bg:', listForm);
    if (nearWhite(listForm)) throw new Error('trip-list form is still light');

    // Highlights import dialog.
    const title = `Dark-${Date.now()}`;
    await page.fill('label:has-text("Title") input', title);
    await page.fill('label:has-text("Start date") input', '2027-06-10');
    await page.click('button:has-text("New trip")');
    await page.waitForSelector(`text=${title}`, { timeout: 10000 });
    await page.click(`button:has-text("${title}")`);
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 15000,
    });
    await page.click('header button:has-text("Import")');
    await page.waitForSelector('text=Import highlights', { timeout: 10000 });
    await shot(page, 'highlights-dialog');
    const dlgBg = await page
      .locator('text=Import highlights')
      .evaluate((el) => {
        let n = el;
        while (n && n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
          n = n.parentElement;
        }
        return '';
      });
    console.log('highlights dialog bg:', dlgBg);
    if (nearWhite(dlgBg)) throw new Error('highlights dialog is still light');

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
