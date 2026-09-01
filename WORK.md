# WORK.md — Etappe build order

Ordered tasks. Do them in sequence; each phase assumes the previous one is
merged and `npm run check` passes. Specification is in `BUILD.md`, rules in
`CLAUDE.md`.

## Status — updated 2026-08-31

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
**→ Next, in order:** the map-first redesign has been picked (over 8.2, the
full multi-day §8 import wizard, which is now deferred) — see Phase 12
below. `design_handoff_map_first_planner/README.md` is the pixel-accurate
spec; it formalizes and supersedes `ToDo.md`'s "Design direction" notes.
12.1–12.6 are done plus 12.8 (wishlist photos stored server-side), 12.9
(access-point picking mode) and 12.10 (wishlist carousel + persistent
starring) — the redesign's desktop shell is in: design tokens,
unified pin-click card, expanded full-details card, pin visuals, day
pills/Fit trip, the map-dominant shell itself, the access-point picking
mode and the wishlist "photo wheel".
The handoff was revised 2026-09-01 (`design_handoff_map_first_planner`,
in place — the old copy is superseded) with two new surfaces: a built
wishlist carousel and a proper access-point picking mode — 12.10 and 12.9,
now both done.
**Phase 13 (day-start continuity — a day leaves from the previous day's
accommodation via a routed leading leg) is done: 13.1 schema+cascade, 13.2
leg lifecycle+routing, 13.3 rendering+editor.**
**→ Next, in order: 12.7 (phone layout, also what fixes the
sub-860px view 12.6 deliberately let break) → 12.11 (cleanup).**
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

**12.7 Phone layout** · Standard
`<860px`: map takes `flex:0 0 58%`, itinerary column fills the rest below
it, day pills/wishlist panel/desktop card all suppressed. Compact phone
card (not the full card) with horizontal swipe navigation (>40px
threshold, same step function as the desktop card's `‹`/`›`) and a looping
chevron nudge as the discoverability cue; edit region uses 44px targets.
Drag-to-expand and a rubber-band swipe transform are explicitly not built.

**12.9 Access-point picking mode** · Standard
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

**12.11 Cleanup and polish** · Cheap
Dead-code removal for everything retired in 12.5/12.6, keyboard shortcuts
re-verified (`k` still opens the kind picker from the card), `npm run
check` and `npm run format:check`, this file and `ToDo.md` updated to
reflect the shipped design. (Renumbered from a second "12.8" heading.)

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
- **`run-etappe` driver is stale after 12.5/12.6.** Its `createAndOpenTrip`
  waits for a `+ Day` text button that the day rail retirement removed —
  the day switcher is now the `+` pill in `DayPills` (`aria-label="Add
  day"`). The driver fails before reaching the editor, so the built-in
  smoke flow (add day → stop → access point) no longer runs. Needs its
  selectors updated to the redesign shell (`+ Day` → the pill, `+ Stop`
  still exists, kind-badge select still works). Not fixed here — 12.10 was
  verified with a throwaway one-off script instead.