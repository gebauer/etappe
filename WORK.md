# WORK.md — Etappe build order

Ordered tasks. Do them in sequence; each phase assumes the previous one is
merged and `npm run check` passes. Specification is in `BUILD.md`, rules in
`CLAUDE.md`.

## Status — updated 2026-09-02

**Phase 6 complete; phase 7 complete (7.1, 7.2, 7.3); Highlights import
(schema + importer) done; both Highlights follow-ups (wishlist-on-map,
visual review) done.**
Capture, ranked placement, wishlist, nearby, share target, merge-on-capture,
the inspector block editor (note/link/photo, visibility, reorder, Markdown
notes, upload with EXIF extraction, PocketBase thumbs, Wikimedia attribution),
the icon-grid kind picker + uncategorized review, and Highlights import —
paste JSON → validate → preview → commit to the wishlist as `pois` (status
`idea`) + note/link/photo blocks — all in. Wishlist `pois` render on
`MapPane` as their own pin layer and open the unified `PinCard` (WORK 12.2,
which replaced `WishlistPreview`) before Add to itinerary/Reject.
See the task entries below for each phase-7 piece, and the spec deviation
note above (Wikimedia lookup runs off Nearby/Overpass, not Photon — the
live Photon instance never returns a `wikidata` tag).
**→ Next, in order (at the time):** the map-first redesign was picked
over 8.2, the full multi-day §8 import wizard, which was deferred — see
Phase 12 below. `design_handoff_map_first_planner/README.md` is the
pixel-accurate spec; it formalizes and supersedes `ToDo.md`'s "Design
direction" notes.
**8.1 and 8.2 done, 2026-09-02** (a narrower wizard than originally
specced — see 8.2's own entry for what's built versus deferred), once
Phase 12 and 16 were both clear.
**Phase 12 (map-first redesign) is done — every task, 12.1 through 12.11.**
The desktop shell: design tokens, unified pin-click card, expanded
full-details card, pin visuals, day pills/Fit trip, the map-dominant shell
itself, the access-point picking mode (12.9) and the wishlist "photo
wheel" (12.10). 12.7 (phone layout, 2026-09-02) closed the phase: the
shell reflows below 860px, the docked card becomes a compact bottom sheet,
and the header's Search/Import/Share/Export group — the thing actually
overflowing the phone viewport — hides below the breakpoint. 12.11
(cleanup) found nothing to remove and closed the two open doc items.
The handoff was revised 2026-09-01 (`design_handoff_map_first_planner`,
in place — the old copy is superseded) with two new surfaces: a built
wishlist carousel and a proper access-point picking mode — 12.10 and 12.9,
done then; 12.7/12.11 finished the phase a day later.
**Phase 13 (day-start continuity — a day leaves from the previous day's
accommodation via a routed leading leg) is done: 13.1 schema+cascade, 13.2
leg lifecycle+routing, 13.3 rendering+editor.**
**Phase 14 (unify wishlist ideas and stops — a poi is "a stop without a
day") is done: 14.1 schema+data layer (this is where the lossless-
promotion bug fix landed), 14.2 downgrade+stop-card actions, 14.3 starred
stops+wishlist delete confirm.**
**Phase 15 (wishlist contributor attribution) queued — from a 2026-09-01
handoff revision that adds a per-user colour and a contributor mark on
every wishlist entry (itinerary stops carry none).**
**Phase 16 (planning ergonomics, portability, sharing) — a 2026-09-01
author request, all seven original tasks (16.1–16.7) done. 16.6 subsumes
9.1/9.2 and phase 11.2's "members", with one gap noted under 16.6 itself
(no read-only editor mode for a `viewer` member — the server rule already
protects them, the UI doesn't yet reflect it). 16.7 is the entry surface
phase 11.1 needs. 16.8 (skip on wishlist-import dedup) and 16.9 (a routing
kind that forces a leg through a stop with no dwell) added 2026-09-02 and
done. 16.10 (2026-09-02) reworked the budget entirely per a new design
handoff revision — one estimated cost per stop with its own currency,
converted to the trip currency via a cached ~monthly rate, bucketed by the
stop's kind (`rental` is a new kind) into a header popover — superseding
16.7's list-of-costs UI, though the backend keeps its multi-item shape.**
**Phase 17 (2026-09-02) opened from a further handoff revision — the
"Day dock" and four smaller changes, all confirmed by the author in one
go ("Merge 7 and build everything"), plus a sixth surface (trip overview)
from a later revision `design_handoff_map_first_planner(9)/`. All six
(17.1–17.6) built and pushed 2026-09-02: day dock, phone day-detail
collapse, phone wishlist-carousel reachability (an explicit reversal of
12.7's "no wishlist on phone"), daylight wording split by dawn/dusk, cost
marks on itinerary rows, and Fit trip → trip overview. See each entry
below.**
**Phase 15 (wishlist contributor attribution) also done 2026-09-02 —
15.1 (schema + per-user colour, snapshotted onto each poi) and 15.2 (the
chip + two pills on the panel, carousel and docked card).**
**→ Next: nothing queued. `design_handoff_map_first_planner(9)/` is fully
absorbed; `ToDo.md` may have loose ends worth a pass.**
The Blocks section
of the expanded card reuses `BlockEditor` as-is (light-themed) rather than
restyling it — out of this bundle's scope, and a visible mismatch inside
the dark modal worth knowing about. 12.4 retired BUILD §5.3's kind-icon/
zoom-tier marker system entirely rather than restyling it — see that
task's entry for why. 12.5 found a real Tailwind bug (opacity modifiers on
custom oklch tokens silently no-op) — see that task's entry; every
component from here on must bake alpha into arbitrary values, never use
`/opacity` on a named token.

Done, with commit: 0.1 `48acf84` · 0.2 `d210535` · 0.3 `52db0c9` ·
dev-server `559a6da` · 1.1 `1679ad5` · 1.2 `f480b33` · 1.3 `f39cc3e` ·
v0.1.0 bump `1872737` · 2.1 `0958663` · 2.3 `a417bc3` · 2.2 `656449b` · 3.1 `b6336e6` · 3.2 `3e2ce85` · 4.1 `f4145de` · 4.2 `51c5769` (checked #2) · 4.3 `c5cd6c6` · 4.4 `1000459` · 5.1 `514d410` · 5.2 `cc5e5ea` · 5.3 `8a7653f` · 5.4 `f0478c4` · 6.1 `4e18a79` · 6.2 `36971fa` · 6.3 `677ebf1` · 6.4 `98f53ef` (map-markers split `2d02145`) · 6.5 `ad266d4` ·
7.1 `d4ae836` · poi-blocks migration `a7a6d27` · Highlights schema `4adb15d` ·
Highlights importer `8d11bd7` · Highlights prompt lat/lon `ea1f1ce` ·
wishlist-on-map `811f909` · wishlist visual review `ec3fac3` ·
7.2 photo pipeline `4f4b91a` · 7.3 kind picker `1d6b85c` ·
12.1 `3808a09` · handoff revision `b2c85f5` · 12.2 `45baac0` ·
12.3 `6fc93bd` · chromium/node fix `529b1ac` · README `f90d27c` ·
12.4 `ffb75da` · whole-trip-pill note `f5345c9` · 12.5 `86f8133` ·
reload skill `6e0ad19` · 12.6 `f7426a6` · fit-trip+wishlist `8015966` ·
fly-to-idea `909848c` · centre-pans `a7fc6ff` · 12.8 `4e659c5` ·
handoff revision `28b1fd6` · 12.9 `e1a960f`.
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
- Node ≥18.18 (`package.json` `engines`) via nvm — the default `node` varies
  across the author's several dev machines (one defaults to an older system
  node; others have only nvm, already fine). Use `--lts`, not a pinned
  version — `nvm use 20` fails outright on a machine that never installed
  exactly that version. In non-interactive shells prefix with:
  `export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"; nvm use --lts >/dev/null`
- Backend: `npm run pb` (PocketBase 0.40.1 binary in `./bin`; fetch with
  `npm run pb:setup`). Frontend: `npm run dev` (Vite proxies `/api` + `/_`).
- After any schema migration: `npm run types:pb` regenerates `src/types/pb.ts`
  (fetches `pocketbase-typegen` on demand via `npx`; it is not a dependency —
  its `better-sqlite3` sub-dep has no musl prebuilt and broke the Docker build).
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
BUILD §5 says the Wikimedia photo lookup triggers off a `wikidata` tag
"returned by Photon" — the live Photon instance (photon.komoot.io) never
actually returns one for any query tried (Gullfoss, Eiffel Tower, Statue of
Liberty — spot-checked directly against the API). Only Overpass carries the
tag (already used by Nearby, WORK 6.4), so 7.2's Wikimedia attribution is
wired to the Nearby capture path instead of Photon search/paste/map-click.

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
**Retired by 12.4** (2026-09-01): the redesign's stop pin is a plain
day-scoped numbered circle, not a zoom-tiered kind-icon pin, so the tier
system, the accommodation/other layer split and the auto/icons/thumbnails
control described here no longer exist. `map.addImage`/offscreen-canvas
compositing and "not DOM markers" both still hold — see 12.4's entry.

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

**7.2 Photo pipeline** · Standard · ✅ `4f4b91a`
Upload (`BlockEditor`'s photo/file blocks), PocketBase thumbs (migration
`1788000006`: `80x80`/`640x0` on `blocks.file`), EXIF extraction into `lat`,
`lon`, `taken_at` (hand-rolled reader, `src/lib/exif.ts` — no new dependency,
same call as `markdown.ts`). Wikimedia lookup storing author, licence and
source URL — wired to Nearby's capture path, not Photon; see spec deviations
below. Attribution renders in `BlockEditor` and `WishlistPreview`.

**7.3 Kind picker and review screen** · Cheap · ✅ `1d6b85c`
Icon grid with type-to-filter (`KindPicker`/`KindIcon`, sprite-atlas reuse —
no new icon assets). Trip header's uncategorized counter opens a drawer
listing just those stops with the grid already expanded per row.

---

## Phase 8 — Import

**8.1 Zod schema and prompt template** · Standard · ✅
BUILD §8. Enum-constrained kinds, optional coordinates, `HH:MM` times, day
indices. The prompt template shipped on the import screen. Export writes the
same format — round-trip test.
The full-format Zod schema and the export half landed with WORK 16.3
(`import-trip-doc.ts`, `export-trip.ts`); the prompt template
(`src/lib/import-trip-prompt.ts`, `TRIP_PROMPT_TEMPLATE`) and the import
screen that offers it landed with 8.2 below, 2026-09-02 — closing this out.
(A separate, lighter schema for the Highlights goal — a flat list of POIs,
no days — shipped as `src/lib/import-highlights.ts` `4adb15d`, with its
importer + dialog as `8d11bd7`. Still its own thing, not superseded by 8.2:
a Highlights import only ever adds to a wishlist, never creates a trip.)

**Highlights follow-up: wishlist on the map** · Cheap · ✅ `811f909`
Wishlist `pois` now pass through to `MapPane` as their own pin layer (Nearby
ghost-pin circle styling, dark stroke instead of white, always shown — not
toggle-gated). Click opens the existing placement flow.

**Highlights follow-up: visual review** · Standard · ✅ `ec3fac3`
Thumbnail per wishlist row; a `WishlistPreview` card (photo carousel,
attribution, Markdown description, links) opens from the row or a map-pin
click, with Place/Reject moved there — a look now always comes before a
commit.

**8.2 Wizard** · Standard · ✅ (narrower than specced — see below)
Paste → validate with readable per-field errors → geocode with map confirmation
and ambiguity flags → route → cascade preview with warnings and uncategorized
count → commit. Cancellable at every step, atomic on commit.

**Built as:** `ImportTripDialog.tsx` (paste → validate → preview → commit),
reached from `TripList`'s new "Import a trip" button — a full trip
document creates a **new** trip, unlike Highlights, which only ever adds to
an already-open one's wishlist. `import-trip-commit.ts`'s
`commitTripImport` does the actual creation: sequential
`pb.collection(...).create()` calls (trip, then each day, then its stops
with activities/notes/links, then that day's legs), not one PocketBase
batch — a leg needs the *created* id of the stop it connects, which a
single batch call can't hand back before it resolves. `importHighlights`
(8.1) already made the same trade for the same reason; this follows it
rather than reaching for batch cross-referencing for the first time here.
Legs reuse `buildLegRecord` (`pb-legs.ts`) unchanged — the same routing/
manual-fallback logic every other leg in the app already goes through, not
a parallel importer-only path.
**Narrower than the original three-line spec, on purpose:**
- **No map-confirmation geocoding UI.** A `place_hint` resolves to
  Photon's first match silently — the same simplification 8.1's own
  Highlights importer already made, for the same reason (building real
  ambiguity UI is its own map-facing feature). Verified live against the
  canonical fixture: Keflavík/Gullfoss geocoded correctly, but "Skálholt,
  Iceland" alone resolved to a wrong point ~150km north of the real one —
  Photon returned *a* match, so nothing flagged it, and the resulting leg
  correctly fell back to manual (no road found) rather than routing
  somewhere absurd. This is the risk the deferred map-confirmation work
  exists to catch; a stop that comes out unlocated *or* wrongly located is
  fixable by hand afterward via the Latitude/Longitude fields already in
  All details — no new repair UI needed, the capability already existed.
- **Cancellable at every *step*, not mid-commit.** Paste/preview/failure
  states can all back out or retry freely; once "Create trip" is clicked,
  it runs to completion or failure, it can't be cancelled partway. On
  failure the partially-created trip is deleted (`abandonTripImport`) —
  everything under a trip `cascade: true`s away with it (migration
  `1788000000`) — so a failed import leaves nothing behind rather than a
  half-built trip sitting in the list, without needing real batch
  atomicity to get there.
- Cascade preview (showing computed times/warnings *before* committing) is
  not built — the preview step shows counts (days, stops, car legs to be
  routed, stops needing geocoding, stops with no location at all,
  uncategorized count) but not a live cascade run, since that would need
  routing to happen twice (once to preview, once for real) for a
  meaningful preview. The uncategorized count folds into the app's
  existing review banner once the trip is open, rather than a separate
  wizard-only view of it.
Bug found and fixed while building this: `export-trip.ts`'s `notesFrom`
joined *every* note block regardless of visibility, so a private "My
notes" remark (WORK 16.5) rode along in an exported document meant to be
handed to someone else. Private notes are excluded now; a regression test
covers it. Also found: `import-trip-doc.ts`'s leg-mode enum was missing
`bike`, silently rejecting a valid `CascadeLeg['mode']`/`ImportLeg.mode` —
fixed, with a test asserting every mode the cascade engine understands
parses.
`resolvePlaceHint` (`src/lib/geocode.ts`) is the geocode-on-import step,
extracted out of `import-highlights-commit.ts` so both importers share one
answer to "what does resolving a place mean" rather than two that could
drift.
Verified end to end against `fixtures/iceland-day1.json` in a real
browser: import → real Photon geocode → real ORS routing (one leg routed,
one manual) → the resulting trip's cascade computes an `AFTER_DARK`
warning and a dwell derived from the imported activity, both matching what
the editor would compute for the same data entered by hand → exported back
out at the current version → the exported document's stops are intact.

---

## Phase 9 — Share and print

**9.1 Share endpoint** · Standard · ✅
`pb_hooks/share.js` assembling the public payload server-side. No collection
rules involved. Token regeneration and an enable toggle.
Built as `pb_hooks/share.pb.js`, as part of WORK 16.6 rather than reached
in phase order — see that task for the detail.

**9.2 Share view** · Standard · ✅
Read-only, unauthenticated, same cascade output, public blocks only.
Built as `src/components/ShareView.tsx` + `src/lib/share-doc.ts`, as part
of WORK 16.6.

**9.3 Print stylesheet** · Standard · ✅ (2026-09-03)
One page per day, a client-rendered map per day, note/link/photo blocks
with Commons attribution, a private-note toggle. No server PDF — the
browser's own print, per BUILD §10.
- `PrintView.tsx`, opened from a **Print** button in the header, portalled
  to `<body>` so the print stylesheet hides the live app with one
  `body.printing > *:not(.print-portal)` rule. Deliberately **light** —
  print is paper; a dark background wastes ink — which is the one place
  in the app that isn't the dark palette, on purpose.
- `lib/print-map.ts` renders the per-day maps: one reused **offscreen**
  MapLibre instance (`preserveDrawingBuffer: true`), days done **one at a
  time**, fit to that day's stops + start point + routed leg geometries
  (a straight connector where a leg has no route), waiting on `idle` +
  a short settle before `getCanvas().toDataURL()`. Fourteen live WebGL
  contexts would risk the browser cap; one instance with two swapped
  sources doesn't. The Print button stays disabled until every map is in.
- `TILE_URL` moved to `lib/map-config.ts` so the live map and the
  snapshot map share it (and a self-hosted `VITE_TILE_URL` reaches both).
  `asLineString` exported from `map-features.ts` for reuse.
- **Private blocks:** `allowPrivate` prop — `true` from the editor (with a
  checkbox, default on), and the checkbox simply isn't rendered without
  it, so the share context can never include them.
- **ShareView** gets a lighter print treatment inline (`@media print`:
  invert the dark shell to paper, `break-before: page` per day). No
  per-day maps there — the full map print view is the editor's; a public
  reader gets the clean itinerary. Noted as a deliberate narrowing.
- Verified: `.claude/skills/run-etappe/print-check.mjs` imports a 2-day
  trip, opens Print, waits for "Maps ready", and asserts two `<img>` maps
  each a >3 KB PNG data URL plus one section per day and a trip note
  present. No console errors (headless Chromium with swiftshader GL).
- Commit: `phase 9.3: print view — one page per day`.

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

**11.2 Trip settings** · Cheap · ✅ (2026-09-03)
Buffer percentage, surface multipliers, default dwells per kind, timezone,
currency. (Members and the share token were already the `SharePanel` from
WORK 16.6 — not rebuilt here.) Every one of these was frozen at trip
creation with no route to change it short of the PocketBase admin UI, and
all of them feed the cascade: the buffer and multipliers scale every car
leg, the default dwells time every stop with no override, the timezone
drives the daylight maths.
- `updateTripSettings(tripId, patch)` in `pb-trips.ts` — one `trips`
  update, editor+ by the same rule as everything else on the doc.
- `SettingsPanel.tsx`, opened from a new `⚙` button in the header's
  desktop action group. A **local draft with one Save**, not a write per
  keystroke — several numeric fields, and a half-typed multiplier
  shouldn't re-run the cascade. `run()` reloads the trip on save, so the
  cascade recomputes.
- Validation gates Save: buffer 0–200 finite, each multiplier > 0,
  each dwell ≥ 0, and the timezone must pass `new Intl.DateTimeFormat`.
  Timezone is a free text field with a `<datalist>` of ~12 common zones.
- The 26 per-kind dwells sit in a collapsed `▸ Default dwell per kind`
  section with a Reset (to `defaultDwellSeed()`), so they don't dominate
  the panel.
- Verified: `.claude/skills/run-etappe/settings-check.mjs` — currency,
  buffer, a multiplier and the timezone all round-trip through
  save/reopen; Save is blocked on an invalid timezone. No console errors.
- Commit: `phase 11.2: trip settings panel`.

**11.3 Deploy** · Standard · ✅
Coolify config, volume, backup note, committed migrations, smoke test against
the deployed instance.
Pulled ahead for an alpha (2026-08-31), repo side only — `c51ef93`:
Dockerfile/docker-compose.yml build-time env var fix (TILE_URL etc. weren't
reaching the SPA bundle at all), admin bootstrap entrypoint, healthcheck.
Not run live from this environment (no Docker daemon here to test a real
build, and the actual Coolify resource/domain/env-var setup is a manual
step only the author can do) — but the author confirms (2026-09-02) the
live deployment is up and working, closing out the manual half of this
task.

---

## Phase 12 — Map-first redesign

Source: `design_handoff_map_first_planner/README.md` (+ `Etappe
Redesign.dc.html`, a design-reference prototype, not production code —
translate its inline styles into Tailwind, don't port them). Formalizes and
supersedes `ToDo.md`'s "Design direction" notes with a pixel-accurate spec.
Replaces the day rail / timeline / boxed-map-and-inspector 3-pane grid with
a map-dominant layout: map fills the screen, day pills dock over it, the
itinerary becomes a right column, and a progressive "unified pin-click
card" replaces the technical `StopInspector` form and the modal
`WishlistPreview`. The card has three tiers of depth, not two: the docked
card is read-only (the everyday surface), an inline edit region expands in
place for the fields adjusted constantly while planning, and an expanded
full-details modal (`All details`) holds the rest — so no inspector field
is dropped, they just stratify by how often they're touched. Dark theme
only; the photo-wheel filmstrip and light theme are explicitly out of scope
for this bundle. Does not touch the cascade engine, data model, routing or
geocoding.

**12.1 Design tokens and fonts** · Cheap · ✅
Tailwind theme tokens (oklch palette from the handoff's token table, kept
as oklch rather than converted to hex), self-hosted Instrument Sans
(400/500/600) and IBM Plex Mono (400/500) via `@fontsource/instrument-sans`
+ `@fontsource/ibm-plex-mono` (replaces hotlinking Google Fonts — the
handoff requires self-hosting for the Coolify container), a custom `desktop:
860px` Tailwind breakpoint. Infrastructure only — nothing consumes the new
tokens yet, so no component changed visually.

**12.2 Unified pin-click card** · Heavy · ✅
New component generalizing `WishlistPreview` to three modes (existing stop
pin / wishlist pin / empty map click) per the handoff's card spec: photo
header, prev/next nav + counter (sequence order for stops, cached
proximity-chain order for wishlist), computed-times strip and daylight line
(cascade engine output, rendered never computed), description, a
progressive edit region revealed by an Edit action, and a context-dependent
action bar (`Edit`/`All details`/`Remove` · `Add to itinerary`/`Reject` ·
`+ Wishlist`/`+ Day`/`Dismiss`). Replaces `WishlistPreview`'s usage in
`TripEditor`; changes `onMapClick`'s current immediate
reverse-geocode-then-placement flow to open the card first, placement only
on an explicit action. `Remove` gains the delete confirmation the "Noticed"
list has been asking for — the handoff calls for it explicitly.
Transitional, until 12.5 flips the layout: the card docks fixed bottom-left
of the viewport (12.5 only re-parents it into the map wrapper), and
`StopInspector` stays where it is, so the two briefly overlap.

**12.3 Expanded card — full inspector parity** · Standard · ✅
The revised handoff's answer to "where do the inspector's remaining fields
go": a third tier of depth, not two. A centered two-pane modal (photo
carousel left at `flex:0 0 46%`, header/body/action bar right), opened with
`All details` from a stop card and closed by `Done`, `✕` or selecting
another pin. Nothing from `StopInspector` is dropped — the fields stratify
by how often they're touched: the accommodation toggle gets its own amber
panel at the top of the pane (same colour family as the itinerary column's
NO_ACCOMMODATION banner, so cause and warning read as one thing, and
toggling re-runs the cascade live), then a Place group (title, address,
lat/lon in mono, access point) and a Timing group (kind, dwell, anchor),
then Blocks. Lat/lon are an editable correction path, not display-only —
editing either moves the marker and re-routes the adjacent legs, and
dragging the marker writes back. Adds `expanded: boolean` to the card's UI
state. Not offered on phone (the strip's inline form covers the planning
fields; accommodation/address/coords are desktop-set values).

**12.4 Pin visuals** · Standard · ✅
Turned out bigger than "restyle": the handoff's stop pin is a plain numbered
circle (26px unselected / 34px + halo selected), not the existing kind-icon
teardrop pin sized/recoloured — BUILD §5.3's zoom-tiered marker system
(three density tiers, the accommodation/other layer split, the
auto/icons/thumbnails control) is retired, not adapted, since identity now
lives in the card (12.2) and the pin only needs to show sequence order.
Text labels on stop pins are also removed (not explicitly specced either
way — the call made here is that they're superseded by the itinerary
column's own sequence numbers, WORK 12.6, once it exists). Numbers are
day-scoped per the handoff's "Day switching" line ("swaps ... the map's
numbered pins to that day") — `MapPane` filters the `stops` layer to
`focusDayId`, falling back to the trip's first day when nothing is
explicitly focused yet (day pills/default-day-selection is 12.5/12.6, not
built), so the map isn't empty on first load. Wishlist pins become square
rounded photo thumbnails with an amber border and a category-colour
fallback fill when no cover photo exists yet — composited per item
(`compositeWishlistPin`, `map-markers.ts`), upgraded from fallback to real
photo via `updateImage` once the cover loads from `records.blocks`, not
Wikidata like Nearby's ghost pins. Selected variants (bigger badge/pin,
brighter border, halo) render via a second GL layer filtered to the
selected id, mirroring the existing selected-stop-exclusion technique;
wishlist selection is a new `selectedWishlistId` prop threaded
TripEditor → RightPane → MapPane. Verified in a real browser: two stops on
one day both render and number correctly, a second day's stop is invisible
while day 1 is focused and vice versa, and the wishlist pin's fallback/
selected states both composite correctly (screenshots taken, not
committed). Touches `map-markers.ts`, `map-features.ts`, `MapPane.tsx`,
`RightPane.tsx`, `TripEditor.tsx`; `map-features.test.ts` rewritten for the
new stop/wishlist feature shape.

**12.5 Day pills and Fit trip** · Standard · ✅
New `DayPills.tsx`, rendered by `MapPane` as an absolute top-left overlay
(days/stops come from `records`, already a `MapPane` prop) — takes over
`DayRail`'s day-switching role; `DayRail` stays too, transitionally, both
driving the same `selectedDayId` (new `onSelectDay`/`onAddDay` props,
TripEditor → RightPane → MapPane). "Fit trip" turned out not to need the
planned re-triggerable prop mirroring `flyTo` — the button lives inside
`MapPane` itself (rendered by `DayPills`, handled in `MapPane`) since that's
where the map instance already is, so it just calls `fitBounds` directly;
`maybeFit`'s one-shot guard (`fittedRef`) is untouched, this is a second,
unguarded fit path for the explicit action. The existing dev-only Nearby
toggle got pushed down to clear the new pill row — unaddressed by the
handoff, no design decision needed, just repositioning.

Found and fixed a real bug surfaced by this task, not particular to it:
Tailwind's `bg-token/[0.88]` opacity-modifier syntax silently generates no
CSS rule at all for a custom color whose theme value is a plain `oklch()`
string (confirmed via the compiled stylesheet — only the opacity-less base
class existed), rendering fully transparent instead of translucent.
`text-warn-text/80` in 12.3's expanded card had the same bug (full opacity
instead of 80%, low-visible enough that the screenshot review at the time
missed it). Fixed both by baking the alpha directly into an arbitrary
value (`bg-[oklch(0.20_0.013_250/0.88)]`) instead of using the modifier on
a named token — swept the rest of the redesign components for the same
pattern, found no other instances. Worth remembering for every task after
this one: never use Tailwind's `/opacity` modifier on these custom oklch
tokens, only baked-in arbitrary values.

**12.6 Map-dominant shell and itinerary column restyle** · Heavy · ✅
`TripEditor`'s resizable 3-pane grid is gone: dark 52px header (avatar, so
the email never renders as text at any width), map filling the left with
day pills / wishlist fallback list / card docked over it, 400px itinerary
column on the right. `DayRail`, `RightPane` and `StopInspector` are
deleted. Verified in a browser that a layout rewrite didn't cost the
behaviours riding on it: row selection opens the card, `n` adds a stop,
`Delete` removes one, and drag-reorder within a day still reorders (and
renumbers both the column and the map pins).

