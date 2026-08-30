# CLAUDE.md — Etappe

General working rules for this repository. The product specification lives in
`BUILD.md`. The ordered task list lives in `WORK.md`. This file contains only
conventions that apply to every task.

## What this project is

Etappe is a travel itinerary planner. A trip is a chain of stops connected by
legs, grouped into days. Planning happens on a desktop; the phone is a
read-mostly companion during the trip. Self-hosted, non-commercial, used by the
author, his family and friends.

## Stack — do not substitute

- PocketBase (Go binary, SQLite) — auth, storage, API rules, JS hooks
- React 18 + TypeScript + Vite
- TanStack Query with `persistQueryClient` → IndexedDB
- MapLibre GL JS + OpenFreeMap tiles
- OpenRouteService for car routing, Photon for geocoding, SunCalc for daylight
- Zod for all external data validation
- Deployment: single container on Coolify, PocketBase serves the SPA from `pb_public`

Adding a dependency requires a note in the PR description saying what it
replaces and why the platform can't do it. No UI component library, no state
management library, no ORM, no CSS-in-JS. Tailwind for styling.

## Non-negotiable rules

1. **No LLM API calls anywhere in the app.** Classification, description
   generation and itinerary building are done by the user in their own chat
   window and imported as JSON. The app has no Anthropic key and no
   `classify` endpoint.
2. **Dates are derived, never stored.** `trips.start_date` plus
   `days.order_index` yields a date. Anchors are stored as time-of-day plus a
   day reference. Any code that persists an absolute date on a day, stop or leg
   is a bug.
3. **The cascade engine is pure.** `src/lib/cascade.ts` imports nothing from
   React, PocketBase or the network. It takes a trip document and returns
   computed times and warnings. Editor, share view, PDF and import preview all
   call the same function.
4. **Every ORS response is cached** in the `route_cache` collection before use.
   Never call ORS from the browser; the key stays in the PocketBase hook.
5. **Visibility is enforced server-side.** The share endpoint assembles the
   public payload in a hook. Never filter private blocks in client code and
   call it done.
6. **The taxonomy enum is closed.** Adding a stop kind means adding an icon to
   the sprite build and a default dwell. Never accept a free-text kind.

## Code conventions

- TypeScript strict mode. No `any`; use `unknown` and narrow.
- Types for PocketBase collections are generated into `src/types/pb.ts` — do
  not hand-edit that file.
- All external data (import JSON, ORS, Photon, Overpass) passes through a Zod
  schema at the boundary. Inside the app, data is typed and trusted.
- Pure logic goes in `src/lib/`, React hooks in `src/hooks/`, components in
  `src/components/`. If a function has no JSX and no hooks, it belongs in
  `lib/`.
- Files under ~300 lines. Split by responsibility, not to hit the number.
- Names are English throughout, including UI strings. i18n is out of scope.
- Comments explain why, not what. No comment restates the line below it.

## Testing

- Vitest. The cascade engine, the import parser, the paste-sniffer and the OSM
  tag mapper get real unit tests with fixtures.
- `fixtures/iceland-day1.json` is the canonical test case and must stay in sync
  with the worked example in `BUILD.md`.
- UI is not unit tested. One Playwright smoke test covering create trip →
  add stop → see computed time is enough.
- Run `npm run check` (tsc + eslint + vitest) before declaring a task done.

## Working style

- Do exactly the task in `WORK.md`, then stop. If you notice something else
  worth doing, write it at the bottom of `WORK.md` under "Noticed" instead of
  doing it.
- Finish a task, then ask whether to continue — do not roll straight into the
  next one. The author often works under remote control and relies on the
  notification that fires when a turn ends.
- When the user reports an error, lead with a short likely-cause and the one
  thing to try. Only start deep, tool-heavy investigation if that is not enough
  or they ask for it.
- If the spec is ambiguous or wrong, say so and propose a resolution before
  implementing. Do not silently pick an interpretation.
- Prefer deleting code to adding a flag.
- Commit per task, message in the form `phase 3: cascade engine`.
- No placeholder or mock data left in committed code. No `TODO` without a
  corresponding line in `WORK.md`.

## Out of scope for v1 — do not build

Offline editing, offline map tiles, turn-by-turn navigation, the photo album
and animation, live location tracking, weather, currency conversion,
notifications, mobile structural editing, i18n.
