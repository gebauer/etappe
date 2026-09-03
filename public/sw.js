/* Etappe shell cache (WORK 10.3 / BUILD §10: "a service worker caches the
 * app shell"). Deliberately minimal and dependency-free — no build-time
 * precache manifest, no Workbox. It caches same-origin GETs as the app
 * actually requests them while online (the SPA's hashed JS/CSS, index.html,
 * the sprite sheet), then serves those from cache when the network is gone
 * so a cold reload still boots into the read-only offline view.
 *
 * Never touches `/api/` or `/_/` — PocketBase's REST API and admin UI. The
 * active trip's data is cached by the app in IndexedDB (`trip-cache.ts`),
 * not here; mixing authenticated API responses into a shared cache is how
 * you leak one session's data into another.
 *
 * Map tiles are cross-origin (OpenFreeMap) and pass straight through — an
 * offline basemap is explicitly out of scope for v1 (CLAUDE.md).
 */

const CACHE = 'etappe-shell-v2';

/** Precache the shell on install so the *first* offline reload works, not
 * only the second. There is no build-time manifest of the hashed asset
 * names (that is what vite-plugin-pwa would add) — instead fetch
 * `index.html` and pull the entry `<script>` / `<link>` it references. The
 * built HTML lists exactly the hashed entry chunk and stylesheet, so this
 * stays correct across rebuilds without a plugin. */
async function precacheShell() {
  const cache = await caches.open(CACHE);
  const urls = new Set([
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/etappe-favicon.svg',
  ]);
  try {
    const html = await (await fetch('/index.html', { cache: 'reload' })).text();
    for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
      urls.add(m[1]);
    }
  } catch {
    /* offline on first install — the runtime cache still fills in later */
  }
  await Promise.all(
    [...urls].map((u) =>
      cache.add(new Request(u, { cache: 'reload' })).catch(() => {}),
    ),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      } catch {
        const hit = await caches.match(req);
        if (hit) return hit;
        // SPA navigation offline: fall back to the cached shell.
        if (req.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});