Deviations and losses, all deliberate:
- **The column shows the focused day only**, not every day stacked — the
  handoff's header is a single day's and the day pills "swap the itinerary
  column". That costs **cross-day drag-and-drop** (no second day on screen
  to drop onto); the expanded card's "Move to day…" (12.3) is the
  replacement, and within-day reordering still drags.
- **`StopRow` is display-only.** Title/dwell/anchor/type/accommodation were
  inline-editable there; they're all in the card now (12.2/12.3). The row's
  delete ✕ is gone too — `Remove` on the card carries the confirmation the
  ✕ never had, which closes that "Noticed" item for this path.
- **`LegRow` keeps leg editing behind a click.** The handoff gives manual
  duration / surface / buffer / re-route no home at all (the card is
  stop-only), so rather than drop working capability the collapsed row
  matches the spec and clicking it reveals the controls.
- **`Drawer` was *not* retired** as this task's original text assumed —
  `UncategorizedReview` still uses it.
- **`flyTo` removed.** Its only trigger was the inspector's zoom button,
  which retired with the inspector; `MapPane` still accepts the prop.
- **Warning banners are day-level only.** Stop-level warnings render as a
  compact amber line instead — one banner per stop drowned the column (three
  stops with no kind yet is three identical banners). The handoff's banner
  example (NO_ACCOMMODATION) is itself a day-level warning.
