#!/usr/bin/env node
/** WORK 18.12 — the day-dock "mouse gets caught" bug: a pointerup that
 * lands off the rail must not leave it panning on hover. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const EMAIL = `drag-${Date.now()}@example.com`;
const TITLE = `Drag-${Date.now()}`;

async function main() {
  const errs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Sign in', { timeout: 15000 });
    await page.click('text=Need an account? Register');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=New trip', { timeout: 15000 });
    await page.fill('label:has-text("Title") input', TITLE);
    await page.fill('label:has-text("Start date") input', '2027-06-10');
    await page.click('button:has-text("New trip")');
    await page.waitForSelector(`text=${TITLE}`);
    await page.click(`button:has-text("${TITLE}")`);
    await page.waitForSelector('button[aria-label="Add day"]', {
      timeout: 15000,
    });
    // Enough days to overflow the rail.
    for (let i = 0; i < 14; i++) {
      await page.click('button[aria-label="Add day"]');
      await page.waitForTimeout(120);
    }

    const rail = page.locator('div[style*="cursor: grab"]').first();
    const box = await rail.boundingBox();
    if (!box) throw new Error('day rail not found');

    // Simulate a press that starts on the rail and releases *off* it (the
    // lost-pointerup case), then move the mouse back over the rail.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2); // < 4px, no drag armed
    await page.mouse.move(box.x + box.width / 2, box.y - 200); // leave the rail
    await page.mouse.up(); // released far from the rail

    const before = await rail.evaluate((el) => el.scrollLeft);
    // Now just hover across the rail — this is where the bug scrolled it.
    for (let dx = -80; dx <= 80; dx += 20) {
      await page.mouse.move(
        box.x + box.width / 2 + dx,
        box.y + box.height / 2,
      );
      await page.waitForTimeout(30);
    }
    const after = await rail.evaluate((el) => el.scrollLeft);
    console.log(`rail scrollLeft: ${before} -> ${after} on hover`);
    if (Math.abs(after - before) > 3)
      throw new Error('the rail panned on a plain hover — bug still present');

    // And a plain pill click must still switch days.
    await page.locator('div[style*="cursor: grab"] button', { hasText: '3' })
      .first()
      .click();
    await page.waitForTimeout(400);
    const dayHeader = await page.locator('text=/^Day 3$/').first().isVisible();
    console.log('pill click still switches day:', dayHeader);
    if (!dayHeader) throw new Error('a plain pill click no longer selects');

    // A real drag must still pan and must NOT switch days.
    const box2 = await rail.boundingBox();
    await page.mouse.move(box2.x + box2.width - 30, box2.y + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2.x + 40, box2.y + box2.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const stillDay3 = await page.locator('text=/^Day 3$/').first().isVisible();
    console.log('drag left the selected day alone:', stillDay3);
    if (!stillDay3) throw new Error('a drag ended in an accidental day switch');

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err);
    await page
      .screenshot({ path: path.join(SHOTS, 'drag-FAILURE.png') })
      .catch(() => {});
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
