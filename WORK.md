# WORK.md — Etappe build order

Ordered tasks. Do them in sequence; each phase assumes the previous one is
merged and `npm run check` passes. Specification is in `BUILD.md`, rules in
`CLAUDE.md`.

## Status — updated 2026-08-31

**Phase 6 complete; 7.1 done; Highlights import (schema + importer) done;
both Highlights follow-ups (wishlist-on-map, visual review) done.**
Capture, ranked placement, wishlist, nearby, share target, merge-on-capture,
the inspector block editor (note/link/photo with visibility, reorder,
Markdown notes), and Highlights import — paste JSON → validate → preview →
commit to the wishlist as `pois` (status `idea`) + note/link/photo blocks,
geocoding each `place_hint` via Photon when coordinates are missing — all in.
`blocks.parent_type` now also allows `poi` (migration `1788000005`).
Wishlist `pois` render on `MapPane` as their own pin layer (dark-stroked
category-coloured circles, always on — not gated behind a toggle like
Nearby). A wishlist row now shows a thumbnail (first photo block) and opens
a read-only `WishlistPreview` card (photo carousel, attribution, Markdown
description, links) instead of placing directly — Place/Reject live there;
a map-pin click opens the same card. Fixed along the way: Highlights import
only reloaded the wishlist list, not `records.blocks`, so a fresh import's
photo/note/link blocks were invisible until the next full page load.
**→ Next, in order:** no author instruction past this point — candidates are
7.2 (photo pipeline: upload/thumbs/EXIF/Wikimedia attribution for *stops*,
not just the wishlist preview), 7.3 (kind picker + uncategorized review), or
8.2 (the full multi-day §8 import wizard). Also queued but bigger, in
`ToDo.md`'s "Design direction": the unified pin-click card (generalizes
`WishlistPreview` to stops and empty-map clicks) and the map-dominant
layout that depends on it. Ask before picking one.

