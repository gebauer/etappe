---
name: run-etappe
description: Run, drive, and screenshot the Etappe web app in a headless browser. Use when asked to run Etappe, take a screenshot of its UI, click through a flow to confirm a change works, or check the browser console for errors — not just run the test suite.
---

Etappe is a browser-driven React/Vite + PocketBase app with no existing
`chromium-cli` on this machine, so it's driven with a small Playwright
script: `.claude/skills/run-etappe/driver.mjs`. All paths below are relative
to the repo root.

## Prerequisites

Node 20 via nvm (the machine default is older and won't run Vite):

```bash
export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"; nvm use 20 >/dev/null
```

No `apt-get` packages were needed. `playwright install --with-deps` failed
here (needs passwordless sudo, not available), but the plain install worked
without it — for Firefox; see the chromium gotcha below.

## Setup

The driver has its own tiny `package.json` — install once, isolated from the
app's own dependencies (nothing here touches the project's `package.json`):

```bash
cd .claude/skills/run-etappe
npm install                      # playwright npm package
npx playwright install firefox   # downloads the browser to ~/.cache/ms-playwright
```

## Build

No build step — Vite serves the app directly in dev mode.

## Run (agent path)

**First, the dev servers must already be up** — this driver does not start
them (that's the `dev` skill's job; see `.claude/skills/dev/SKILL.md`):

```bash
curl -sf http://127.0.0.1:8090/api/health && curl -sf http://localhost:5173
```

If either fails, follow `.claude/skills/dev/SKILL.md` first. The driver's
own preflight check does this too and fails with the same pointer if you
skip it.

Then run the driver:

```bash
cd .claude/skills/run-etappe
node driver.mjs
```

It registers a throwaway account (a fresh `e2e-<timestamp>@example.com` —
override with `ETAPPE_EMAIL`/`ETAPPE_PASSWORD` to reuse one), creates a
throwaway trip (default title `"Testing"` — override with
`ETAPPE_TRIP_TITLE`), and drives one real flow end-to-end: add a day and a
stop, set the stop's coordinates, zoom the map to it, place a routing
**access point** by clicking the map, confirm it shows up (the amber car pin
and a "clear" link), then clear it. It prints `PASS` or `FAIL`, and exits
non-zero on failure, a thrown assertion, or any browser console
error/uncaught exception — so it doubles as a pass/fail smoke check, not
just a manual walkthrough.

**Never point it at the user's real trips.** It always creates its own
throwaway trip; don't repurpose it to click around an existing trip like
"Island" unless explicitly asked.

Screenshots land in `.claude/skills/run-etappe/screenshots/`, numbered in
order (`01-logged-in.png`, `02-trip-opened.png`, ...). Look at them — a
blank or error-page screenshot means it didn't actually work even if no
exception was thrown.

Env vars, all optional:

| var                                | default                 | purpose                                                         |
| ---------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `ETAPPE_URL`                       | `http://localhost:5173` | frontend base URL                                               |
| `ETAPPE_API_URL`                   | `http://127.0.0.1:8090` | PocketBase base URL (health check only)                         |
| `ETAPPE_EMAIL` / `ETAPPE_PASSWORD` | fresh throwaway         | reuse an existing test account instead of registering a new one |
| `ETAPPE_TRIP_TITLE`                | `Testing`               | name of the throwaway trip                                      |
| `HEADLESS`                         | `true`                  | set `false` to watch it run (needs a display)                   |

**Extending it:** `driver.mjs` exports no library surface, but its helper
functions (`selectStopByKind`, `setStopLatLon`, `placeAccessPoint`, ...) are
the pattern to copy for a new flow — block editor, wishlist, drag-and-drop,
search palette. Add a new helper following the same
`page.click`/`page.fill`/`page.locator` shape and call it from `main()`, or
write a one-off script alongside it that imports `firefox` the same way (see
the chromium gotcha below for why `firefox`, not `chromium`). Scope
locators to a specific container (e.g. a fixed-position modal) when a field
name like "Address" or "Day 2" could also match something already on screen
behind it — `PinCardExpanded` and `StopInspector` can both be mounted at
once during the WORK 12.x transition, for example.

## Run (human path)

Just open `http://localhost:5173` in a real browser once the dev servers
are up (see `.claude/skills/dev/SKILL.md`) and register/log in normally.

## Test

```bash
npm run check   # tsc + eslint + vitest — from the repo root, not this dir
```

This driver is a browser-level smoke check on top of that, not a
replacement for it.

---

## Gotchas

- **A running PocketBase process only applies migrations at startup.** If
  the backend has been running since before a `git pull`/merge that added a
  migration, the live SQLite database silently lacks the new columns — the
  client can still write to them, PocketBase just drops the unknown field
  with no error. Symptom: a feature that reads/writes a newly-added field
  behaves as if every write is a no-op, no console error anywhere. Fix:
  restart the backend (`pkill -f "bin/pocketbase serve"`, then re-run the
  `dev` skill) so pending migrations actually run. This exact scenario is
  why this skill exists — a real feature looked broken and was actually just
  a stale backend process.
- **Chromium cannot launch on this machine — that's why `driver.mjs` uses
  Firefox.** Both the bundled `chrome` and `chrome-headless-shell` die at
  startup with `error while loading shared libraries: libnspr4.so`, and
  that library is absent system-wide (`find / -iname 'libnspr4.so*'`
  returns nothing). Installing it needs sudo, which isn't available.
  Firefox bundles its own NSPR and launches cleanly — if this skill ever
  gets ported to a machine where chromium works fine, that's a sign this
  workaround is no longer needed and `driver.mjs` could switch back.
- **`npx playwright install --with-deps` needs interactive sudo** and fails
  outright in a non-interactive shell ("a password is required"). Skip
  `--with-deps` — the plain `npx playwright install firefox` is sufficient;
  the browser launches headless with no missing `.so` errors.
- **React controlled inputs need `.fill()`/`.blur()`**, not
  `eval el.value = '...'` — the latter never fires React's `onChange`, so
  the app's state never updates even though the DOM looks right in a
  screenshot.
- **The map has no per-feature DOM nodes** — stops and legs are drawn on a
  single `<canvas class="maplibregl-canvas">` by MapLibre GL, so there's no
  CSS selector for "the third stop marker." To click a location on the map,
  get the canvas's `boundingBox()` and click at a pixel offset. (The
  draggable overlay markers for the _selected_ stop and its access point are
  real DOM elements — `.maplibregl-marker` — if you need to drag one.)
- **Registration has no email-verification gate locally** — a fresh
  timestamped email logs straight in, no inbox needed.
- **Click the stop's kind badge** (`span:has-text("uncategorized")`) to
  select a timeline row, not its title `<input>` — a click on the input
  still bubbles up and selects the row too, but the badge avoids any risk of
  landing in title-edit state instead.

## Troubleshooting

- **`TEST FAILED: map canvas not found`**: the map hadn't finished loading
  its style yet, or you're on a screen with no `.maplibregl-canvas` (e.g.
  the trip-list screen, before opening a trip). Make sure `zoomToStop` (or
  equivalent navigation) ran first.
- **Preflight fails immediately with "frontend is not reachable"**: the dev
  servers aren't up. Run the `dev` skill first — this driver deliberately
  doesn't start them itself, so it can't accidentally double-start Vite (see
  that skill's own "don't double-start" note).
