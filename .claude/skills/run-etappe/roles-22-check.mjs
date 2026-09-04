#!/usr/bin/env node
/* WORK 22 — the contributor / viewer read-only editor. Registers three
 * accounts, shares one trip with all of them, then drives the editor as a
 * contributor and a viewer and asserts what each can and can't do. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.ETAPPE_URL ?? 'http://localhost:5173';
const PW = 'TestPass123!';
const stamp = Date.now();
const owner = `owner-${stamp}@example.com`;
const contrib = `contrib-${stamp}@example.com`;
const viewer = `viewer-${stamp}@example.com`;

const browser = await chromium.launch();
const fail = (m) => {
  console.error('FAIL:', m);
  process.exitCode = 1;
};

async function ctx() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const p = await c.newPage();
  p.on('pageerror', (e) => fail(`pageerror: ${e}`));
  return { c, p };
}
async function register(p, email) {
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('text=Where are you going next?', { timeout: 15000 });
  await p.click('button:has-text("Register")');
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', PW);
  await p.click('button:has-text("Create account")');
  await p.waitForSelector('text=New trip', { timeout: 15000 });
}
try {
  // Contributor + viewer accounts must exist first so the invite resolves to
  // an instant membership.
  const v = await ctx();
  await register(v.p, viewer);
  const cc = await ctx();
  await register(cc.p, contrib);

  // Owner: make a trip with a day and a stop.
  const o = await ctx();
  await register(o.p, owner);
  await o.p.click('button:has-text("New trip")'); // WORK 21: form opens on demand
  await o.p.fill('label:has-text("Title") input', `Roles ${stamp}`);
  await o.p.fill('label:has-text("Start date") input', '2027-06-10');
  await o.p.click('button:has-text("Create")');
  await o.p.click(`button:has-text("Roles ${stamp}")`);
  await o.p.waitForSelector('button[aria-label="Add day"]', { timeout: 15000 });
  await o.p.click('button[aria-label="Add day"]');
  // WORK 23: "+ Add a stop" opens the search palette; pick a real place.
  await o.p.click('button:has-text("Add a stop")');
  await o.p.waitForSelector('input[placeholder*="Search a place"]', {
    timeout: 10000,
  });
  await o.p.locator('input[placeholder*="Search a place"]').fill('Gullfoss');
  await o.p.waitForTimeout(2500);
  await o.p.locator('.max-h-80 button').first().click();
  await o.p.waitForTimeout(1500);
  await o.p.keyboard.press('Escape');

  // Share with both.
  await o.p.click('button:has-text("Share")');
  for (const [email, role] of [
    [contrib, 'contributor'],
    [viewer, 'viewer'],
  ]) {
    await o.p.fill('input[placeholder="their email"]', email);
    await o.p.selectOption(
      'select:near(input[placeholder="their email"])',
      role,
    );
    await o.p.click('button:has-text("Invite")');
    await o.p.waitForSelector(`text=${email} is on the trip now`, {
      timeout: 10000,
    });
  }
  await o.p.click('button[aria-label="Close"]');
  console.log('setup OK — trip shared with a contributor and a viewer');

  // --- Contributor --- (still signed in from registration)
  await cc.p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await cc.p.waitForSelector('text=New trip', { timeout: 15000 });
  await cc.p.click(`button:has-text("Roles ${stamp}")`);
  await cc.p.waitForSelector('text=/wishlist places/', { timeout: 15000 });
  await cc.p.screenshot({ path: path.join(SHOTS, 'roles-contributor.png') });
  if (await cc.p.locator('button:has-text("Add a stop")').count())
    fail('contributor sees + Stop');
  if (await cc.p.locator('button[aria-label="Add day"]').count())
    fail('contributor sees Add day');
  if (await cc.p.locator('button[aria-label="Trip settings"]').count())
    fail('contributor sees Trip settings');
  // Can add a wishlist idea.
  if (!(await cc.p.locator('button:has-text("+ Idea")').count()))
    fail('contributor has no + Idea');
  console.log('contributor: itinerary hidden, wishlist add present — OK');

  // --- Viewer --- (still signed in from registration)
  await v.p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await v.p.waitForSelector('text=New trip', { timeout: 15000 });
  await v.p.click(`button:has-text("Roles ${stamp}")`);
  await v.p.waitForSelector('text=/View only/', { timeout: 15000 });
  await v.p.screenshot({ path: path.join(SHOTS, 'roles-viewer.png') });
  if (await v.p.locator('button:has-text("Add a stop")').count())
    fail('viewer sees + Stop');
  if (await v.p.locator('button:has-text("+ Idea")').count())
    fail('viewer sees + Idea');
  console.log('viewer: read-only banner, no add affordances — OK');

  if (!process.exitCode) console.log('\nPASS');
} catch (e) {
  fail(String(e));
} finally {
  await browser.close();
}