- **Below 860px now looks broken**, by agreement (2026-09-01) — nothing is
  deployed and only the author sees it. The phone layout is 12.7.

Follow-up (same day, author report "I don't see any wishlist markers"): not
a rendering bug — the map only ever fits to stops and legs, and on the real
`island` trip *all 25* wishlist ideas with coordinates fall outside the 3
stops' bounding box (ideas span 63.4–66.0°N, the stops sit around
Reykjavík), so every pin was simply off-screen. Fixed by **flying to an
idea when it's picked from the wishlist list** (and when the card's ‹/›
steps to one, which can land off-screen just as easily), reusing the
`flyTo` prop the retired inspector's zoom button used to drive. Clicking a
wishlist *pin* doesn't fly — it's already in view. It **pans only**: the
effect used to force a minimum zoom of 13, right for its old caller
(inspector "zoom to this stop") but wrong here — bringing an off-screen
idea into view shouldn't throw away the zoom you were working at.

"Fit trip" deliberately does **not** widen to the wishlist (tried, reverted
on author's call): fit-the-trip should mean the trip, and a country-wide
idea list would zoom straight past the days you asked to see.

**12.8 Wishlist photos stored server-side** · Standard · ✅
Author report: "wasn't the idea that the wishlist pins have tiny thumbnails
instead of differently coloured areas?" — correct, and two separate bugs
were in the way.

1. **The importer never downloaded photos**, contrary to the assumption it
   did: `import-highlights-commit.ts` stored `url: photo.url` and nothing
   else (the real `island` trip: 18 photo blocks, 0 with a file). Imported
   photos are third-party URLs, and those hosts routinely send no CORS
   header — verified, roads-and-rivers.com sends none. Without CORS the
   browser will happily *display* such an image but may neither `fetch` its
   bytes nor read them back off a canvas, and compositing a pin thumbnail
   needs exactly that. Hence photos in the list rows and card (plain
   `<img>`) but flat category colours on the pins. It can't be fixed
   client-side at all — the browser can't download those bytes either. New
   `pb_hooks/photo.pb.js` (`POST /api/photo-fetch`) fetches server-side via
   `$filesystem.fileFromURL` and stores the result as the block's `file`;
   the import loop calls it per photo. Idempotent, membership-checked, and
   a dead link reports `{fetched:false, reason}` rather than failing an
   import of thirty. Storing the bytes also buys the PocketBase `80x80`
   thumb the pin wants instead of a 300 KB JPEG, and stops the trip
   depending on someone else's webserver.
2. **A race in 12.4's own compositing effect**: it marked an item "resolved"
   *before* checking whether a photo URL existed. The wishlist and the trip
   document arrive from two separate fetches, so the effect routinely ran
   with the item present but its blocks not yet loaded — pinning it to the
   colour fallback permanently, even once the photo arrived. Now it only
   marks resolved once there's something to load.

Verified end-to-end with the author's real Highlights JSON: 4 photo blocks,
4 files stored, and the pins render actual thumbnails (Seljalandsfoss,
Skógafoss, Dyrhólaey, Jökulsárlón) with the amber border.

**Not backfilled**: the 18 already-imported photos on `island` still have
no file, so those pins stay colour-only until re-imported or a backfill is
added. `pendingPhotoBlocks()` in `src/lib/pb-photo-fetch.ts` exists for
that; wiring a "fetch missing photos" action is not built.

**12.7 Phone layout** · Standard · ✅
`<860px`: map takes `flex:0 0 58%`, itinerary column fills the rest below
it, day pills/wishlist panel/desktop card all suppressed. Compact phone
card (not the full card) with horizontal swipe navigation (>40px
threshold, same step function as the desktop card's `‹`/`›`) and a looping
chevron nudge as the discoverability cue; edit region uses 44px targets.
Drag-to-expand and a rubber-band swipe transform are explicitly not built.

**Superseded in part by 17.2 + 17.3:** the day detail now *collapses*
rather than being fixed at 42%-of-nothing (17.2), and the wishlist
carousel *does* exist on phone — reachable via an `★ Explore N places`
pill while the day detail is folded (17.3). The wishlist *panel* is still
phone-suppressed; only the carousel came back.

**Built as:** verified directly against the live prototype
(`Etappe Redesign.dc.html`, served locally and driven in a real browser at
390px) rather than only the README prose, which turned out to have drifted
in one place — the prototype's own code keeps day pills visible on phone
(no phone-conditional in its `dayPills` styling) even though the prose says
they're suppressed; the pills are the only way to switch days on a screen
with no other affordance for it, so the working code wins and the README's
paraphrase is what's stale.
- `useIsPhone()` (`src/hooks/useIsPhone.ts`) is the one JS seam — a
  `matchMedia` hook — for the handful of things pure CSS can't do
  (mounting the phone card instead of the docked one; the wishlist panel
  and carousel not existing at all below the breakpoint, not just being
  restyled). The shell's own column/grid split needed no JS at all: a
  `flex-col desktop:grid` container plus `[flex:0_0_58%]` on the map
  wrapper is inert once the parent becomes a grid, so one class list
  serves both widths.
- The compact phone card lives inside `PinCard` itself (a `phone` prop, an
  early-return branch), not a separate component — it reuses every
  computed value (title, subtitle, cover photo) and, via an extracted
  `renderActions()`, the *exact* action-bar JSX and handlers the desktop
  card uses, so a future change to what a stop's actions are can't drift
  between the two. The edit region reuses `PinCardEdit` unchanged; its
  44px-target requirement turned out to need zero new code because
  `PinCardEdit` is only ever rendered from `PinCard` — making its field
  height `h-11 desktop:h-9` satisfies the phone spec and the desktop one
  from the same class list, the same trick as the shell.
  Deliberate deviation from the prototype: its snapshot of the edit form
  (Title/Kind/Dwell/Anchor + block buttons) predates 16.1 and 16.9, so
  copying it would have *regressed* phone editing below what the app can
  already do. The phone card gets the current `PinCardEdit` — routing
  point, costs, private notes, all of it — not the 2026-08 mockup.
- Positioning bug caught before commit: the docked/phone card used to be
  `fixed` to the viewport, harmless on desktop (the map fills the viewport
  below the header) but wrong on phone, where the map is only the top 58%
  — a `fixed bottom-0` card would sit at the *screen* bottom, over the
  itinerary column, not at the bottom of the map above it. Moved the
  card's mount point to be a child of the map's own relative wrapper and
  switched `fixed` → `absolute` on both branches; a no-op on desktop,
  correct on phone. Confirmed in a screenshot that the itinerary list is
  fully visible below the card, not covered.
- The header overflowed the phone viewport by ~130px — measured, not
  guessed (`document.body.scrollWidth` vs `window.innerWidth`), and the
  overflowing element was exactly the Search/Import/Share/Export button
  group, none of which shrink or wrap. Hidden below the breakpoint: none
  of the four are things a phone companion view needs permanently on
  screen (search-and-place, importing, sharing settings, exporting are all
  planning-desk actions), and hiding them is also literally the fix for
  the overflow. This is the rest of the "phone width breaks the header
  first" friction the avatar fix (already shipped) only partly addressed.
- `PinCardExpanded` ("All details") was not rebuilt for phone — its fixed
  46%/54% two-column split doesn't fit a ~334px modal at all, and the
  handoff calls a phone-specific version "not built" outright. The cheap
  half of that gap is closed anyway: the two columns now stack
  (`flex-col desktop:flex-row`) instead of squeezing into two ~160px
  slivers, so it's usable rather than broken. Known remaining rough edge,
  not fixed: the ARRIVE/DEPART cells' native `<input type="time">` clips
  its own text at ~96px column width in a 3-column row — a browser
  rendering limit on the native control, not a layout bug, and out of
  proportion to fix here (would mean a custom time input).
- Swipe: the touch handlers (`onTouchStart`/`onTouchEnd`, 40px threshold,
  calling the same `onStep` the `‹`/`›` buttons use) were code-reviewed and
  the `onStep` path itself was verified working via those buttons.
  Synthesizing a real touch gesture through headless Chromium/CDP for an
  end-to-end check did not work reliably in this harness — a known
  limitation of touch-event simulation, not evidence against the code — so
  the gesture itself is unverified in the browser, only reasoned to be
  correct from reading it.

**12.9 Access-point picking mode** · Standard · ✅
Revised handoff: `Set on map` is unusable from the `All details` modal (it
covers the map), and even from the inline card you aim at a country-scale
view with no help finding a car park. Replaces the thin `placingAccessFor`
top-banner flow with a real mode.
- `picking` state in `TripEditor` that suppresses the expanded modal, the
  docked card, the phone card and the wishlist panel while true.
- `MapPane`: accent inset ring over the canvas; `easeTo` the stop at ~z17
  (350ms) on entry; a dashed accent `P` circle for the set access point
  (was a 🚗 teardrop), still draggable with write-back.
- Nearby parking chips — new `buildParkingQuery`/`parseParking` in
  `src/lib/overpass.ts` (`amenity=parking` + `parking_entrance`, ~500m,
  nearest 3–5, carrying `name`/`fee`/`capacity`/`access`/`maxstay`),
  unit-tested. **Direct browser fetch, no cache** — parity with the
  existing Nearby call, not the README's "server-cached" phrasing
  (author's call, 2026-09-01). Rendered only while picking, as ≤5
  transient DOM markers. Click a chip → set there; click bare map →
  freehand; zero chips is a valid state.
- Banner below the day-pill row: "Click the map to set the access point" /
  "Zoomed to <stop> · nearby parking shown" / Reset (only when set) +
  Cancel; both return to the modal, Cancel changes nothing. Escape too.
- `PinCardEdit` + `PinCardExpanded` access rows: show Clear **and** Set on
  map side by side when set, with a mono value line (coords, or
  "Not set — routes to the stop itself").
No cascade or schema change — routing already keys off `access_lat/lon`
(`pb-stops.ts`, `placement.ts`); Clear keeps writing the `0,0` sentinel.

**12.10 Wishlist carousel + persistent starring** · Standard · ✅
Revised handoff: the "photo wheel" filmstrip, now built and no longer
optional.
- `Browse all N ›` footer in `WishlistPanel` opens a new
  `WishlistCarousel.tsx` — a full-map-width bottom filmstrip on a gradient
  fade (not a panel): `★ Top choices` filter pill, mono meta line
  (`6 places · nearest first` / `2 starred · nearest first`), a
  scroll-snap strip of 178px photo cards each with a 28px star toggle,
  floating ‹/› arrows (3 cards/press). Order = the cached `wish-order`
  proximity chain. Opening clears the selection; carousel and panel share
  the bottom-left slot and are both hidden behind an open card.
- Hover (a carousel card or a compact-list row) is highlight-only — lifts
  the card and grows that place's map pin to 36px + amber halo via a new
  `wishlist-pins-hovered` GL layer mirroring `wishlist-pins-selected`. It
  never selects, opens a card or moves the map. New `hover` UI state
  shared by the carousel, the list and the pins.
- Starring is persistent: new `pois.starred` bool (migration
  `1788000007`, not required, default false; `npm run types:pb`),
  `setPoiStarred` in `pb-pois.ts`. A 16px gold star badge shows on the
  wishlist pin at all times — folded into `compositeWishlistPin` on the
  same resolve path as 12.8's photo upgrade, so a late photo load can't
  clobber it. The filter pill narrows the strip only; starred pins stay
  on the map either way.
- UI state: `browsing` (desktop only), `hover`, `starOnly`.
Edits: `WishlistPanel`, `TripEditor`, `MapPane`, `map-markers`,
`map-features`, plus the new component and migration.

Built as specced. Notes:
- **Three wishlist-pin variants now** (`w:<id>` / `:sel` / `:hover`),
  composited in one `compositeWishlistPin` pass. `MapPane`'s
  selected-pin filter effect had to absorb the hover filter too — like the
  stops layer, `setFilter` replaces the whole expression, so a separate
  hover effect would have clobbered the selected one. Selection wins when a
  pin is both selected and hovered.
- **Re-composite trigger.** The old `wishlistCoverResolvedRef` Set (a
  one-shot "photo resolved" gate) became a `Map<id, sig>` where
  `sig = ${starred}:${coverUrl}` — a star toggle or a late photo load both
  change the signature and re-draw the pin, and the star is passed on every
  `compositeWishlistPin` call so a photo arriving after a star can't drop
  it (the 12.8 concern).
- **Star button is a `role="button"` span**, not a nested `<button>` — the
  card itself is the button (click = zoom to the place), and a real button
  inside it is invalid DOM.
- **Panel list rows** switched from a CSS `:hover` tint to the shared
  `hover` state (JS `onMouseEnter`/`Leave`) so a hovered row and its map
  pin light up together, per the handoff.
- Browser-verified: carousel layout, `★ Top choices` filter + meta line,
  star toggle persisting through a filter toggle and showing the gold badge
  on the map pin, hover lifting a card and enlarging its pin. No console
  errors. Screenshots taken, not committed. The stale `run-etappe` driver
  (still expects the pre-12.5 "+ Day" button) was not touched — see below.

**12.11 Cleanup and polish** · Cheap · ✅
Dead-code removal for everything retired in 12.5/12.6, keyboard shortcuts
re-verified (`k` still opens the kind picker from the card), `npm run
check` and `npm run format:check`, this file and `ToDo.md` updated to
reflect the shipped design. (Renumbered from a second "12.8" heading.)

**Done, 2026-09-02, closing out Phase 12:**
- Dead-code sweep: grepped for every name WORK.md's own notes call out as
  retired (`DayRail`, `WishlistPreview`, `placingAccessFor`, BUILD §5.3's
  marker-tier system) and cross-checked every component file has at least
  one real importer. Nothing found — the only hits were doc comments
  narrating the history, which is what they're for, not code.
- `k` still opens the kind picker (verified by reading the handler, and
  incidentally exercised live during 16.9's browser check).
- `npm run check` and `npm run format:check` both clean (258 tests).
- `ToDo.md` updated: the "Design direction" section (the reasoning trail
  that led to the handoff) marked historical now that 12.7 closed the
  phase it was building toward; its resolved-question sub-notes kept
  intact rather than deleted, since they're the record of *why*, not
  open work. Two items genuinely still open there and left as such:
  no confirm/undo before deleting a stop (row ✕, Delete key — every
  *other* delete in the app now confirms: wishlist 14.3, a day 16.2,
  this one never did), and re-adding leg-direction arrows. Both are real
  gaps, deliberately not folded into this cleanup task — a new
  confirmation dialog is a feature, not dead-code removal, and doesn't
  belong in a "Cheap" task picked up on the way past.

---

## Phase 13 — Day-start continuity

Author request, 2026-09-01. Today every day is an **island**: the cascade
computes each day from its own first stop starting at 09:00 (or its first
anchor), and legs only ever connect consecutive stops *within* a day
(`cascade.ts`, `pb-trip-doc.ts` builds `stops.length - 1` legs per day;
`pb-stops.ts` never wires a cross-day leg). So the morning drive from last
night's accommodation to the day's first stop is not routed, not timed and
not drawn. BUILD.md §1 ("if the same hotel ends day 3 and starts day 4 you
are staying put") assumes this continuity; it was never built.

**Design, confirmed with the author:**

- A day gets an optional **start point**: `days.start_stop` → a *pointer*
  to an existing stop (not a copy, not a stop-library rework). Normally the
  previous day's `is_accommodation` stop; can be cleared.
- **"Set start point → previous accommodation"** button per day (day 2 on):
  walks back to the nearest earlier `is_accommodation` stop and points
  `start_stop` at it. Clearing it returns that day to island behaviour.
- **One record, many days.** Re-booking a guesthouse means editing that one
  stop; every day whose `start_stop` points at it re-routes its morning
  leg. That's the whole point of the pointer over duplication.
- **Leading leg.** A real routed, ORS-cached car leg from `start_stop` to
  the day's first real stop, drawn in that day's hue, shown as a leg row at
  the top of the day. The start point renders as a greyed "ghost" row above
  the first stop (it belongs to the previous day; it's context here).
- **Timing.** 09:00 (or the first anchor, back-derived) = *leave the start
  point*. First real stop arrival = 09:00 + leading-leg effective duration.
  `LONG_DAY` elapsed includes the morning drive.
- **Decisions:** (2) moving days around does NOT auto-fix the pointer — the
  author re-clicks the button per day; auto-repair is a later nicety.
  (3) cleared/absent `start_stop` = today's island behaviour. (4) a
  multi-night stay still needs its own ending `is_accommodation` stop in
  each day's chain — no stay-put special case in v1.

Not a redesign task — touches the cascade engine, so it carries the same
"wrong abstraction propagates to editor/share/PDF/import" risk as phase 2.

**13.1 Schema + cascade** · **Heavy** · ✅
`days.start_stop` nullable relation → stops (migration `1788000008`, no
cascade delete — a deleted stop clears the pointer, day falls back to
island; `npm run types:pb`). `CascadeDay` gains `startPoint` (id + coords)
and `leadingLeg: CascadeLeg | null`; `DayResult` gains
`leadingLeg: LegTiming | null`. `pb-trip-doc`'s adapter resolves the
pointer (ignoring a self-pointer or a dangling id) and picks up the
`start_stop -> firstStop` leg record if it exists. `computeDay` adds the
leading-leg effective duration before stop 0's arrival and into
`elapsedMin`/`LONG_DAY`.

Notes:
- **The `firstAnchor` back-derivation needed no change.** An anchor pins a
  stop's own clock and everything back-derives from it, so the leading leg
  only shifts the *untimed* "leave the start point" moment — stop timings
  are identical with or without it when any anchor is present. The only
  timing change is the no-anchor branch: `arrival0 = 09:00 + leadEff`.
- **No JSON fixture.** WORK's original text called for a "multi-day cascade
  fixture", but the import format (`iceland-day1.json`, BUILD §8) has no
  `start_stop` field, so a fixture can't exercise this. Tested instead with
  constructed `CascadeTrip`s in `cascade.test.ts` (7 cases) and a 2-day
  `TripRecords` in `pb-trip-doc.test.ts` (3 cases), consistent with how the
  rest of the engine is tested. `npm run check` green (179 tests).
- `import-cascade.ts` untouched — import days stay islands (the optional
  `CascadeDay` fields default to null).

**13.2 Leg lifecycle + routing** · Standard · ✅
The leading leg is `legs(from_stop = start_stop, to_stop = firstStopOfDay)`
— a real record, but cross-day.
- New pure `planLeadingLegs` (`leading-leg.ts`): diffs every day's current
  leading leg against what its `start_stop` + first stop imply →
  create / deleteLegIds / rerouteLegIds. Idempotent. 11 tests covering
  create, no-op, pointer cleared / moved, first stop reordered / removed,
  self-pointer, dangling pointer, coord-move reroute, day chains, empty day.
- New async apply `reconcileLeadingLegs` + `setDayStartStop`
  (`pb-leading-leg.ts`): fetches fresh trip state, runs the planner, routes
  new/changed legs through the existing ORS hook + cache, commits one batch.
- `planStopMove` now filters its `existing` legs to same-day pairs, so a
  cross-day leading leg is never deleted by a within-day reorder/move
  (2 tests). `planInsertBetween` needed no change — its callers already
  pass only within-day `prev`/`next`. `deleteStop` needed none — deleting a
  first stop cascade-deletes its inbound leading leg (DB), and reconcile
  recreates it.
- `TripEditor`: a `runStructural` wrapper = `run` + a leading-leg reconcile,
  guarded on `records.days.some(d => d.start_stop)` so it's a no-op (and
  zero extra fetches) until the feature is used. All add / delete / move /
  coord-edit handlers routed through it; coord edits pass the moved stop id
  as `rerouteStopIds`.

Inert until 13.3 adds the "Set start point" button — no day can have a
`start_stop` yet. Verified by the unit tests plus a browser smoke that the
`runStructural` rewire didn't break add-day / add-stop. `npm run check`
green (192 tests).

**13.3 Rendering + editor** · Standard · ✅
- `buildLegFeatures` emits the leading-leg line in the day's hue — routed
  geometry when the leg has it, else a straight `manual` connector keyed
  `lead:<dayId>` (2 tests). Drawn like any leg; the "from yesterday" cue is
  the itinerary ghost row, not the map line.
- `Timeline`: a greyed ghost row for the start-point stop (dashed `↑`
  badge, greyed thumb, "start point · leave HH:MM" where the time is the
  first stop's arrival minus the leading leg's effective duration), then
  the leading `LegRow` (reusing all its edit/reroute/manual controls), then
  a `✕` to clear. When no start point is set, a dashed
  `↑ Start from <name>` button instead — shown only from day 2 on and once
  the day has a stop.
- `TripEditor`: `startPointStop` / `startPointLeg` / `startPointCandidate`
  computed for the active day (candidate = walk back to the nearest earlier
  non-empty day's last `is_accommodation` stop, or its last stop). New
  `setStartPoint(dayId, stopId|null)` → `setDayStartStop` +
  `reconcileLeadingLegs` + `reload` (not via `runStructural` — that skips
  reconcile until a start point exists, which is the case this creates).
- BUILD.md §1 (concept), §2 (`days.start_stop`), §3 (algorithm step 1 +
  LONG_DAY note) updated.

Browser-verified end to end: the "Start from …" button appears on day 2,
setting it renders the ghost row + leading `LegRow` (0m·manual here — no
ORS key in this env), clearing restores the button. No console errors.
`npm run check` green (194 tests). Arbitrary-stop picker still a
fast-follow — the button only ever points at the previous accommodation.

---

## Phase 14 — Unify wishlist ideas and stops

Author request, 2026-09-01. A wishlist idea (`pois`) and a stop describe
the same real-world place, but promoting an idea to a stop silently loses
its photos, description and links — only title/kind/coords carry over
(`commitPlacement` in `TripEditor`; the idea's blocks stay on the now-
hidden `scheduled` poi). And the two schemas drift: `pois` keeps free text
and a link in scalar fields (`notes`, `url`) while stops use blocks; stops
have `access_lat/lon` / `address` and an accommodation flag that a
pre-placement idea can't hold.

**Target: a POI is a stop without a day.** They share title, kind, lat/lon,
address, access point, star, and the whole block system. A stop adds
`day` / `order_index` / `anchor` / `dwell` / `is_accommodation` /
`kind_confirmed`; a POI adds nothing of its own once `status` is gone.

**Decisions, confirmed with the author:**
- Drop `pois.url` and `pois.notes` — links are `link` blocks, free text is
  `note` blocks, on both. `PinCard` already renders every note block; make
  it render every link block too (was `.find`, first only).
- Drop `pois.status` entirely. It only ever hid a promoted idea, and
  nothing reads `scheduled`. `listWishlist` becomes "pois for this trip".
- Add `pois.access_lat` / `pois.access_lon` / `pois.address`.
- Add `stops.starred`. The star carries over on promotion and shows on the
  stop the same way it does on a wishlist pin (gold badge on the map pin +
  a marker in the itinerary row) and stays toggleable from the stop card.
- **Promote** POI → Stop: create the stop with the shared fields, re-parent
  its blocks (`reparentBlocks`, already added), **delete the POI** — no
  tombstone.
- **Downgrade** Stop → POI: the mirror — create a POI with the shared
  fields, re-parent blocks back, delete the stop (legs re-merge as any
  stop deletion). On the stop card, a trash button (delete, keeps the
  existing confirm) and a recycle `♻` button (downgrade), both with hover
  tooltips.
- The wishlist card's **"Reject" becomes "Delete"** — a hard delete
  (`deleteWishlistItem`) with a confirm.

**14.1 Schema + data layer** · ✅
Migration `1788000009`: `pois` drop `url` / `notes` / `status`, add
`access_lat` / `access_lon` / `address`; `stops` add `starred` (bool, not
required). Up-migration first deletes any `pois` with `status != 'idea'`
(hidden history nothing showed). `npm run types:pb`. `pb-pois.ts`:
`listWishlist` loses the status filter, `addWishlistItem` its `notes` /
`url` / `status` payload; `markWishlistScheduled` and `rejectWishlistItem`
deleted (callers move to `deleteWishlistItem`; `starred` just joined
`StopPatch`, no bespoke setter needed). `addLinkBlock` generalised to any
block parent (poi or stop) via a `BlockParent` type, new `addNoteBlock`
alongside it (`pb-capture.ts`); new `reparentBlocks` (`pb-blocks.ts`).

Turned out the schema change forces the promote rewrite in the same
breath — `commitPlacement` / `useExistingStop` couldn't keep compiling
against `markWishlistScheduled`, so **the lossless-promotion fix landed
here, not in 14.2**: both now `reparentBlocks` the idea's blocks onto the
new/matched stop and `deleteWishlistItem` (no tombstone) instead of
marking it scheduled. Hand capture (`commitWishlistPick`) creates a `link`
block instead of setting `pois.url`; the Highlights importer routes
`h.notes` into its own note block alongside the existing `description` one
(`createHighlightBlocks`). `PinCard` drops the `target.item.url` /
`target.item.notes` scalar branches and now renders *every* link block,
not just the first (was `.find`, now `.filter` — free once the scalar
override was gone).

Browser-verified end to end (the original bug report): imported a
highlight with a description + link, opened its wishlist card (both
show), promoted it via the ranked placement picker, opened the resulting
stop's card — description and link both present, wishlist item gone. No
console errors. `npm run check` green (194 tests unchanged — nothing new
to unit-test here, same as `pb-legs`'s async apply functions).

**14.2 Downgrade + stop-card actions** · ✅
`downgradeStopToWishlist(pb, provider, records, stopId)` in `pb-stops.ts` —
the mirror of promotion: creates the poi with the stop's shared fields
(+ `setPoiStarred` if it was starred), `reparentBlocks` stop→poi, then the
existing `deleteStop` (leg re-merge). Wired in `TripEditor` through
`runStructural` (so `reconcileLeadingLegs` picks up a day that lost its
start point or first stop) with an explicit `reloadWishlist()` after —
`reload()` refreshes the cascade doc, not the separately-fetched wishlist.

Both the docked card and the expanded card's action bars gain two icon
buttons (34px/36px squares, matching each card's existing button height):
`♻` downgrade and `🗑` delete — the delete button keeps the existing
click-twice confirm (now shown as a filled danger background rather than
a text change, since there's no label to swap). Both carry a `title` hover
tooltip; icons are a placeholder pending a better delete glyph.

Browser-verified: added a stop, opened its card, clicked `♻` — the day
goes back to empty and the stop reappears as a wishlist row with its
title. No console errors.

**14.3 Starred stops + wishlist delete confirm** · ✅
`buildStopFeatures` carries `starred` (+ test). Deviated from the original
sketch — no `stops-star` overlay layer: the star is baked straight into the
numbered badge instead (`n:<seq>` vs `n:<seq>:star`, mirroring how the
wishlist pin folds its star into `compositeWishlistPin`), because a second
GL layer needs `icon-offset` math to sit at a fixed corner of a *circle*
inscribed in its own image, and a same-day-scoped filter kept in sync with
the base layer — more moving parts than just doubling the image variants,
which the codebase already does for wishlist pins. `drawStarBadge`
generalised to take a diameter (default stays the wishlist pin's 32px;
stop badges use smaller 18px/24px unselected/selected sizes, proportionate
to their smaller circles). `buildNumberedPinElement` (the selected stop's
draggable DOM marker) takes a `starred` flag too, positioned at the
badge's own corner inset by the halo margin, not the full canvas.

`StopRow` shows a gold ★ before the title when starred. The docked card
gets a star toggle — a glass circle next to the photo header's close
button, `onUpdateStop({ starred: !stop.starred })`, no new mutation
function needed (`starred` already joined `StopPatch` in 14.1).

Wishlist card's "Reject" renamed "Delete" (prop renamed `onReject` →
`onDelete` too) and now reuses the stop card's `confirmingRemove` state/
click-twice pattern instead of firing immediately.

Browser-verified: starred a stop from its card, the itinerary row shows
the star; armed and confirmed "Delete" on a wishlist idea, it's gone. No
console errors. `npm run check` green (195 tests).

**Known gap, not fixed**: the selected stop's DOM marker only rebuilds
when the *stop id* changes (position-tracking only, by design); toggling
`starred` while that same stop stays selected won't show the badge update
on its DOM twin until it's reselected. The underlying GL layer (any other
view of the same stop) updates immediately since `stopFc` always carries
current data.

---

## Phase 15 — Wishlist contributor attribution

**Done 2026-09-02 (15.1 + 15.2).**

Source: a 2026-09-01 revision of the design handoff
(`design_handoff_map_first_planner/README.md`, "Contributor identity" in
State management, plus `CLAUDE_CODE_PROMPT.md`'s "Collaboration
attribution"). A shared trip is planned by several people; the wishlist is
where their individual research shows up, so each **wishlist entry** carries
a small mark for the person who added it. Deliberately wishlist-only — an
itinerary stop carries no attribution, because the day plan is shared while
the candidate list is personal.

**Design, from the handoff:**
- Every `pois` record stores its creator (a user relation, set on create —
  `blocks.creator` is the existing precedent).
- Every `users` record stores a **`color`** — a stable oklch string, one per
  person, so the same contributor reads the same colour in every trip and
  every surface. Not a name hash, not picked from the palette at render
  time. Band: L≈0.72–0.75 / C≈0.13, hue only varies, staying clear of the
  accent (215) and the wishlist amber (80). Prototype pair: Julia
  `oklch(0.72 0.13 300)` violet, Jan `oklch(0.75 0.13 155)` green. Assign
  the next free hue in the band on registration.
- Three marks, all wishlist-only:
  - **Panel row** (`WishlistPanel`): a right-aligned 18px circular chip
    with the contributor's initial, filled with their colour,
    `title="Added by Julia"`.
  - **Carousel card** (`WishlistCarousel`): a contributor pill bottom-right
    over the scrim — 7px colour dot + nickname, 10.5px, 20px tall,
    `radius:10px`, `oklch(0.16 0.014 250 / 0.72)` + `blur(6px)`. The name
    block's right edge stops at 74px to clear it.
  - **Docked card** wishlist mode (`PinCard`): a pill on the title row,
    right-aligned — dot + nickname, 11px, 22px tall, `radius:11px`,
    background `oklch(0.25 0.012 250)`, border `oklch(0.32 0.012 250)`.

**15.1 Schema + colour** · ✅
Migration `1788000015`: `pois.creator` relation → users
(`cascadeDelete: false`), `pois.creator_name` + `pois.creator_color`
(**snapshotted** at create time — resolving through `users` at render
time is out, that collection stays self-only per WORK 16.6), and
`users.color` text. Existing accounts backfilled by creation order into a
fixed L 0.74 / C 0.13 hue band clear of the accent (215) and amber (80);
first two hues match the handoff demo pair. `pb_hooks/
contributor_color.pb.js` assigns the next band hue to every new account —
`onRecordAfterCreateSuccess` + an explicit save, matching
`membership.pb.js`'s existing `users` hook (a first draft used
`onRecordCreate`, which this PB build rejects — registration 400'd until
switched). `addWishlistItem` is the one chokepoint for poi creation
(every path funnels through it — verified by grep), so it stamps
`creator`/`creator_name`/`creator_color` from `pb.authStore.record`; name
falls back to the email local part. Types regenerated. Commit: `phase
15.1: wishlist contributor — schema + colour`.

**15.2 Contributor marks** · ✅
New `src/components/ContributorMark.tsx`: `contributorOf(poi)` reads the
snapshot fields (null when `creator_color` is empty — pre-migration rows
or a deleted account), `ContributorChip` (18px initial-only circle,
`title="Added by …"`) and `ContributorPill` (dot + nickname, `card` /
`carousel` / `carousel-phone` metrics). Wired into `WishlistPanel` (chip,
right of the row), `WishlistCarousel` (pill bottom-right over the scrim,
name block pulled in to `right-[74px]`, phone metrics via the existing
`phone` prop) and `PinCard`'s desktop docked card (pill on the `<h2>`
row, which became `flex-1 truncate` to share the line). Browser-verified
at 1440px (`.claude/skills/run-etappe/contributor-15-check.mjs`): the
panel chip renders at 18×18 and the card pill shows the contributor, no
console errors. Commit: `phase 15.2: wishlist contributor — the three
marks`.

---

## Phase 16 — Planning ergonomics, portability, sharing

Author request, 2026-09-01 (seven items, in the order given). Independent
of each other; 16.1 and 16.2 are the ones that bite during daily planning,
so do those first.

**16.1 Make the timing row editable** · Standard · ✅
Today the ARRIVE / DEPART / DWELL row at the top of `PinCard` (and the same
row in `PinCardExpanded`) is a **read-out of cascade output** — it renders
`target.timing`, which the engine computed. The editable fields lower down
are the *inputs*: `dwell_min` (an override of the taxonomy default) and
`anchor_time` + `anchor_type`. That is why the top row looks like the same
three fields but does nothing. Right conclusion, wrong ergonomics: the
read-out should be where you type.
Make each of the three cells an inline input that writes the input that
produces it:
- **Arrive** → `anchor_time = value`, `anchor_type = 'arrival'`.
- **Depart** → `anchor_time = value`, `anchor_type = 'departure'`.
- **Dwell** → `dwell_override = value` (the field is `dwell_override`, not
  `dwell_min` as first written here). Not an anchor — dwell is already a
  direct input, and a stop can carry a dwell and an anchor at once.
- Clearing a time cell clears `anchor_time`/`anchor_type`; clearing dwell
  falls back to the taxonomy default.
The lower `ANCHOR` / `TYPE` / `DWELL (MIN)` fields then become redundant
duplicates — delete them rather than keeping both in sync (prefer deleting
code to adding a flag). Keep the anchor visible as state: an anchored cell
gets a pin mark and a "pinned" tint so it is obvious which of the two clock
cells is driving the other.

**Settled (author, 2026-09-01): dwell is held, the other clock moves.** A
stop has room for exactly one anchor, so the two clock cells can never both
be pinned. Editing either one moves the anchor to that cell and
**recalculates the other from the dwell** — arrive 09:00 with a 1 h dwell,
type 11:00 into Depart, and the stop is now departure-anchored at 11:00
with arrival recomputed to 10:00. Dwell is never silently rewritten by a
clock edit; it only changes when you type into the Dwell cell.
The other reading — pin both clocks and derive dwell from the span — is a
real feature, just not this one: it needs a second anchor per stop, which
the schema does not have. Filed as
[#1](https://github.com/gebauer/etappe/issues/1), not built here.

**Anchoring a stop that is already governed by an anchor upstream** (the
usual case: the day's first stop is anchored, and you now anchor stop 4).
The cascade today just lets the later anchor win for everything below it
and files an `anchorMiss` warning for the gap — silent, and it throws away
the information that the gap is *slack you could spend*. Instead, prompt
with the two things the traveller actually means:
- **Move the whole trip** — shift the upstream anchor by the delta so the
  chain arrives exactly on time and nothing waits. The plain
  reschedule-everything option.
- **Spend the slack as dwell** — offered only when the new anchor is
  *later* than the natural arrival, i.e. there is genuinely spare time.
  Absorb the delta into dwell so the day fills the gap instead of idling.
**Settled (author, 2026-09-01): all of it onto the immediately preceding
stop, and say so.** Adding the delta to the stop being anchored does
nothing to its own arrival — dwell runs after arrival — so it can only be
absorbed *upstream*, and it goes to the one stop directly above rather than
being spread across the run. One number changes, which is the version a
traveller can undo.
"Say so" is part of the task, not polish: the prompt names the stop and the
new dwell before you commit to it ("Gullfoss gets 45 min more, 1 h 30 →
2 h 15"), and after the edit the preceding stop's Dwell cell carries a
brief changed mark. A dwell that grows by three quarters of an hour on a
stop you were not editing must never be something you discover later.
Both branches are edits to stored inputs, computed from cascade output —
the engine itself stays pure and unchanged.

**Built as:** `src/lib/timing-edit.ts` (pure, 17 tests) turns a cell edit
into the record changes that produce it and reports the conflict;
`src/lib/timing-cells.ts` builds the three cell specs; `TimingCells`
renders them; `TimingConflictPrompt` puts the two branches to the user;
`TripEditor.editTiming` wires it up. The lower `ANCHOR` / `TYPE` /
`DWELL (MIN)` fields are gone from `PinCardEdit`, and the expanded card's
Arrive/Depart cells are editable too (its third cell is Daylight, not
Dwell — read-only). One trap worth remembering: the cells are uncontrolled
inputs, so they need a `key` tied to their value or React reuses the DOM
node and the previously selected stop's clock stays in the field.

**16.2 Insert a day anywhere in the itinerary** · Cheap · ✅
The data layer is already done and unit-tested: `insertDay(pb, tripId,
atIndex, day)` in `src/lib/pb-days.ts` reindexes via the pure
`planInsertDay`, in one batch, and returns the day-parented blocks whose
derived date shifted. Only the UI is missing — both call sites in
`TripEditor.tsx` pass `records.days.length`, i.e. append only.
Add an insert affordance at an arbitrary position: a hairline "+" between
day pills in `DayPills`, and the same in the itinerary column between day
groups. Surface the returned `changedBlocks` in the shift warning the same
way delete/move do (anything anchored to a day whose date just moved).
Deleting a day already exists in the data layer too and is likewise not
wired to any control — do it in the same task, with a confirm.

**Built as:** hairline gaps between the pills, revealed on hover/focus,
each inserting before that day. The itinerary-column half of the spec was
dropped: since 12.6 that column renders one focused day, so there are no
"day groups" to insert between any more — the pills are the only place a
gap exists. Delete lives in the itinerary header instead, two-click
confirm. Neither insert nor delete had a shift warning to reuse (nothing
called those functions before), so `changedBlocks` now feeds a neutral
`notice` line beside `actionError`: "A new day pushed 1 note onto a
different date."; `moveDay` is still unwired.

**16.3 Versioned JSON export** · Standard · ✅
Phase 8.1 promised "Export writes the same format — round-trip test" and it
was never built. Build the export half now, and make version handling
explicit so the model can move later:
- Every exported document carries `version` (both import schemas already
  do: `import-highlights.ts` pins `z.literal(1)`, `import-cascade.ts` reads
  a numeric `version`). Export always writes the **current** version.
- Import keeps a parser per version — `parseV1`, `parseV2`, … — and
  upgrades old documents forward to the current shape at the boundary.
  A retired version's parser is never deleted; it is the only thing that
  keeps a two-year-old export openable.
- Two exports, or one with a flag: the full trip (days, stops, legs,
  blocks, wishlist) and the wishlist alone, since the wishlist is what gets
  passed between people.
- Round-trip test against `fixtures/iceland-day1.json`: export → import →
  identical cascade output. That fixture stays the canonical case.
Decide what happens to uploaded files (photos, booking PDFs): either the
export references them by URL, or it is a JSON-only document that drops
them and says so on the way out. Lean JSON-only for v1.

**Built as:** `src/lib/export-trip.ts` (`exportTrip`, `exportWishlist`,
`exportFilename`, `CURRENT_TRIP_VERSION`) and `src/lib/import-trip-doc.ts`
(`parseTripDoc` — a Zod schema per version behind a version dispatch, which
is also the §8.1 full-format schema that was never built). An Export menu
in the editor header downloads either. Files are dropped, with the count
written into `omitted_files` and reported in the notice line. 15 tests,
including export → parse → identical cascade output, and validating the
shipped fixture changing nothing about what it cascades to.

**16.4 Duplicate detection on wishlist import** · Standard · ✅
`import-highlights-commit.ts` creates a `pois` row per highlight
unconditionally, so importing an overlapping list twice silently doubles
every entry. Add a duplicate check to the import **preview**, before
commit: for each incoming highlight, look for an existing `pois` (and
`stops` — since 14.1 they are the same thing) within the merge radius, or
with a matching title. `findNearbyStop` in `src/lib/merge.ts` (100 m, WORK
6.5) is the precedent but is stop-only and returns one candidate — extend
it, or add a poi-aware sibling, and keep it pure and unit-tested.
Each flagged row gets a per-item choice, defaulting to Merge:
- **Merge** (author-specified, 2026-09-01) — keep the existing record and
  treat its own fields as authoritative: a scalar field (title, kind, lat/
  lon, address, access point) is written **only if the existing one is
  empty**, never overwritten. Blocks are the opposite — notes, photos and
  links **accumulate**: every incoming block is appended, deduplicated only
  on an exact match (same URL for a link or photo, identical text for a
  note), so a second list of the same place adds what it knows and loses
  nothing.
- **Replace** — overwrite the existing record's fields with the incoming
  ones, keeping its id (so any placement, star, or day assignment
  survives).
- **Add anyway** — a second record; two genuinely different places can sit
  a few metres apart.
Plus a header control to apply one choice to all flagged rows. The commit
stays atomic.

**Built as:** `src/lib/import-dedupe.ts` (`findDuplicate`, `planMerge`,
`planReplace`) with 17 tests, wired through `importHighlights` (which now
takes per-index decisions and reports `outcome: created | merged |
replaced`) and the preview's per-row control. Matching is distance-first
within 100 m, falling back to a normalised title only when one side has no
coordinates — a title match between two *located* places is a different
place that shares a name.
**Trap, cost one wrong result before it was caught:** PocketBase returns an
unset number field as `0`, not null, so an unlocated idea reads as latitude
0 in the Gulf of Guinea and compared as thousands of km away. Anything
comparing coordinates has to treat `0` as unset, the way `buildCascadeTrip`
already does with `s.lat || null`.

**16.5 Wishlist items get the full stop treatment** · Standard · ✅
Since Phase 14 a poi is "a stop without a day", but the UI never caught up:
in `PinCard`, `PinCardEdit` and `PinCardExpanded` are both gated on
`target.type === 'stop'`. A wishlist item therefore cannot be renamed, has
no kind picker, no access point, no All-details view, and no way to add a
note or a photo — the wish footer offers only Add to itinerary / Delete.
- Give wish mode the same **Edit** and **All details** buttons, and make
  `PinCardEdit` / `PinCardExpanded` take a poi or a stop rather than a
  stop. What genuinely doesn't apply to a poi is the timing row (16.1) and
  the day/sequence subtitle; everything else does.
- **Personal notes**: a note block whose `visibility` is `private` is
  already the mechanism (the field exists, the API rule already hides other
  people's private blocks). What is missing is a visible affordance — a
  distinct "My notes" section in both the card and the expanded view, with
  the private visibility preset, so a personal remark doesn't have to be
  filed as a trip-wide note and manually toggled. Same section on stops.
- **More photos**: `+ Photo` already appends photo blocks and 12.10's
  carousel already renders a set of them; it just needs to be reachable
  from wish mode too, for both a poi and a stop.
The point is one card that doesn't care which side of the promotion line
its subject is on — the remaining `type === 'stop'` branches should reduce
to the timing row and the itinerary-only actions.

**Built as:** `PinCardEdit` and `PinCardExpanded` both take a stop *or* a
poi behind an `isWish` flag; the stop-only sections (timing cells,
accommodation, "move to day", downgrade) render off a narrowed `asStop`
rather than the flag, since a boolean is not something TypeScript can
narrow a union on. Wish mode's footer gained Edit and All details. "My
notes" is a private-visibility note block — `addBlock` takes a parent kind
and a visibility now — with its own section in the card, since a private
block is only ever returned to the person who wrote it.
Folded in on the way past: the expanded card still had its own Dwell and
Anchor fields, the same duplication 16.1 deleted from `PinCardEdit`. Gone;
its "Timing" section is now just Kind.

**16.6 Sharing a trip** · Standard · ✅ (editor-side viewer mode open, see below)
Three audiences, two mechanisms. Most of the backend already exists and has
never been given a UI:
- `trip_members` with `role` ∈ owner | editor | viewer, and API rules that
  already enforce it (a viewer cannot write — verified in migration
  `1788000003`).
- `invites` (`trip`, `email`, `role`, `status`) plus
  `pb_hooks/membership.pb.js`, which materialises a pending invite into a
  `trip_members` row when that email registers.
- `trips.share_token` (autogenerated, unique) and `trips.share_enabled`.
- `blocks.visibility` ∈ private | trip | public.
So the work is:
- **People**: a members panel on the trip — invite by email with a role,
  change a member's role, revoke, leave. Pending invites listed as pending.
  Owner-only. This is the "members" line item phase 11.2 lists for trip
  settings; build it here and cross it off there.
- **Public link**: the `share_enabled` toggle, the token URL, regenerate.
  The payload itself is phase 9.1 — `pb_hooks/share.js`, assembled
  **server-side**, non-negotiable rule 5. The read-only view is 9.2. Doing
  16.6 means doing 9.1/9.2; they are the same task seen from two sides.
- **What a public link strips**: only `visibility = 'public'` blocks reach
  the public payload — bookings, files, personal notes and prices are
  `trip` or `private` and never leave the hook. Non-obvious consequence
  worth stating in the UI: a block defaults to `trip`, so a public share
  starts out showing *nothing* but the route and the stops until blocks are
  explicitly promoted. `costs` never enters the public payload at all,
  by rule — see 16.7. A "what will be visible" preview on the share dialog
  is the honest way to ship this.
Address the whole-trip shape, not just the button: a viewer opening a trip
they don't own should get the editor in read-only, not a second view — one
cascade, one renderer.

**Built as:** `SharePanel` (people: invite by email + role, change role,
revoke a pending invite, remove/leave, owner-only where the rule says so)
and `ShareView` + `pb_hooks/share.pb.js` (the public link — 9.1/9.2, done
as part of this). `src/lib/share-doc.ts` maps the hook's payload onto
`CascadeTrip` so the public view runs the *same* `cascade()` as the editor,
per CLAUDE.md rule 3. `trip_members.label` (migration `1788000011`) carries
the invited email onto the membership row, since `users` is readable only
by its own account and widening that felt worse than the alternative.
Verified end to end with a real unauthenticated browser context: a public
link shows a public note and correctly withholds a private one on the same
stop, and the disabled/enabled states both return the right HTTP status.
**Not built — the "one cascade, one renderer" half:** `TripEditor` has no
read-only mode. A `viewer` member opening a trip today gets the same
editor a owner does; the server rule already refuses their writes (verified
since migration `1788000003`), so nothing can actually go wrong, but every
button still looks clickable and every click quietly fails into
`actionError` instead of never being offered. Doing this properly means
threading the member's own role into `TripEditor` and disabling structural
controls — its own task, not a corner to cut into this one.

**16.7 Surface price tags** · Standard · ✅ (superseded by 16.10, kept for
history — the GUI it describes no longer exists)
Answering "did we have price tags?" — yes, in the schema, and nowhere else.
Migration `1788000000` created a **`costs`** collection: `trip`,
`parent_type` ∈ trip | day | stop | leg, `parent_id`, `label`, `amount`,
`currency`, `category`, `is_estimate`, with membership rules applied
(`1788000003`). `trips.currency` exists too. `CostsRecord` is in
`src/types/pb.ts`. **No application code reads or writes any of it** — not
one reference outside the generated types. It was built in phase 1 for
phase 11.1 (Budget) and has sat unused since.
So the cheap, useful half is just to show and edit them where a price is
actually noticed:
- A price line on the pin card and the expanded card, for a stop **and** a
  poi alike (a wishlist entry's admission fee is exactly the thing that
  decides whether it makes the cut). Same both-sides-of-the-promotion-line
  rule as 16.5.
- Add / edit / remove a cost with a label, an amount, and the estimate
  flag. Currency comes from `trips.currency`; no per-cost currency picker
  and no conversion (out of scope for v1).
- A per-day and per-trip total in the itinerary column.
Full budget breakdown by category stays phase 11.1 — this is the entry
surface it needs, not the reporting.
**Settled (author, 2026-09-01): costs are members-only.** `costs` has no
`visibility` field, unlike `blocks`, and it is not getting one. Prices are
visible to trip members and **never enter the public payload** — the share
hook (9.1 / 16.6) does not read the collection at all, which is also the
cheapest way to be sure the rule holds. A public link shows the route, the
stops and public blocks; what any of it cost is not part of that document.

**16.8 Skip on wishlist-import duplicate detection** · Cheap · ✅
Author correction, 2026-09-02: 16.4 shipped Merge / Replace / Add anyway
per flagged row, with no way to say "leave this one alone" — the closest
was Merge, which still writes to the existing record. `DuplicateDecision`
gains `'skip'`: `importHighlights` treats a skipped row as absent entirely
(no poi/stop touched, no blocks written, no result row — there is nothing
to report on), the per-row and apply-to-all controls both offer it, and the
Import button's count and the done summary ("N skipped, left as they
were.") reflect it. The progress callback was quietly counting on
`results.length` as the done-index, which undercounts the moment anything
is skipped (a skip advances the loop without adding a result); switched to
the loop index. Verified end to end: an existing "Gullfoss" idea marked
Skip received zero new blocks and zero field writes, while a second,
genuinely new item in the same import still landed.

**16.9 A routing kind for stops** · Standard · ✅
Author request, 2026-09-02: sometimes a leg has to be forced through a
particular point — a mountain pass, a specific junction, a scenic detour —
without that point being a destination worth its own dwell. `kind` (the
taxonomy) stays closed and is about *what a place is* (CLAUDE.md rule 6);
this is a second, orthogonal axis about *what role a stop plays*, so it is
its own field (`stops.routing_kind`, migration `1788000012`) rather than a
27th taxonomy entry that would need an icon and a default dwell it doesn't
want.
Two values: `stop` (default/absent — every existing row, unchanged
behaviour) and `waypoint`. A waypoint's dwell is forced to `0` in
`resolveDwell` regardless of `dwell_override` or its activities — the point
being there at all *is* "force the route through here"; a delay on top
would be a second, unrelated feature. Cascade test covers this against both
an override and activities at once, plus the ordinary case being
unaffected when the field is absent.
A toggle lives in `PinCardEdit` next to Access point, stop-only (a wishlist
idea isn't in a leg chain, so the concept doesn't apply to it). The map
badge is a distinct small diamond with no number and no star — a waypoint
still counts in `order_index`/day-stop-count (renumbering the sequence to
exclude it was judged too invasive for what this needed), but it must not
read as destination #4 of 7 on the map or in the itinerary list, so
`StopRow` labels its kind as "Routing point" and `PinCard`'s subtitle does
the same. Carried through the round-trip surfaces that predate it so
nothing silently drops it: the §8 import/export format
(`import-cascade.ts`/`export-trip.ts`/`import-trip-doc.ts`) and the public
share payload (`share.pb.js`/`share-doc.ts`).
Verified in the browser: the toggle writes `routing_kind: 'waypoint'` and
`dwell_override: 0`, the card shows Dwell as `0`, and the map renders the
stop as a diamond on the route rather than a numbered pin.

**16.10 Budget rework: one field, currency conversion, kind-based buckets**
· Standard · ✅
Source: a `design_handoff_map_first_planner` revision (numbered "6" by the
browser download, merged into the canonical folder as part of this task)
added a "Budget" section describing a header popover — a `€` glyph that
becomes the running total once any stop has a cost, opening a four-line
bill (Accommodation / Flights / Rental car / Sightseeing) plus a total, fed
by a single `Cost (€)` field per stop. This directly superseded 16.7's
shipped design (a list of labelled, estimate-flagged costs with day/trip
totals in the itinerary header) — flagged to the author as a real conflict
rather than silently rebuilt, since it meant discarding real UI. The author
then refined the handoff's own version further (2026-09-02):
- **One estimated cost per stop, with its own currency** — not the trip's.
  A fuel receipt in ISK shouldn't need mental math before it goes in.
- **Convert to the trip's currency for display**, using **average
  (~monthly) rates from an online server** — not a live spot rate, and not
  pretending to be a precise statistical average either. The total is
  explicitly allowed to change between reloads as the cached rate
  refreshes; what's durable is each cost's own `{amount, currency}`.
- **Keep the backend's room for several cost rows per stop** — "we can
  keep multiple cost items in the back if we later decide we want them" —
  the GUI just only ever reads/writes the first one now.
- **Rental car is a stop kind** (`rental`, car-rental icon), not the
  handoff's trip-level field — a rental picked up partway through a trip
  needs to be a real place on the map, not a single number with nowhere to
  attach a location or a receipt to.
- **Fuel merges into the rental bucket**, relabelling it "Rental car +
  fuel" only when a fuel-kind cost actually exists in the trip — the
  existing `fuel` kind, no new one needed.
- Everything else with a cost falls to **Sightseeing** — "the rest."
Built as:
- `src/lib/currency.ts` — a curated 11-currency list (verified against
  ISK specifically, since some free rate sources omit it — see below) and
  pure cross-rate conversion (`convert`), tested.
- `src/lib/exchange-rates.ts` — fetches `open.er-api.com` directly from the
  browser (keyless, like `photon.ts`; unlike ORS there is no secret to
  hide server-side, so no hook). Cached in **`localStorage`**, not
  PocketBase: the source of truth is each cost's own stored
  `{amount, currency}`, and the converted total is explicitly allowed to
  differ per viewer/reload, so nothing here needs to be identical across
  every device looking at the same trip. Refetches only once the cache is
  older than ~30 days.
  **Provider choice, verified before building on it:** Frankfurter (ECB
  data) is the more commonly reached-for free option but does not carry
  ISK at all — checked live against both before picking `open.er-api.com`,
  which does.
- `src/hooks/useExchangeRates.ts` — thin hook wrapper; `null` while
  loading or on total failure (offline, no cache yet), so the popover
  falls back to same-currency-only totals rather than crashing.
- `src/lib/costs.ts`'s new `budgetByKind` — buckets by each cost's
  **parent stop's current kind**, not a category stored on the cost, so
  re-kinding a stop later moves its cost to the right line with no edit to
  the cost itself. Returns an `unconverted` count (a deleted parent, or a
  currency the cached rates don't cover) so the popover can say "N not
  counted" instead of quietly under-reporting. 15 tests.
- `src/components/CostField.tsx` (renamed from `CostList.tsx` — the shape
  changed enough that keeping the old name would have been misleading):
  one amount input + a currency `<select>`, replacing the labelled-list UI.
  `src/lib/pb-costs.ts` gained `setSingleCost` (find-or-create-or-update-
  or-delete the first cost row for a parent) alongside the untouched
  `addCost`/`updateCost` multi-item functions, kept for the "later" case.
- `src/components/BudgetPopover.tsx` — the header glyph/popover, wired
  into `TripEditor`'s header outside the phone-hidden button group (12.7),
  so it stays visible at every width. `Timeline.tsx`'s day/trip cost
  totals (16.7) are gone — costs no longer show anywhere but here.
- Migration `1788000013` adds `rental` to `stops`/`pois`' `kind` enum
  (taxonomy entry: `car-rental` Maki icon, 20 min default dwell; sprite
  rebuilt, 27 kinds now). Migration `1788000014` makes `costs.label`
  optional — required text rejecting an empty string is the same trap as
  required-number-rejects-0, just for text; the simplified field writes no
  label at all, so requiring one 400'd every save until this landed.
Verified end to end in the browser with five stops (hotel/airport/rental/
fuel/waterfall) and three currencies (EUR/USD/ISK): the header button
starts as a bare `€`, becomes the real running total once costs exist, the
popover's four lines total correctly, the rental bucket's label switched
to "+ fuel" exactly when a fuel cost was added, and the stored records
kept each cost's original currency rather than a pre-converted number.

---

## Phase 17 — Design handoff revision 7 (day dock, phone reachability, wording, cost marks)

Source: `design_handoff_map_first_planner` was revised again 2026-09-02
(numbered "7" by the browser download, merged into the canonical folder as
part of 17.1). Triggered by a real bug the author hit and screenshotted: a
13-day trip's day-pill row wrapped onto a second line and pushed the map
down. The revision turned out to bundle five changes, not one; the author
confirmed all five with **"Merge 7 and build everything"** (2026-09-02),
including an explicit reversal of 12.7's "no wishlist on phone" call —
**"12.7 is reversed, we need highlights visible during the trip for
spontaneous detours."**

**17.1–17.5 all built and pushed 2026-09-02.** A further handoff revision
(`design_handoff_map_first_planner(9)/`, in the repo root) then added one
more surface — the trip overview — built as **17.6** the same day.

**17.1 Day dock rework** · Standard · ✅
Replaces the plain wrapping pill row (`DayPills.tsx`) with a single row
that never wraps — a fixed-width icon button (Fit trip), a vertical "DAYS"
label, then a horizontally-scrolling pill rail with edge-fade gradients,
conditional `‹`/`›` chevrons (shown only when there's more to scroll to
in that direction), and drag-to-pan. `revealDay()` keeps the active/just-
selected pill within a 92px margin of either edge, using `scrollTo` (never
`scrollIntoView`, which would move the whole app shell, not just the
rail). The old auto-width row and `DayRail` (retired at 12.6) are both
gone; this is the only day switcher now.
- **Bug found and fixed before commit:** making the pill container
  `flex-1` (needed so it fills available width instead of shrinking to
  content) let it stretch under MapLibre's own `NavigationControl` (zoom
  +/-, top-right, ~40px footprint) — something the old auto-width row
  never reached far enough to do. Measured with `boundingBox()`: the dock
  container's right edge landed inside the zoom control's x-range. Fixed
  by reserving the control's footprint on the outer wrapper
  (`right-[54px]` instead of `right-3`); reverified at 0/13-day trip
  sizes with no overlap.
- **Second bug found and fixed before commit, more serious:** the initial
  drag-to-scroll implementation called `el.setPointerCapture()`
  unconditionally on every `pointerdown`, including a plain click with no
  movement. Pointer capture retargets the browser's compatibility `click`
  event to the capturing element too (not just subsequent pointer
  events), so **no day pill was clickable at all** — clicking any pill,
  dragged or not, left the active day unchanged. Missed by the first
  round of browser verification (which checked scroll/chevron behaviour
  but not that a pill click actually switches days) and only caught on a
  second, more careful pass that checked the app's own state after a
  click. Fixed by deferring `setPointerCapture` to the *move* handler,
  only once the 4px drag threshold is actually crossed — a plain click
  now never captures the pointer at all. Reverified: a plain click on a
  pill (with and without a prior scroll), a real drag-then-release, and a
  plain click immediately following a drag all behave correctly end to
  end (seeded 13-day trip, real browser, no mocks).
- Commit message will read `phase 17.1: day dock — single row, never wraps`.

**17.2 Phone: day detail collapse** · Standard · ✅
A phone-only `dayCollapsed` state in `TripEditor` (component-local, never
persisted). `Timeline` gained `collapsed`/`onToggleCollapse` props: the
30px `▼`/`▲` chevron sits in the day header's top line, right of the time
span, and is rendered only when `onToggleCollapse` is passed — i.e. phone
only; desktop passes `undefined` and the column is always open. Collapsed,
the `Timeline` body (everything below the header line) is not rendered,
the `<aside>` drops to `flex-none`, and the map pane switches from
`[flex:0_0_58%]` to `flex-1` so it claims the freed height. MapPane's
existing `ResizeObserver` → `map.resize()` keeps the view centred, so the
collapse doesn't disturb the map. Reset paths: picking any day pill
(`onSelectDay` also clears it), `doAddStopToFocus`, and `commitPlacement`.
Fit trip collapses it on phone — a new `onFitTrip` callback prop on
MapPane fires alongside the internal re-fit; desktop Fit trip ignores it.
Commit: `phase 17.2: phone — collapse the day detail`.

**17.3 Phone: wishlist carousel reachability** · Standard · ✅
The reversal of 12.7's "no wishlist on phone". `WishlistCarousel` gained a
`phone` prop that re-meters it: 124×92 cards (from 178×136), `rounded-11`,
9px gaps, 10px side padding, 24px star buttons, and the desktop `‹`/`›`
arrows dropped entirely — the existing `snap-x snap-mandatory` strip is
touch-scrolled. `TripEditor` renders an `★ Explore N places` glass pill
(`bottom-2 left-2`, 38px, `rounded-[19px]`, gold star) gated on
`phone && dayCollapsed && !cardOpen && !browsing && !picking &&
!placingWish && wishlist.length > 0`; it opens the carousel via the
existing `openBrowsing`. The carousel's own render gate now allows phone
when `dayCollapsed`. A `setDayFolded(next)` helper replaced the bare
`setDayCollapsed` calls so expanding the day detail also clears
`browsing` — the two never share the phone screen. 12.7's entry updated
to point here. Commit: `phase 17.3: phone — reach the wishlist carousel`.

**17.4 Daylight wording split by time of day** · Standard · ✅
New pure `describeDaylight(daylight, arrivalMin, afterDark?)` in
`src/lib/daylight.ts` returns `{ line, token }`. "Dawn" maps to the
engine's `sunrise` (the morning value it already surfaces; there is no
separate `dawn` in `Daylight`). Before noon: `4 h 48 m after dawn · dawn
04:12`, `· first light` appended under 45 min, `Before dawn · dawn 04:12`
before it. From noon: `Daylight until 20:00` plus `· well clear` (>3 h
margin), `· 1 h 0 m left` (under it), or `· after dark` (AFTER_DARK
verdict, or arrival past sunset). Token for the expanded card's computed
strip: `dawn +4:48` / `dusk −7:30` (real minus sign). `PinCard` uses
`.line` when `target.timing` is present, else keeps the old string;
`PinCardExpanded` swaps the Daylight cell value for `.token`. 7 new unit
tests. Commit: `phase 17.4: daylight line reads against dawn or dusk`.

**17.5 Cost marks in itinerary rows** · Cheap · ✅
`StopRow` gained a `cost?: CostsResponse | null` prop and renders a gold
(`text-wishlist`) ` · €`/`€€`/`€€€` band on the meta line after the
kind/dwell — `costBand()` splits 1–50 / 51–250 / 251+, `title` carries
`formatMoney(amount, currency)` (the stop's own currency, unconverted).
Nothing renders when there is no cost or `amount <= 0`. `Timeline` takes
a `costs` prop (passed `records.costs`) and hands each row
`costsFor(costs, 'stop', stop.id)[0]` — the same first-row read
`CostField`/`BudgetPopover` use. Commit: `phase 17.5: cost marks on
itinerary rows`.

**17.6 Fit trip → trip overview** · Standard · ✅
From `design_handoff_map_first_planner(9)/` — the only change in that
revision (diffed against the in-repo `design_handoff_map_first_planner/`).
Fit trip now enters a real no-day-selected state instead of just
re-framing the map.
- **State:** a `tripOverview` boolean in `TripEditor` (not a nullable
  `selectedDayId` — the existing `selectedDayId ?? days[0]` fallback is
  left untouched, the boolean just overrides it). `enterTripOverview()`
  sets it, clears every selection, and on phone folds the day detail;
  `selectDay(id)` — used by pills, day-list rows and day-start pins alike
  — leaves it. `doAddStopToFocus` and `commitPlacement` also leave it.
- **Map (`MapPane`):** a new `overview` prop. `buildDayStartFeatures`
  (`lib/map-features.ts`) builds one Point per day at its starting point —
  the day's first stop, else the resolved start-point (nearest earlier
  non-empty day's last accommodation stop, else its last stop, the same
  rule the column uses), flagged `unplanned` when the day has no stops of
  its own; a day with no anchor anywhere gets no pin. `compositeDayBadge`
  (`lib/map-markers.ts`) draws the 30px badge — accent fill + `oklch(0.90
  0.05 235)` ring, or `control` + dim ring when unplanned — on demand via
  `styleimagemissing` (`d:<n>` / `d:<n>:empty` keys). A `day-starts`
  source + symbol layer; entering the overview flips it visible and hides
  `stops`, `stops-hover` and all five `legs-*` layers via
  `setLayoutProperty`. Clicking a day pin calls `onSelectDay`; a bare map
  click in the overview is inert.
- **Column:** new `TripOverview.tsx` — header `Whole trip` / `N days ·
  <range>`, one 26px-numbered row per day (date, first stop or `no stops
  yet`, span, stop count); a row click selects that day. `Timeline`
  renders it when `overview && onSelectDay`.
- **Day pills:** a 5px leading dot (`oklch(0.46 0.01 250)`, or `oklch(0.16
  0.02 240 / 0.55)` when active); `MapPane` passes `activeDayId={null}` in
  the overview so no pill is active.
- **Not done:** a canvas hover-tooltip on the day pins (the spec's `Day 4
  · starts at Seljalandsfoss` `title`) — GL symbol pins carry no DOM
  title, same as today's stop pins; `startLabel` is kept on the feature
  for when/if map tooltips arrive.
- Browser-verified at 1440px (`.claude/skills/run-etappe/
  overview-17-6-check.mjs`): Fit trip → `Whole trip` list, row click →
  back to the single day, no console errors.
- Commit: `phase 17.6: Fit trip enters a trip overview`.

---

## Phase 18 — Dark-theme debt the handoff mandated

Source: `design_handoff_map_first_planner(9)/CLAUDE_CODE_PROMPT.md` lists
two changes that never got a task — "Two carried-over overlays fail
contrast and must be retrofitted" and "The block editor inside the
expanded card is redesigned". Both were left behind when Phase 12 shipped
(12.x notes the BlockEditor mismatch but calls it out of scope; the
revised handoff pulled it back in). Opened 2026-09-02 at the author's
request ("solve A").

**18.1 Dark-theme retrofit: search overlay + kind picker** · Cheap · ✅
Colour only, per the handoff's own "This is colour only" instruction —
no layout, behaviour, taxonomy or `k`-binding change.
- `SearchPalette`: panel moves to `surface-2` + `border-strong` + the
  spec's `0 24px 60px oklch(0.10 0.01 250 / 0.55)` shadow on the `scrim`
  backdrop. The query input loses its inner white field entirely
  (transparent on the panel, 16px `text`, placeholder `text-4` — the
  reported failure was light-grey-on-white with the typed query lighter
  still). Result rows 44px, name `text-2` lifting to `text` on hover,
  kind tag on `field`/`text-4`. Hover fills `control`; a 2px `accent`
  left edge marks keyboard position, wired to `focus-visible` (the
  component's existing keyboard path — adding arrow-key nav would have
  been the behaviour change the handoff forbids here).
- `KindPicker`: filter field on `field` with `text-4` placeholder and
  `text` typed text; cells `rounded-lg`, transparent at rest with a
  transparent border so the selected cell's 1px border doesn't shift the
  grid; glyphs render `text` at rest (they inherited near-black before —
  `KindIcon` masks to `currentColor`, so the fix is a text colour on the
  cell, not a change to the icon); labels `text-3`. Selected is **gold**
  (`oklch(0.82 0.13 80)` on `oklch(0.26 0.045 80)`, border
  `oklch(0.42 0.09 80)`) rather than accent blue — accent already means
  "selected on the map". Scrollbar retinted via `::-webkit-scrollbar`
  arbitrary variants.
- **Two deliberate deviations, both geometry the spec's own container
  assumes and this one doesn't have:** the picker's popover is 320px
  wide (`PinCardEdit` / `PinCardExpanded`), so the spec's 74×74 cells are
  impossible — 6 columns land at ~47px. Cells keep their existing size,
  and labels went to 10px rather than the spec's 11px, which at 47px
  would truncate almost every label to 4–5 characters (worse than the 9px
  they had). Colour is exactly per spec.
- Verified in a real browser at 1440px
  (`.claude/skills/run-etappe/overlays-dark-check.mjs`): both panels
  screenshot dark, computed backgrounds read `oklch(0.2 0.013 250)` and
  `oklch(0.22 0.012 250)`, zero `slate-*`/`bg-white` classes left in
  either file, no console errors.
- Commit: `phase 18.1: dark-theme retrofit for the search and kind overlays`.

**18.2 Block editor redesign** · Standard · ✅
`BlockEditor.tsx` rebuilt to the handoff's shape: a collapsed list of 42px
rows (`⠿` drag handle, 44px mono type column, one-line summary — note's
first line / link title + bare domain / photo thumbnail + caption / file
name — a static visibility pill and a `✕`) with **one block open at a
time**; the open block becomes a `surface-4` panel whose 40px header
carries the handle, the type label and a segmented visibility control,
over 34px dark fields. Add buttons moved below the list. Zero white fields
left; zero native `<select>`s.
- **Reordering:** the ↑ ↓ buttons are gone. Dragging a row calls a new
  `reorderBlock(pb, siblings, blockId, targetIndex)` (`pb-blocks.ts`) that
  rewrites the affected `order_index` span in one batch, the same shape
  `moveStop` uses — `moveBlock` only ever swapped neighbours, which a drag
  to an arbitrary position can't express. `onMove` is kept for the handle's
  arrow keys, which the handoff explicitly wants as the accessible path.
- **Deletion** asks first for a block that has content (the app's
  click-to-arm two-press pattern, `✕` → `Delete?`), and deletes an empty
  one outright.
- **Three deliberate deviations:**
  1. **Three visibility segments, not the specced two.** The handoff says
     `Trip` / `Private` — "two options do not deserve a dropdown". There
     are three: `public` is what `share.pb.js` publishes (WORK 16.6), so
     dropping it would make a public block unreachable and quietly break
     the read-only link. Same control, one more segment.
  2. The dropzone's constraint line reads `Images · up to 10 MB`, not the
     handoff's `JPG or PNG · up to 12 MB` — `blocks.file` is
     `maxSize: 10485760` with no mime restriction (migration
     `1788000000`), so the specced copy would have been wrong about our
     own backend.
  3. A `+ File` add button was added alongside Note/Link/Photo — `file` is
     a real block kind the old editor could render but never create.
- Verified in a browser (`.claude/skills/run-etappe/block-editor-check.mjs`):
  two collapsed rows, zero `<select>`s in the modal, exactly one open
  block at a time, and the dashed dropzone rendering — no console errors.
- Commit: `phase 18.2: redesign the block editor`.

**18.4 Move the whole trip to different dates** · Cheap · ✅
Author request 2026-09-02, straight after an import landed on the dates
the LLM invented. `setTripStartDate` (`pb-trips.ts`) plus
`TripDatePopover.tsx` in the trip header: the control shows the trip's
span (`Thu 10 Jun – Fri 11 Jun`), opens a date picker for day 1, previews
the delta (`+21 days · ends Fri 2 Jul`) and writes one field.
**One field is the whole change** — CLAUDE.md rule 2 ("dates are derived,
never stored") means every day's date is `start_date + order_index` and
anchors are a time-of-day plus a day reference, so nothing else is
touched and an 08:00 ferry stays 08:00. Verified in a browser
(`.claude/skills/run-etappe/trip-shift-check.mjs`): header span and the
itinerary column's day header both re-derive, no console errors.
Commit: `phase 18.4: move the whole trip to different dates`.

**18.5 Name a cross-pasted import document** · Cheap · ✅
Bug report 2026-09-02: pasting into "Import a trip" reported `title:
Required`, `start_date: Required`, `timezone: Required`, `days:
Required` — four cryptic lines. Cause: the trip format and the Highlights
format share the same `version: 1` envelope, so a Highlights list clears
the version gate and then fails every trip field at once. Both parsers
now check for the other format's array first and return one sentence
naming the mistake and the screen to use instead. Two tests, one per
direction. The prompt templates themselves were correct and unchanged.

**18.3 UncategorizedReview dark pass** · Cheap · ✅
Straight token swap — no redesign in the handoff. `UncategorizedReview`'s
header, dividers and row titles move onto `border`/`text`/`text-4`, and
`Drawer` itself (its only consumer) goes from `bg-white shadow-xl` over
`bg-black/30` to `surface-2` + a side border + `shadow-card` over the
`scrim` token. `TripEditor`'s "Loading trip…" line came along for the
ride. The kind grids inside each row were already fixed by 18.1.

**18.7 A trip document carries day numbers, not dates** · Standard · ✅
Author, 2026-09-02: *"For the export / import of trips we should not need
dates for days. Only day numbering and it starts at the trip date.
Although during import we should ask when the trip should start and preset
the date if it present in the json."*
- Days already carried only `index` — that half was right. What was wrong
  is that `start_date` was **required**, so a portable itinerary still had
  to invent one.
- `start_date` is now `.optional()` in `TripDocV1Schema` and
  `ImportDoc.start_date?: string`. **No new format version:** relaxing a
  constraint keeps every v1 document that parsed before parsing now, which
  is the versioning rule's actual test.
- `commitTripImport` takes `startDate` as an **explicit argument** rather
  than reading it off the document — the date is the importer's question,
  and the document's own value is only a preset. Impossible to forget at a
  call site.
- The preview step asks "When does the trip start?", preset from the
  document when it has a date (saying so) and today's date when it
  doesn't (saying that too), and blocks the commit on a malformed one.
- The prompt template now tells the LLM `start_date` is optional and to
  leave it out rather than invent one, and that days never carry dates.
- `ImportTripDialog` was darkened in the same pass — it was the worst of
  the light-theme surfaces in 18.6 (36 hits → 0) and the one the author
  meets most often.
- Verified end to end (`.claude/skills/run-etappe/import-date-check.mjs`):
  a dateless document imports and the trip lands on the chosen date. The
  first run failed on a *test* bug worth recording — an unscoped
  `input[type="date"]` fill landed on the trip-list form behind the modal,
  not the importer's field; the app was correct throughout.
- Commit: `phase 18.7: a trip document carries day numbers, not dates`.

**18.8 Verified: inserting a day between two days works** · ✅
The author asked whether it was ever built. It was, in 16.2 — the hairline
`+` in each gap of the day dock (`aria-label="Insert a day before Day N"`)
→ `doInsertDay(atIndex)` → `insertDay`, which reindexes the days below and
reports the day-parented blocks whose derived date moved.
`.claude/skills/run-etappe/insert-day-check.mjs` drives the real gesture
between day 3 and day 4 and confirms the day count grows. No code change.

**18.9 Search the wishlist, not just the geocoder** · Standard · ✅
Author, 2026-09-02: *"During search we currently only search external
services. We should first suggest highlights and then with a visual
separator new POIs — otherwise we have no way to find a POI from our
wishlist."* Correct, and it was a real hole: a hundred places imported
from Highlights could only be reached by hunting pins on the map or
scrolling the panel, never by name.
- `SearchPalette` takes `wishlist` + `onPickWishlist`. Matching is local
  and instant (no debounce, no request) against the title **and** the
  kind's label, so "waterfall" finds every saved waterfall. Capped at 6
  rows so the geocoder stays on screen, and skipped entirely when the
  query is a pasted coordinate or URL.
- Two sections: `FROM THE WISHLIST`, then a 1px rule and `NEW PLACES`.
  The separator and the second heading only render when there is
  something above them — a fresh trip sees the old flat list.
- **Picking a saved idea depends on why the palette is open.** From the
  header Search / ⌘K (placement mode) it goes through `placeWishlistItem`
  — the same ranked placement a pin click uses, which promotes the idea
  with its blocks and deletes the poi. From "+ Idea" (wishlist mode) it
  calls `showWishlistItem` and opens the existing card instead, rather
  than quietly creating a second copy of something already saved.
- **Wording:** the request said "new POIs"; the section reads `New places`.
  "POI" appears nowhere else in the UI — the app says "place", "idea",
  "wishlist" — and one screen using the internal term would be the odd one
  out. One word to change if the author disagrees.
- Verified in a browser
  (`.claude/skills/run-etappe/search-wishlist-check.mjs`): both headings
  render, and the DOM order puts the wishlist section above the new
  places. No console errors.
- Commit: `phase 18.9: search the wishlist alongside the geocoder`.

**18.6 The rest of the light-theme debt** · Standard · ✅ (2026-09-03)
Every remaining light surface moved onto the dark tokens — mechanical
class swaps, no layout or behaviour change:
- `HighlightsImportDialog` (was 45 hits): panel on `surface-2` +
  `border-strong` over the `scrim`; textarea/error/progress/buttons and
  the per-row dedup decision chips all retinted (active → `accent`,
  warnings → `warn-*`, errors → `danger-*`).
- `ShareView` (22) — the public read-only page: `bg` ground, `surface-2`
  header and day cards, links → `accent`, warnings → `warn-*`. The
  handoff says dark only, no light variant, so the share page follows.
- `TripList` (18) + `App`'s own shell/header: `surface-2` panels, `field`
  inputs, `accent` primary buttons, `bg` ground.
- `PlacementPicker` (14): `surface-2` sheet, rows get the `focus-visible`
  accent left-edge the search overlay uses, the added-time chip →
  `accent-surface`/`accent`.
- `MergePrompt` (9), `LoginForm` (8): same treatment.
- `MapPane`'s dev-only Nearby control (7) — the white box top-left in
  every screenshot — now a glass chip on the dark tokens.
The only `slate`/`bg-white` grep hit left is `DayPills`'
`hover:bg-white/5`, a deliberate white-alpha hover over the glass pill.
- Verified: `.claude/skills/run-etappe/dark-sweep-check.mjs` screenshots
  the login screen, trip list and Highlights dialog; computed
  backgrounds all read `oklch(0.2 0.013 250)`, none near-white.
- Commit: `phase 18.6: dark-theme the last light surfaces`.

**18.6 (original note)** Auditing for 18.3 showed the "Noticed" note's "three
surfaces" was an undercount — these are still fully light, by hit count
of `slate-*` / `bg-white` / `text-red-*` / `sky-*` / `amber-*`:
`HighlightsImportDialog` 45 · `ShareView` 22 · `TripList` 18 ·
`PlacementPicker` 14 · `MergePrompt` 9 · `LoginForm` 8 · `MapPane` 7 (the
dev-only Nearby control — the white box top-left in every screenshot).
`DayPills`, `WishlistCarousel` and `TripEditor`'s remaining hits are false
positives (`bg-white/5`, `left-1.5`). `ImportTripDialog` was the worst of
them at 36 and is already done, in 18.7.

None of these are in the handoff — it only ever specced the two overlays
and the block editor — so this is a consistency pass, not spec work.
`HighlightsImportDialog` is the obvious next one: same shape as the trip
importer that 18.7 just darkened.

---

## Phase 18 (cont.) — a batch of author fixes, 2026-09-02

Five things in one message ("Okay, a few things.").

**18.10 Search opens the card first** · Standard · ✅
Author: *"Search will always first open a POI/Wishlist card, from there we
can add it to the itinerary."* Before this, picking a search result went
straight into the ranked `PlacementPicker` — a commit before a look, the
one place in the app that still worked that way.
- A geocoder result (or a pasted coordinate / Maps link) now opens the
  unified card in **empty mode** for that place; its `+ Day` runs the
  placement, `+ Wishlist` saves it as an idea. A pasted Maps link rides
  along on the new `emptyCard.sourceUrl` / `CardTarget` field so either
  action can still attach it as a link block.
- A wishlist match (18.9) opens its card from Search now too, not just
  from `+ Idea` — `showWishlistItem` unconditionally. The card's "Add to
  itinerary" still runs the same ranked placement, just after a look.
- `addPlaceStop` deleted — nothing called it once search stopped
  capturing directly.
- Verified: `.claude/skills/run-etappe/batch-18-check.mjs` — a search pick
  opens the card, no placement picker.

**18.11 Wishlist pin style toggle: photo ↔ icon** · Standard · ✅
Author: *"A small toggle to change the wishlist items on the map from
thumbnails to icons (waterfall etc)."*
- `compositeWishlistPin` takes an optional `glyph: { atlas, iconName }`;
  in icon mode `drawWishSquare` fills the category-colour tile and blits
  the kind's sprite glyph as a white cutout (`drawAtlasGlyphWhite`, new,
  the canvas mirror of `KindIcon`'s CSS mask) instead of the photo. The
  amber border still marks it as a wishlist pin.
- `MapPane` gains `wishlistPinMode`; loads the sprite atlas once, on
  demand, only in icon mode; the cover effect branches on it and its
  signature keys on `I:<star>:<kind>` so a mode flip re-composites every
  pin without a photo fetch.
- The toggle (`▦` / `❖`) sits in the `WishlistPanel` header — the
  wishlist's own control surface. Per-viewer preference in
  `localStorage` (`etappe.wishlistPinMode`), default photo. Desktop only,
  like the panel.
- Verified: batch-18-check confirms the toggle flips and persists;
  screenshot shows the white waterfall glyph on the map pin.

**18.12 Day-dock drag "mouse gets caught" bug** · Standard · ✅
Author: *"sometimes the mouse gets caught and with every movement we
scroll the panel."* Cause: `drag.current` in `DayPills` was only ever
half-cleared (`dragging = false`) and never nulled, so after a pointerup
this handler never saw (released over the map, off-window, before the 4px
threshold armed pointer capture) it kept a stale `startX`. The next hover
`pointermove` read a large `dx`, crossed the threshold, and started
panning on movement alone.
- `onPointerMove` now disarms on `e.buttons === 0` — a hover carries no
  buttons, so that *is* the lost pointerup.
- `endDrag` nulls the whole record (immediately for a plain click,
  after one tick for a real drag so the compat click is still
  suppressed).
- `onPointerDown` ignores non-primary buttons.
- Verified: `.claude/skills/run-etappe/daypill-drag-check.mjs` simulates
  a press released off the rail, then hovers across it — `scrollLeft`
  unchanged; plain click still selects; real drag still pans without a
  day switch.

**18.13 Cover thumbnail follows the topmost image** · Standard · ✅
Author: *"Thumbnails should always be created from the top most image. If
multiple images are reordered a new thumbnail must be created."* Root
cause: the capture and Highlights-import paths create blocks with **no
`order_index`** (only the card's own `addBlock` set one), so `blocksFor`
sorted them all as 0 and "the first photo" — the row thumbnail, the map
pin, the card cover — was whatever order the fetch returned, not the
order the photos were listed in.
- `blocksFor` gains a `created` tiebreaker: with no `order_index`, blocks
  order by creation, which *is* the listed order (the importer creates
  them in `photos[]` order). An explicit `order_index` from a drag
  reorder still wins.
- The Highlights importer now writes an explicit incrementing
  `order_index` across all block kinds, so a later reorder starts from a
  clean 0..n. (`import-trip-commit` already did.)
- "A new thumbnail on reorder" already holds: the cover is derived, and
  PocketBase generates the `80x80` thumb for whichever photo is now first
  on its next request.
- 6 new unit tests (`pb-blocks.test.ts`) over `blocksFor`'s ordering and
  `reorderBlock`'s span rewrite.

**18.14 Coordinate paste in All details** · Cheap · ✅
Author: *"The location position in full details should accept a lon, lat
paste as it comes from google."* Pasting `64.1466, -21.9426`, DMS, or a
Google Maps URL that carries coordinates into **either** the Latitude or
Longitude field now fills both — via `sniffPaste` on the `onPaste`, which
`preventDefault`s only for a real coordinate pair so a bare number still
types normally. The fields re-key on `stop.lat`/`stop.lon` so the pasted
values show without a card reopen.
- Verified in batch-18-check: pasting the pair into Latitude fills both.

**18.15 Browse a stop's other photos in All details** · Standard · ✅
Author: *"when there are multiple photos, there is no way in the detail
view (or anywhere) to check the other photos."* Right — `PinCardExpanded`
showed `photos[0]` behind a dead `1 / N` badge, and nothing else in the
app pages through them.
- The left photo pane became a small gallery: `‹`/`›` buttons over the
  image (only with >1 photo), a live `<idx> / <count>` counter, the
  attribution line follows the shown photo, and — desktop only, where the
  pane is full-height — a scrollable thumbnail strip along the bottom
  with the active thumb ringed in `accent`. Phone (192px pane) keeps just
  the arrows and counter.
- Local `photoIdx` state, clamped when the block list changes; `‹`/`›`
  wrap. Photo order is `blocksFor`'s cover order (18.13), so thumb 1 is
  the pin/row cover.
- Verified: `.claude/skills/run-etappe/photo-gallery-check.mjs` — a
  2-photo idea shows the strip and both nav arrows, the counter advances
  and wraps.

---

## Noticed

Append anything found along the way that is worth doing but is not in the
current task. Do not act on it in the same commit.

- Stop deletion via the **Delete/Backspace keyboard shortcut**
  (`deleteSelected` in `TripEditor.tsx`) still has **no confirmation** —
  it deletes the instant the key is pressed. (The row ✕ this note
  originally meant was removed entirely in the Phase 12 redesign — the
  card's own `Remove`/`Delete` button is the only per-item delete
  affordance now, and it already asks twice, made more visible 2026-09-02
  to show "Delete stop?"/"Delete idea?" on screen instead of relying on a
  hover tooltip — see `ToDo.md`.) Add a confirm here too before v1, or
  decide deliberately that a keyboard shortcut trading safety for speed is
  the point of it and leave it — author's call, not made unasked.
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
  (Stale as of 12.4: this used to end by pointing at the `auto/icons/
  thumbnails` map control as where a stop's own photo would eventually
  show — that control no longer exists, retired along with the rest of
  BUILD §5.3's marker-tier system. A stop pin has no photo mode any more;
  see WORK 12.4.)
- **Day pills need a "whole trip" pill eventually** (author note, 2026-09-01,
  ahead of WORK 12.5), alongside the per-day pills — a mode showing every
  day at once rather than filtering to one focused day (WORK 12.4's
  day-scoped stop pins). What that overview should actually render is an
  open design question, explicitly deferred: current lean is start/end of
  each day only (i.e. each day's accommodation stops, or first/last stop if
  a day has none), not every stop and not wishlist highlights — but this
  needs a real design pass before building it, not a default assumed here.
  Do not build this as part of 12.5; add it as its own task once the
  content question is settled.
- **Light-theme leftovers inside the dark card.** `KindPicker`'s filter
  input still carries `border-slate-300` and renders as a stark white box on
  the dark panel, and `UncategorizedReview` is a fully light drawer. Same
  family as the `BlockEditor` mismatch already noted above. The icon grid
  itself was fixed (icons take `currentColor`, selected is `wishlist` gold),
  so what is left is chrome, not content — worth one pass over all three
  surfaces rather than three separate touch-ups.
- **`run-etappe` driver is stale after 12.5/12.6.** Its `createAndOpenTrip`
  waits for a `+ Day` text button that the day rail retirement removed —
  the day switcher is now the `+` pill in `DayPills` (`aria-label="Add
  day"`). The driver fails before reaching the editor, so the built-in
  smoke flow (add day → stop → access point) no longer runs. Needs its
  selectors updated to the redesign shell (`+ Day` → the pill, `+ Stop`
  still exists, kind-badge select still works). Not fixed here — 12.10 was
  verified with a throwaway one-off script instead.