Done, with commit: 0.1 `48acf84` · 0.2 `d210535` · 0.3 `52db0c9` ·
dev-server `559a6da` · 1.1 `1679ad5` · 1.2 `f480b33` · 1.3 `f39cc3e` ·
v0.1.0 bump `1872737` · 2.1 `0958663` · 2.3 `a417bc3` · 2.2 `656449b` · 3.1 `b6336e6` · 3.2 `3e2ce85` · 4.1 `f4145de` · 4.2 `51c5769` (checked #2) · 4.3 `c5cd6c6` · 4.4 `1000459` · 5.1 `514d410` · 5.2 `cc5e5ea` · 5.3 `8a7653f` · 5.4 `f0478c4` · 6.1 `4e18a79` · 6.2 `36971fa` · 6.3 `677ebf1` · 6.4 `98f53ef` (map-markers split `2d02145`) · 6.5 `ad266d4` ·
7.1 `d4ae836` · poi-blocks migration `a7a6d27` · Highlights schema `4adb15d` ·
Highlights importer `8d11bd7` · Highlights prompt lat/lon `ea1f1ce` ·
wishlist-on-map `811f909` · wishlist visual review `ec3fac3`.
Each done task is tagged ✅ below. All pushed to `origin/master`.

**Cascade shape (phase 2), for the consumers still to come:**
- Engine input is a normalised `CascadeTrip` (src/lib/cascade.ts), not PB
  records. Daylight is injected (`DaylightProvider`); the SunCalc-backed
  provider is `createSunCalcDaylight(timezone)` in src/lib/daylight.ts.
- `fixtures/iceland-day1.json` is the **import format** (§8). The pure
  `importToCascade(doc, resolveRoute, settings)` adapter (src/lib/import-
  cascade.ts) maps import → `CascadeTrip`; `resolveRoute` is the routing seam
  phase 3 (ORS + cache) and phase 8 (importer) plug into. Leg durations are
  NOT in the fixture — they come from routing (stubbed to §12 in tests).

**How to run / environment**
- Node 20 via nvm — the machine's default `node` is CCP4's Node 16 and will
  not work. In non-interactive shells prefix with:
  `export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"; nvm use 20 >/dev/null`
- Backend: `npm run pb` (PocketBase 0.40.1 binary in `./bin`; fetch with
  `npm run pb:setup`). Frontend: `npm run dev` (Vite proxies `/api` + `/_`).
- After any schema migration: `npm run types:pb` regenerates `src/types/pb.ts`.
- Before every commit: `npm run check` **and** `npm run format:check`
  (Prettier is not part of `check`).

**PocketBase gotchas (already paid for once)**
- Hook files must be named `*.pb.js`; a plain `.js` is silently ignored.
- Hook handlers run in isolated VMs — share code via
  `require(\`${__hooks}/x.js\`)`, not top-level functions.
- A `required` json field rejects `{}`; `trips.default_dwell` is seeded from
  the taxonomy on create. Likewise a `required` **number** field rejects `0` as
  blank — so `order_index`/`car_buffer_pct` are NOT required (fixed in
  `1788000003`). Any field whose 0/empty value is legitimate must not be
  required.
- API rules that test a join with `@collection.x.field` need the any-match
  `?=`, not `=` (plain `=` matches nothing). Express a role check as explicit
  alternatives — `(role ?= 'owner' || role ?= 'editor')` — not `!= 'viewer'`,
  which does not correlate to the same joined row. Same-alias `?=` conditions
  DO correlate to one row (verified: a viewer cannot write). See `1788000003`.
- MapLibre expressions: `feature-state` works only in **paint** properties, not
  layout (so hover can't drive `icon-size`; use `icon-translate`). And a `zoom`
  expression must be the top-level `step`/`interpolate`, never nested in a
  `case`. Either mistake makes `addLayer` throw and the layer silently vanish.
- Changing collections via the admin API/UI while `--automigrate` is on writes
  `*_updated_*.js` migration files into pb_hooks — handy in real use, but
  experimenting through the API litters the tree. Prefer editing rules in a
  migration.

**Spec deviations recorded** — §8 fixture bug fixed (Gullfoss activity 120 min,
not 180); `blocks.creator` added (needed to enforce private-block visibility);
`trips` delete is owner-only; no separate `fixtures/after-dark.json` — the
after-dark case reuses `iceland-day1.json` under a 16:24 daylight stub (the
whole point of injecting daylight), avoiding a drift-prone duplicate.
`stops.access_lat`/`access_lon` (migration `1788000004`, not in BUILD §2) let
a leg route to a nearby road/car park instead of a POI's own coordinates when
the POI itself isn't reachable by car — fixes legs that stayed manual forever
with no way to heal them (see ToDo.md). A leg with no route geometry now draws
a straight dashed connector instead of no line.

**Pending / not done**
- **Release v0.1.0**: version bumped and pushed, but the git tag + GitHub
  release step was blocked by the sandbox classifier. Finish manually:
  `git tag -a v0.1.0 -m "v0.1.0 — foundation" && git push origin v0.1.0`,
  then `gh release create v0.1.0 --title "v0.1.0 — Foundation" --notes "..."`.

## Model routing

| Tier | Model | Thinking | Use for |
|---|---|---|---|
| Heavy | Claude Opus 5 | high | Algorithms with real invariants, anything where a wrong abstraction is expensive to unwind |
| Standard | Claude Sonnet 5 | medium | Most feature work — components, hooks, endpoints, forms |
| Cheap | Claude Haiku 4.5 | low | Mechanical, verifiable work — config, scaffolding, tables, scripts, copy |

Rule of thumb: if the task has an invariant that a test can catch, Standard is
enough. If getting it wrong means rewriting three other things later, use
Heavy. If the output is obvious from the spec and the only risk is typos, use
Cheap.

Only three tasks carry the **Heavy** tag — 2.1, 5.2, 5.3. (An earlier draft of
this file said "four"; the fourth was never identified. Treat the count as three
until a fourth is deliberately chosen.) Don't upgrade a task because it feels
important — upgrade it because a mistake would propagate.

**Execution decision (2026-08-29):** the whole build runs inline on the main
Opus 4.8 thread. The tier table above is documentation of intent, not a dispatch
mechanism — Cheap and Standard tasks run on Opus too, which only helps
correctness. Revisit only if the thread's context gets too large to work in.

---

## Phase 0 — Scaffold

**0.1 Repo and toolchain** · Cheap · ✅ `48acf84`
Vite + React + TS strict, Tailwind, ESLint, Prettier, Vitest, `npm run check`
running tsc + lint + tests. Directory skeleton per `CLAUDE.md`.

**0.2 PocketBase container** · Cheap · ✅ `d210535`
Dockerfile that builds the SPA and serves it from `pb_public`. `docker-compose`
for local dev with a volume. Env template with all five variables.

**0.3 Taxonomy constants** · Cheap · ✅ `52db0c9`
`src/lib/taxonomy.ts` — the closed enum from BUILD §7 with default dwells,
icon names and labels. Plus `src/lib/osm-tags.ts`, the OSM tag → kind lookup
table. Pure data, unit tested for completeness (every enum member has a dwell
and an icon).

---

## Phase 1 — Schema

**1.1 Collections and API rules** · Standard · ✅ `1679ad5`
All collections from BUILD §2 as PocketBase migrations. Roles enforced through
rules; private blocks readable only by their creator. Generate
`src/types/pb.ts`.

**1.2 Day ordering** · Standard · ✅ `f480b33`
Insert, delete and reorder days as transactional `order_index` operations. Date
is derived everywhere — assert no absolute date is persisted. Inserting a day
returns the list of blocks whose parent day now falls on a different date, for
the warning dialog.

**1.3 Auth and trip membership** · Standard · ✅ `f39cc3e`
Login, trip list, create trip, invite by email, role assignment.
Done as data layer + minimal UI (rebuilt in phase 4); invites are pending-by-
email, materialised on registration via `pb_hooks/membership.pb.js`.

---

## Phase 2 — Cascade engine

**2.1 Engine** · **Heavy** · ✅ `0958663`
`src/lib/cascade.ts` per BUILD §3. Pure. Anchors, dwell resolution, buffers and
surface multipliers, all six warning codes. Downstream anchors re-baseline
rather than propagating error.

This is the task where a wrong abstraction is expensive: the editor, share
view, PDF and import preview all consume its output. Get the input and output
types right before writing the body.

**2.2 Fixture and tests** · Standard · ✅ `656449b`
`fixtures/iceland-day1.json` matching BUILD §12 exactly — the happy path, no
warnings. Then one fixture per warning code in isolation, including
`fixtures/after-dark.json` with a stubbed 16:24 sunset. Edge cases: empty day,
rest day, day with no anchor, unreachable anchor, polar day with no sunset.

Verify the §12 table, the §8 JSON snippet and the fixture agree before writing
assertions. These three drifted apart once already.

**2.3 Daylight provider** · Cheap · ✅ `a417bc3`
`DaylightProvider` interface, a SunCalc implementation for the app and a fixed
stub for tests. Handle the no-sunset and no-sunrise cases explicitly. The
cascade engine receives the provider; it never imports SunCalc.

---

## Phase 3 — Routing

**3.1 ORS hook and cache** · Standard · ✅ `b6336e6`
`pb_hooks/route.js` — Goja, ES2015, no npm. Checks `route_cache` first, calls
ORS on miss, writes the cache, returns duration, distance and geometry. Key
never leaves the server.

**3.2 RoutingProvider** · Standard · ✅ `3e2ce85`
Client interface with the single `route()` method, so OSRM can be dropped in.
Leg lifecycle: inserting a stop splits and re-routes both halves, deleting one
merges and re-routes. Non-car legs are never routed.

---

## Phase 4 — Desktop shell

**4.1 Three-pane layout** · Standard · ✅ `f4145de`
BUILD §9. Day rail, continuous-scroll timeline with day headers, right pane
split into map and inspector. Breakpoints at 1280 and 900.

**4.2 Timeline rows** · Standard · ✅ `51c5769`
Stop and leg rows. Muted computed times, full-contrast anchors with a pin.
Block indicator icons. Inline editing of title, dwell, anchor, surface and
buffer, all recomputing through the cascade engine live.

**4.3 Drag and drop** · Standard · ✅ `c5cd6c6`
Reorder within a day, drag across day headers, drag a wishlist POI onto a slot.
Every drop triggers leg re-routing.

**4.4 Keyboard** · Cheap · ✅ `1000459`
The shortcut set from BUILD §9, plus multi-select and bulk time shift.

---

## Phase 5 — Map

**5.1 Sprite build** · Cheap · ✅ `514d410`
Build script rasterising the Maki and Temaki subset for the taxonomy into a
MapLibre spritesheet. Fails the build if any enum member lacks an icon.

**5.2 Leg layers** · **Heavy** · ✅ `cc5e5ea`
BUILD §5. OKLCH shade derivation per day hue, alternating by leg index, two
line layers crossfading on opacity between z8 and z10, direction arrows,
dashed overlay for after-dusk legs.

Heavy because the zoom-dependent styling has several ways to look almost right
— colour interpolation muddying, both layers visible at once, arrows fighting
the crossfade — and each is tedious to unpick later.

**5.3 Marker tiers** · **Heavy** · ✅ `8a7653f`
Three zoom tiers, symbol layer with `map.addImage`, offscreen-canvas compositing
of crop, ring and badge, IndexedDB cache keyed by file hash, collision via
`symbol-sort-key`. Not DOM markers — see BUILD §5 for why.

**5.4 Map interaction** · Standard · ✅ `f0478c4`
Hover linking both directions, click to select, fit to day bounds, the
auto/icons/thumbnails control.

---

## Phase 6 — Capture

**6.1 Search and map click** · Standard · ✅ `4e18a79`
Photon typeahead behind `⌘K`; reverse geocode on map click. OSM tags mapped to
kind via the phase 0 table, `kind_confirmed` false.

**6.2 Paste sniffer** · Standard · ✅ `36971fa`
Google Maps URLs, Komoot URLs, addresses, decimal and DMS coordinates. Short-
link resolution in a hook. Original URL kept as a link block. Well covered by
unit tests — one fixture per input shape.

**6.3 Placement ranking** · Standard · ✅ `677ebf1`
Route the candidate into every gap in the day, rank by added minutes, present
as a list. Uses cached ORS calls.

Ranks across every day in the trip, not just the focused one — BUILD §6's own
example ("new stop on day 2 +9 min") mixes gaps from different days, so a
single day's scope would have undersold the feature.

**6.4 Wishlist, share target, nearby** · Standard · ✅ `98f53ef`
Wishlist CRUD and promotion to stop. `share_target` in the manifest. Overpass
corridor query with adjustable radius, results as ghost pins.

Promotion reuses 6.3's PlacementPicker rather than a bespoke insert — a
wishlist item is just a capture that already has a name/coordinates. Nearby
is scoped to `tourism`/`historic`/a curated `natural` subset (not unfiltered
tags — too noisy) and excludes anything within 100m of an existing stop.
`share_target` uses no router: App.tsx reads `/share-target`'s query params
once on mount (no `/trip/:id` URLs exist anywhere else in the app either, so
adding one just for this single path wasn't worth it) and hands the guess to
TripEditor.

**6.5 Merge prompt** · Cheap · ✅ `ad266d4`
Detect a stop within 100 m on create and offer merge instead of duplicate.

Every capture path funnels through one `beginCapture()` in TripEditor, so
this one check covers search, paste, map click, wishlist promotion and
nearby ghost pins alike rather than needing a check per path.

---

## Phase 7 — Blocks

**7.1 Inspector and block editor** · Standard · ✅
Note, link, photo and file blocks with the three-level visibility selector.
Reorder. Markdown rendering for notes. (Photo blocks reference a URL for now;
upload/thumbs/EXIF/attribution is 7.2. Safe in-house Markdown subset in
`src/lib/markdown.ts`, no new dependency.)

**7.2 Photo pipeline** · Standard
Upload, PocketBase thumbs, EXIF extraction into `lat`, `lon`, `taken_at`.
Wikimedia lookup via the OSM `wikidata` tag, storing author, licence and source
URL. Attribution rendered wherever the image appears.

**7.3 Kind picker and review screen** · Cheap
Icon grid with type-to-filter. Uncategorized counter in the trip header opening
a list of just those stops with the grid inline.

---

## Phase 8 — Import

**8.1 Zod schema and prompt template** · Standard
BUILD §8. Enum-constrained kinds, optional coordinates, `HH:MM` times, day
indices. The prompt template shipped on the import screen. Export writes the
same format — round-trip test.
(A separate, lighter schema for the Highlights goal — a flat list of POIs,
no days — shipped as `src/lib/import-highlights.ts` `4adb15d`, with its
importer + dialog as `8d11bd7`. This full multi-day §8 schema, and its
wizard below, are still open.)

**Highlights follow-up: wishlist on the map** · Cheap · ✅ `811f909`
Wishlist `pois` now pass through to `MapPane` as their own pin layer (Nearby
ghost-pin circle styling, dark stroke instead of white, always shown — not
toggle-gated). Click opens the existing placement flow.

**Highlights follow-up: visual review** · Standard · ✅ `ec3fac3`
Thumbnail per wishlist row; a `WishlistPreview` card (photo carousel,
attribution, Markdown description, links) opens from the row or a map-pin
click, with Place/Reject moved there — a look now always comes before a
commit.

**8.2 Wizard** · Standard
Paste → validate with readable per-field errors → geocode with map confirmation
and ambiguity flags → route → cascade preview with warnings and uncategorized
count → commit. Cancellable at every step, atomic on commit.

---

## Phase 9 — Share and print

**9.1 Share endpoint** · Standard
`pb_hooks/share.js` assembling the public payload server-side. No collection
rules involved. Token regeneration and an enable toggle.

**9.2 Share view** · Standard
Read-only, unauthenticated, same cascade output, public blocks only.

**9.3 Print stylesheet** · Standard
One page per day, MapLibre canvas to PNG per day, attribution block, private-
block checkbox forced off in the share context.

---

## Phase 10 — Mobile and offline

**10.1 Today view** · Standard
Opens on the current date during trip dates. Swipe between days. Large touch
targets. Deep links out to Google Maps and Komoot.

**10.2 Permitted mobile edits** · Standard
Dwell adjustment, reorder the next two stops, add photo or note, open a
booking. Nothing structural.

**10.3 PWA and offline read** · Standard
Manifest, icons, service worker for the shell, `persistQueryClient` to
IndexedDB. Verify a full day renders with the network disabled.

---

## Phase 11 — Remaining surfaces

**11.1 Budget** · Cheap
Cost entry on stops and days, totals per day and per trip, estimate flag,
category breakdown.

**11.2 Trip settings** · Cheap
Buffer percentage, surface multipliers, default dwells per kind, timezone,
currency, members, share token.

**11.3 Deploy** · Standard
Coolify config, volume, backup note, committed migrations, smoke test against
the deployed instance.
Pulled ahead for an alpha (2026-08-31), repo side only — `c51ef93`:
Dockerfile/docker-compose.yml build-time env var fix (TILE_URL etc. weren't
reaching the SPA bundle at all), admin bootstrap entrypoint, healthcheck.
Not run live — no Docker daemon in this environment to test a real build,
and the actual Coolify resource/domain/env-var setup is a manual step only
the author can do. Still open: first live build+deploy, smoke test against
it, backup note.

---

## Noticed

Append anything found along the way that is worth doing but is not in the
current task. Do not act on it in the same commit.

- Stop deletion (row ✕ and the Delete key) has **no confirmation** — added
  unconfirmed for fast test cleanup. Add a confirm (or undo) before v1.
- Bundle is large (MapLibre); consider code-splitting the map.
- The route hook still can't tell the client "routing genuinely failed" apart
  from "no road nearby" (both 200 `routable:false`). Low priority now that
  access points give a workaround, but worth a distinct error surface later.
- Placement ranking (6.3) routes every gap's candidate segments in parallel
  via `Promise.all`, but none of those calls can hit `route_cache` on a
  first capture — the candidate's coordinates are new every time. A large
  trip (many days × many stops) could feel slow the first time a candidate
  is placed. Progressive/streamed results (rank and show each gap as it
  resolves, instead of waiting for the whole batch) would fix the perceived
  latency if it's a problem in practice; not done since it's unclear it will
  be, given typical trip sizes.
- `.env.example`'s `TILE_URL`/`PHOTON_URL`/`OVERPASS_URL` (bare names) don't
  actually reach the client: the code reads `import.meta.env.VITE_TILE_URL`
  etc., and Vite only exposes `VITE_`-prefixed vars — there's no
  `envPrefix`/`define` remap in `vite.config.ts`. So a custom `.env` value for
  any of these three is silently ignored today; the app always falls back to
  the hardcoded defaults. Pre-existing, not introduced by 6.4's `overpass.ts`
  (which just matches the existing — broken — convention for consistency).
  Fix is either renaming the `.env.example` keys to `VITE_`-prefixed or adding
  the remap; the former needs the user to update their real `.env` too, so
  didn't do it unprompted.
- `public/manifest.json` has no `icons` — valid without them, but "add to
  home screen" polish and full PWA installability (phase 10.3) will want
  some. No app icon assets exist anywhere in the repo yet.
- Wishlist items are placed one at a time via the picker; BUILD §9 also
  describes dragging a wishlist item directly onto the timeline. Not built —
  click-to-place via the ranked picker covers the same need and works across
  days, which a single timeline drop target wouldn't.
- Nearby ghost pins got category colours and Wikimedia photo thumbnails
  (user request, following up on 6.4) — see the commit adding `categoryColor`
  and `wikimedia.ts`. Deliberately scoped to Nearby only: no attribution is
  stored, and nothing carries over when a ghost pin is promoted to a stop.
  Real itinerary stops showing photos is still phase 7.2 (Photo pipeline),
  unbuilt — the `auto/icons/thumbnails` map control has been sitting ready
  for it since phase 5.3.