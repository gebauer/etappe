/**
 * One-off drive for WORK 12.2 — the unified pin-click card.
 * Follows driver.mjs's helper patterns; Firefox because this machine is
 * missing libnspr4, which chromium needs.
 */
import { firefox } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
const BASE_URL = 'http://localhost:5173';
const EMAIL = `card-${Date.now()}@example.com`;
const PASSWORD = 'TestPass123!';

const consoleErrors = [];

async function shot(page, label) {
  await fs.mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `card-${label}.png`) });
  console.log(`shot: card-${label}.png`);
}

const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

// Register + open a throwaway trip.
await page.click('text=Need an account? Register');
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForSelector('text=New trip', { timeout: 15000 });

await page.fill('label:has-text("Title") input', 'Card test');
await page.fill('label:has-text("Start date") input', '2027-06-10');
await page.click('button:has-text("New trip")');
await page.click('button:has-text("Card test")');
await page.waitForTimeout(1200);

await page.click('button:has-text("+ Day")');
await page.waitForTimeout(800);
await page.click('button:has-text("+ Stop")');
await page.waitForTimeout(1200);

// Selecting the row opens the card AND renders the right-pane inspector,
// which is still where raw coordinates are set until 12.3/12.6.
await page.click('span:has-text("uncategorized")');
await page.waitForTimeout(1000);

await page.fill('label:has-text("Latitude") input', '64.2559');
await page.locator('label:has-text("Latitude") input').blur();
await page.waitForTimeout(400);
await page.fill('label:has-text("Longitude") input', '-21.13');
await page.locator('label:has-text("Longitude") input').blur();
await page.waitForTimeout(1500);

await shot(page, '1-stop-mode');

const cardTitle = await page
  .locator('h2.text-\\[19px\\]')
  .first()
  .textContent()
  .catch(() => null);
const hasArrive = (await page.locator('text=Arrive').count()) > 0;
const hasEdit = (await page.locator('button:has-text("Edit")').count()) > 0;
console.log(
  'card title:',
  cardTitle,
  '| computed strip:',
  hasArrive,
  '| Edit:',
  hasEdit,
);

// Edit expands the region in place.
await page.click('button:has-text("Edit")');
await page.waitForTimeout(700);
await shot(page, '2-stop-editing');
const hasDwell = (await page.locator('text=Dwell (min)').count()) > 0;
const hasDone = (await page.locator('button:has-text("Done")').count()) > 0;
console.log('edit region — dwell field:', hasDwell, '| Done button:', hasDone);

// Remove asks for confirmation before deleting (handoff requirement).
await page.click('button:has-text("Remove")');
await page.waitForTimeout(400);
const confirms =
  (await page.locator('button:has-text("Confirm remove")').count()) > 0;
console.log('remove confirmation:', confirms);
await shot(page, '3-remove-confirm');

// Escape closes the card without deleting.
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// A bare map click opens the card in empty-click mode.
const canvas = page.locator('.maplibregl-canvas').first();
const box = await canvas.boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.waitForTimeout(2500);
  await shot(page, '4-empty-click');
  const wishBtn =
    (await page.locator('button:has-text("+ Wishlist")').count()) > 0;
  const dayBtn = (await page.locator('button:has-text("+ Day")').count()) > 0;
  console.log('empty-click card — + Wishlist:', wishBtn, '| + Day:', dayBtn);
} else {
  console.log('NO MAP CANVAS');
}

console.log('console errors:', JSON.stringify(consoleErrors, null, 2));
await browser.close();
process.exit(0);
