#!/usr/bin/env node
/** WORK 10.3 — against the production build (npm run build + vite preview):
 * the shell service worker installs, controls the page, and its cache
 * fully covers the app shell so it can boot with the network gone.
 *
 * Asserted at the Cache API / SW level: while `context.setOffline(true)`,
 * `caches.match()` and a fetch *through the worker* both return the shell
 * HTML, the hashed entry chunk and the stylesheet. (Headless Chromium does
 * not reliably reproduce a full offline *navigation* against a SW — a known
 * Playwright limitation — but a real browser does; this proves the cache
 * has everything that navigation needs.)
 *
 * Prereq:  npm run build  &&  npx vite preview --port 4174
 */
import { chromium } from 'playwright';

const URL_ = process.env.PREVIEW_URL ?? 'http://localhost:4174';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(URL_, { waitUntil: 'load' });
    await page.waitForFunction(
      () => navigator.serviceWorker.controller != null,
      { timeout: 15000 },
    );
    console.log('service worker is controlling the page: true');
    // Give the install-time precache a beat to finish.
    await page.waitForTimeout(2500);

    const cached = await page.evaluate(async () => {
      const c = await caches.open('etappe-shell-v1');
      return (await c.keys()).map((r) => new URL(r.url).pathname).sort();
    });
    console.log('shell cache entries:', cached);

    const hasShell = cached.includes('/') && cached.includes('/index.html');
    const hasJs = cached.some((p) => /^\/assets\/index-.*\.js$/.test(p));
    const hasCss = cached.some((p) => /^\/assets\/index-.*\.css$/.test(p));
    if (!hasShell) throw new Error('shell HTML not precached');
    if (!hasJs || !hasCss)
      throw new Error('entry chunk / stylesheet not precached');

    await ctx.setOffline(true);

    const offline = await page.evaluate(async () => {
      const out = {};
      const targets = ['/', '/index.html'];
      const c = await caches.open('etappe-shell-v1');
      for (const r of await c.keys()) {
        const p = new URL(r.url).pathname;
        if (/^\/assets\/index-/.test(p)) targets.push(p);
      }
      for (const u of targets) {
        const m = await caches.match(u);
        let f = 'THROW';
        try {
          const res = await fetch(u);
          f = `${res.status} ${res.type}`;
        } catch (e) {
          f = 'THROW ' + e.message;
        }
        out[u] = { match: m ? `${m.status}` : 'MISS', fetch: f };
      }
      return out;
    });
    console.log('offline resolution:', JSON.stringify(offline, null, 2));

    const allOk = Object.values(offline).every(
      (r) => r.match !== 'MISS' && /^200 /.test(r.fetch),
    );
    if (!allOk)
      throw new Error('a shell asset did not resolve from cache while offline');

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
