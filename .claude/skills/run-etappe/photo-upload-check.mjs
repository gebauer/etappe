#!/usr/bin/env node
/**
 * One-off verification for the photo pipeline (WORK 7.2): upload a real,
 * decodable 1x1 JPEG carrying EXIF GPS + DateTimeOriginal to a stop's photo
 * block, and confirm the block ends up with a working <img>, the extracted
 * lat/lon/taken_at line, and (implicitly) a working PocketBase thumb —
 * BlockEditor requests the '640x0' thumb size added by migration
 * 1788000006, so a broken thumbs config would 404 the image.
 *
 * The fixture JPEG (make-exif-jpeg.mjs's output, gitignored — deterministic,
 * regenerated on demand below rather than committing a binary) is built
 * fresh each run so it can't go stale against that generator.
 *
 * Not part of the permanent driver (driver.mjs) — a throwaway check, same
 * pattern, kept alongside it per SKILL.md's "Extending it" note.
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const JPEG_PATH =
  process.env.EXIF_JPEG_PATH ??
  path.join(HERE, 'fixtures', 'exif-test-photo.jpg');
if (!process.env.EXIF_JPEG_PATH || !existsSync(JPEG_PATH)) {
  execFileSync('node', [path.join(HERE, 'make-exif-jpeg.mjs'), JPEG_PATH]);
}

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const API_URL = process.env.ETAPPE_API_URL ?? 'http://127.0.0.1:8090';
const EMAIL = process.env.ETAPPE_EMAIL ?? `e2e-photo-${Date.now()}@example.com`;
const PASSWORD = process.env.ETAPPE_PASSWORD ?? 'TestPass123!';
const TRIP_TITLE = process.env.ETAPPE_TRIP_TITLE ?? 'PhotoUploadCheck';
const HEADLESS = process.env.HEADLESS !== 'false';

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const file = path.join(
    SHOTS,
    `photo-${String(shotN).padStart(2, '0')}-${label}.png`,
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

    console.log('--- add day + stop, select it ---');
    await page.click('button:has-text("+ Day")');
    await page.waitForSelector('text=+ Stop', { timeout: 15000 });
    await page.click('button:has-text("+ Stop")');
    await page.waitForSelector('input[value="New stop"]', { timeout: 15000 });
    await page.click('span:has-text("uncategorized")');
    await page.waitForSelector('text=Access point', { timeout: 15000 });

    console.log('--- add a photo block ---');
    await page.click('button:has-text("+ Photo")');
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });

    console.log('--- upload the EXIF-bearing JPEG ---');
    await page.setInputFiles('input[type="file"]', JPEG_PATH);
    // The upload reads the file's EXIF client-side, then PATCHes the block —
    // wait for the file input to disappear (MediaBody hides it once
    // block.file is set) rather than a fixed delay.
    await page.waitForSelector('input[type="file"]', {
      state: 'detached',
      timeout: 15000,
    });
    await page.waitForTimeout(500);
    await shot(page, 'after-upload');

    // Read the whole block's text in one shot rather than locating the GPS/
    // taken_at line by its emoji — `text=📍`/`text=🕘` locators proved flaky
    // here (a Playwright strict-mode ambiguity swallowed by isVisible's
    // catch, not an app bug: a raw PATCH-response dump during debugging
    // showed the correct lat/lon/taken_at every time).
    const blockText = await page
      .locator('span:text-is("photo")')
      .locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
      .innerText();
    console.log('photo block innerText:', JSON.stringify(blockText));

    const hasImg = (await page.locator('img[alt=""]').count()) > 0;
    const hasGps = /📍 -?\d+\.\d+, -?\d+\.\d+/.test(blockText);
    const hasTakenAt = /🕘 \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(blockText);
    console.log('photo block has <img>:', hasImg);
    console.log('shows extracted GPS line:', hasGps);
    console.log('shows extracted taken_at line:', hasTakenAt);

    if (!hasImg || !hasGps || !hasTakenAt) {
      throw new Error(
        'Upload did not produce the expected <img> + GPS/taken_at lines — ' +
          'EXIF extraction or the upload PATCH is not wired up as expected.',
      );
    }

    console.log('--- verify the thumb actually decodes (not a 404) ---');
    const naturalSize = await page
      .locator('img[alt=""]')
      .evaluate((el) => [el.naturalWidth, el.naturalHeight]);
    console.log('img naturalWidth/Height:', naturalSize);
    if (naturalSize[0] === 0) {
      throw new Error(
        "The uploaded photo's <img> has naturalWidth 0 — the file/thumb " +
          'URL is not actually serving a decodable image (migration ' +
          "1788000006's thumbs config, or the upload itself, may be broken).",
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
