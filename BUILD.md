# BUILD.md — Etappe specification

Complete design. Read together with `CLAUDE.md` (rules) and `WORK.md` (tasks).

---

## 1. Concept

A trip is an ordered chain of **stops** connected by **legs**, grouped into
**days**. A stop is anywhere you stop and do something: an airport, a waterfall,
a restaurant, a hotel. A leg is the movement between two consecutive stops.
Activities hang off stops, not legs — a two-hour walk around a waterfall starts
and ends at the same place.

Hub-and-spoke travel needs no special type: if the same hotel ends day 3 and
starts day 4, you are staying put. The one structural rule is that every day
must end at a stop flagged `is_accommodation`.

A day can also name a **start point** (`days.start_stop`) — an existing stop,
normally the previous day's accommodation, that it leaves from in the morning.
It's a pointer, not a copy: re-booking that hotel is a one-stop edit, and every
day pointing at it re-routes. The pointer adds a **leading leg** from the start
point to the day's first stop, and the day default (09:00) becomes the moment
you leave the start point rather than the moment you reach the first stop. Day 1
has no start point; a day with the pointer cleared is an island, timed from its
own first stop as before.

Etappe does not navigate. It plans, and it tells you what to do on which day.
Turn-by-turn is handed to Google Maps or Komoot via deep links.

First real trip: a twelve-day Iceland ring road. The design must suit that
without being specific to it.

---

## 2. Data model (PocketBase collections)

### trips
| field | type | notes |
|---|---|---|
| `title` | text | |
| `start_date` | date | the only absolute date in the system |
| `timezone` | text | IANA, default `Atlantic/Reykjavik` for the test trip |
| `currency` | text | ISO 4217, default EUR |
| `car_buffer_pct` | number | default 5 |
| `default_dwell` | json | kind → minutes, seeded from the taxonomy, editable |
| `owner` | relation → users | |
| `share_token` | text | random 22 chars, regenerable, indexed |
| `share_enabled` | bool | |

### trip_members
`trip` · `user` · `role` (`owner` | `editor` | `viewer`). Owner row created
with the trip.

### days
`trip` · `order_index` (int) · `title` · `kind` (`travel` | `rest`) · `notes` ·
`start_stop` (relation → stops, optional, no cascade delete).

Date is computed as `trip.start_date + order_index`. Inserting a day means
incrementing `order_index` on everything after it, in one transaction.
`start_stop` points at the stop this day leaves from (§1); deleting that stop
clears the pointer rather than cascading.

### stops
| field | type | notes |
|---|---|---|
| `day` | relation | |
| `order_index` | int | |
| `title` | text | |
| `kind` | select | closed enum, §7 |
| `kind_confirmed` | bool | false for anything auto-derived |
| `lat`, `lon` | number | |
| `address` | text | |
| `is_accommodation` | bool | |
| `anchor_time` | text | `HH:MM` or empty; pins the stop to the clock |
| `anchor_type` | select | `arrival` \| `departure` |
| `dwell_override` | number | minutes; null means "sum of activities" |

### activities
`stop` · `order_index` · `title` · `duration_min` · `kind` (`activity` |
`break`) · `notes`. A pause is an activity with kind `break` and no location.

### legs
| field | type | notes |
|---|---|---|
| `from_stop`, `to_stop` | relation | |
| `mode` | select | `car` \| `walk` \| `flight` \| `ferry` \| `bike` \| `other` |
| `surface` | select | `paved` \| `gravel` \| `froad` — car only, recorded not applied |
| `duration_min` | number | what the engine said, before buffer |
| `duration_override_min` | number | 0 → use `duration_min`; keeps the route |
| `distance_m` | number | |
| `geometry` | json | GeoJSON LineString |
| `routing_source` | select | `ors` \| `here` \| `osrm` \| `manual` — which engine answered; `manual` = none could |
| `buffer_override` | text | `"12%"` or `"12"` (minutes); `""` → trip default |
| `seasonal_warning` | bool | set on F-roads |

Legs are never created by hand. Inserting a stop between two others splits the
existing leg into two and re-routes both; deleting a stop merges its two legs
into one and re-routes.

### blocks
The flexible information layer. Attaches to any parent.

`trip` (denormalised, for API rules) · `parent_type` (`trip` | `day` | `stop` |
`leg`) · `parent_id` · `kind` (`note` | `link` | `photo` | `file`) ·
`visibility` (`private` | `trip` | `public`) · `title` · `body` (markdown) ·
`url` · `file` (PocketBase file field) · `order_index`.

Photo and file blocks also carry `lat`, `lon`, `taken_at` from EXIF on upload,
plus `attribution_author`, `attribution_licence`, `attribution_url` for
Wikimedia images. **Populate these from day one** — they cost an hour now and
are what the future photo album needs.

### costs
`trip` · `parent_type` · `parent_id` (nullable) · `label` · `amount` ·
`currency` · `category` · `is_estimate`.

### pois
Wishlist. `trip` · `title` · `kind` · `lat`, `lon` · `notes` · `url` ·
`status` (`idea` | `scheduled` | `rejected`).

### route_cache
`key` (sha256 of `from_lat,from_lon,to_lat,to_lon,profile`, indexed unique) ·
`duration_min` · `distance_m` · `geometry` · `created`.

### API rules
`viewer` may list and view; `editor` may create, update and delete; `owner`
additionally manages members and the share token. Blocks with visibility
`private` are readable only by their creator. The public share view does not
use collection rules at all — see §10.

---

## 3. Cascade engine

`src/lib/cascade.ts`, pure, no imports from React or the network.

Input: the full trip document. Output: for each stop an `arrival` and
`departure` time, for each leg an `effective_duration`, and a list of warnings.

**Algorithm, per day:**

1. Find the first anchor. If none, start from a day default (09:00) — which,
   when the day has a `start_stop` (§1), is when you *leave the start point*,
   so `arrival(0) = 09:00 + effective_duration(leading leg)`. An anchor pins a
   stop's own clock and back-derives as before; the leading leg only shifts the
   untimed morning departure.
2. Walk forward: `arrival(n) = departure(n-1) + effective_duration(leg)`;
   `departure(n) = arrival(n) + dwell(n)`.
3. `dwell` = `dwell_override` if set, else the sum of the stop's activity
   durations, else the taxonomy default for its kind.
4. `effective_duration` = `base + buffer` for car legs, where `base` is
   `duration_override_min` when set and `duration_min` otherwise; raw
   `duration_min` for every other mode. The buffer is
   `buffer_override` when the leg carries one — a percentage of `base`, or a
   flat number of minutes — and `base × car_buffer_pct / 100` otherwise.
   **Round the buffer half up to a whole minute before adding it**, so the
   parts a reader sees add up to the total they see. Clock arithmetic
   operates only on integer minutes, so two implementations cannot drift by
   a minute on the same input.
5. Where a downstream anchor exists, compare computed arrival against it. Later
   than the anchor → a `MISSED_ANCHOR` warning carrying the deficit in minutes.
   The anchor still wins for everything below it, so a single delay does not
   corrupt the rest of the day.

**Warnings emitted:**

| code | condition |
|---|---|
| `MISSED_ANCHOR` | computed arrival later than a pinned time |
| `NO_ACCOMMODATION` | day does not end at an `is_accommodation` stop |
| `AFTER_DARK` | arrival later than sunset; carries the deficit |
| `LONG_DAY` | total elapsed exceeds 12 h (counts the leading leg, §1) |
| `FROAD_SEASON` | F-road leg on a date outside 15 Jun – 10 Sep |
| `UNCATEGORIZED` | stop kind is `uncategorized` |

Warnings are data, never thrown. The UI decides how loud to be.

**Daylight:** SunCalc, using the day's first stop coordinates and the computed
date, gives sunrise, sunset and civil dusk. Handle polar edge cases — in an
Icelandic June there is no sunset and the band simply does not render.

The engine does **not** call SunCalc itself. Daylight arrives as an injected
`DaylightProvider` — `(date, lat, lon) => {sunrise, sunset, dusk} | null` —
with the SunCalc implementation supplied by the app and a fixed stub supplied
by tests. Otherwise every `AFTER_DARK` assertion silently depends on the real
solar position for a real date, and the fixture becomes a test that fails for
reasons unrelated to the code under test.

---

## 4. Routing

OpenRouteService, `driving-car` profile, called **only** from a PocketBase hook
so the key never reaches the browser. Response gives duration, distance and
GeoJSON geometry.

Every response is written to `route_cache` keyed by the coordinate pair before
use, and the cache is consulted first. Repeated editing of a trip costs nothing
after the first pass. Free tier is ~2000 calls/day, far beyond need.

Wrap it behind `RoutingProvider` with a single `route(from, to, profile)`
method so a self-hosted OSRM or Valhalla can replace it without touching app
code.

Non-car legs are not routed. Walk and hike durations are entered manually with
an optional Komoot link; flight and ferry durations are entered manually and
drawn on the map as great-circle or straight lines.

**Buffers.** Trip-level `car_buffer_pct`, default 5, overridable per leg. The
per-leg `buffer_override` carries its own unit: `"12%"` scales with the leg,
`"12"` is twelve flat minutes — a short drive wants the second, since 5 % of
eight minutes rounds away. The row shows the arithmetic, `2h19 + 7 = 2h26`,
rather than one total: the routed number is the engine's and the padding is
the planner's, and they should not look like one figure.

A leg's `surface` is **recorded, not applied**. Earlier versions multiplied by
1.0 / 1.3 / 2.0 on top of the engine, which counted the same fact twice — a
routing engine already slows for gravel and for a highland track. Setting a
leg to `froad` still sets `seasonal_warning`.

**Overriding a duration.** `duration_override_min` replaces what the engine
said without discarding how it got there: the geometry, the distance and the
engine's own `duration_min` all stay, so the map still draws the road, a
re-route still refreshes it, and both numbers can be shown. That is different
from `routing_source: 'manual'`, which means the leg was never routed at all
— no road near a trailhead, or a ferry.

---

## 5. Map

MapLibre GL JS, OpenFreeMap vector tiles, tile URL in a single env var so
MapTiler can replace it.

**Leg colouring.** Each day takes a hue from a fixed palette, cycled past ten
days. Each leg derives two colours from that hue in OKLCH — dark at L≈45%,
light at L≈65% — alternating by leg index within the day. Both are stored as
feature properties.

Two line layers over one source: one painted with the flat day hue, one with
the alternating shades, crossfading by `line-opacity` between z8 and z10. A
step or interpolate on colour directly produces muddy intermediates; opacity
crossfade does not. Line width scales with zoom. A symbol layer draws direction
arrows along each leg. Legs whose computed drive time falls after civil dusk
get a dashed overlay in the same hue.

**Markers, three tiers.**

- Below z7: accommodation stops only. Twelve pins for a twelve-day trip, so the
  route shape stays readable.
- z7–z9: kind icons from the sprite sheet.
- Above z9: photo thumbnails where an image exists, icons where none does.

Icons come from **Maki** and **Temaki** (both public domain, both used by the
OSM iD editor). A build step rasterises only the kinds in the taxonomy into a
MapLibre spritesheet — no runtime SVG work.

Thumbnails are 64×64 circular crops with a 2 px ring in the day hue and a small
kind-icon badge lower-right. They render as a **symbol layer** via
`map.addImage`, not as DOM markers: DOM markers are easier to style but get no
collision detection, which is the entire problem being solved. Composite the
crop, ring and badge on an offscreen canvas and cache the result in IndexedDB
keyed by file hash. This pipeline is also what the future album needs.

Collision: `icon-allow-overlap: false` with `symbol-sort-key` ranking
accommodation, then anchored stops, then the rest. Crowded areas drop
low-priority pins rather than stacking them.

The icons/thumbnails crossfade uses the same z8–z10 window as the leg colours,
so the map has one coherent transition. A three-way control (auto / icons /
thumbnails) overrides it.

**Image sources.** User upload, with PocketBase generating the thumb
server-side via its thumb parameter. Or Wikimedia Commons: where Photon returns
an OSM `wikidata` tag, resolve it through the Wikidata API to a Commons image.
Prefer Commons over general web images — the licences are explicit, and author,
licence and source URL are stored on the block and rendered as attribution in
the share view and PDF.

---

## 6. Adding stops and POIs

Five capture paths, one `stops` record.

1. **Search (`⌘K`)** — Photon typeahead, returns name, coordinates and OSM tags.
2. **Map click** — reverse-geocode for a name suggestion; accept or rename.
   This is how unnamed laybys and blog coordinates get in.
3. **Paste** — one input that sniffs the content: a Google Maps URL (including
   `maps.app.goo.gl` short links, resolved in a hook because the redirect is
   CORS-blocked in the browser), a Komoot tour URL, an address, or coordinates
   in decimal or DMS. The original URL is kept as a link block.
4. **Share target** — the PWA manifest registers `share_target`, so Android's
   share sheet lists Etappe. Captures land in the wishlist with the link
   attached. Roughly twenty lines, and the most-used path while travelling.
5. **Nearby** — an Overpass query for tourism POIs within an adjustable
   corridor (default 5 km) of the current day's route. Results are ghost pins;
   one click promotes them.

**Placement.** Rather than asking which slot, route the candidate into every
gap in the day and rank by added time:

> Kerið · between Gullfoss and Hótel Skálholt **+14 min** · between KEF and
> Gullfoss +38 min · new stop on day 2 +9 min

Pick a row or override by dragging. Each option is one cached ORS call.

**On create**: name, coordinates, address and kind (from OSM tags where
present) are filled in; the kind sets the default dwell. A stop within 100 m of
an existing one prompts to merge instead of duplicating.

Anything captured without a slot goes to the wishlist. Wishlist POIs falling
within a day's corridor are badged on that day.

---

## 7. Taxonomy

Closed enum. Adding a member means adding a sprite and a default dwell.

| kind | dwell | | kind | dwell |
|---|---|---|---|---|
| `waterfall` | 45 | | `town` | 90 |
| `canyon` | 60 | | `restaurant` | 60 |
| `glacier` | 90 | | `hotel` | — |
| `hot_spring` | 120 | | `campsite` | — |
| `volcano` | 90 | | `airport` | 60 |
| `cave` | 60 | | `ferry` | 30 |
| `lake` | 30 | | `fuel` | 15 |
| `coast` | 45 | | `shop` | 30 |
| `viewpoint` | 20 | | `pool` | 90 |
| `hike` | 180 | | `wildlife` | 45 |
| `museum` | 90 | | `parking` | 5 |
| `monument` | 30 | | `other` | 30 |
| `church` | 20 | | `uncategorized` | 30 |

**Who assigns it:**

1. The LLM you prompt yourself during import sets `kind` in the JSON, enum-
   constrained, validated by Zod. No API call from the app.
2. OSM tags from Photon or Overpass map deterministically via a lookup table
   (`waterway=waterfall` → `waterfall`). Sets `kind_confirmed = false`.
3. Everything else is `uncategorized`.

`uncategorized` is a real enum member with its own marker — hollow circle in
the day hue, no glyph — so it reads as "needs attention" rather than as a
legitimate kind.

Manual editing: `k` opens an icon grid, type to filter, enter. Changing the
kind updates the dwell unless it has been overridden. The trip header shows an
uncategorized counter; clicking it opens a list of just those stops with the
icon grid inline, so twenty get cleared in a couple of minutes.

---

## 8. Import and export

Import is the primary way a trip is created: you ask an LLM for an itinerary in
your own chat window, paste the JSON, and edit from there.

**Schema principles.** Coordinates are optional — an LLM will confidently
invent them. Place names are required and are geocoded on import. `kind` is
enum-constrained. Times are `HH:MM` local, never absolute timestamps. Days are
identified by index, not date.

```json
{
  "version": 1,
  "title": "Iceland ring road",
  "start_date": "2026-09-12",
  "timezone": "Atlantic/Reykjavik",
  "days": [
    {
      "index": 1,
      "title": "KEF to Skálholt",
      "kind": "travel",
      "stops": [
        {
          "title": "Keflavík airport",
          "kind": "airport",
          "place_hint": "Keflavík International Airport, Iceland",
          "lat": 63.985, "lon": -22.605,
          "anchor_time": "10:25",
          "anchor_type": "arrival",
          "dwell_min": 65,
          "notes": "Pick up 4x4",
          "activities": [],
          "links": [{"url": "...", "title": "Rental booking", "visibility": "private"}]
        },
        {
          "title": "Gullfoss",
          "kind": "waterfall",
          "place_hint": "Gullfoss waterfall, Iceland",
          "activities": [
            {"title": "Walk around the falls", "duration_min": 120,
             "url": "https://www.komoot.com/tour/..."}
          ]
        },
        {
          "title": "Hótel Skálholt",
          "kind": "hotel",
          "is_accommodation": true,
          "place_hint": "Skálholt, Iceland"
        }
      ],
      "legs": [
        {"from": 0, "to": 1, "mode": "car", "surface": "paved"},
        {"from": 1, "to": 2, "mode": "car", "surface": "gravel"}
      ]
    }
  ]
}
```

Legs carry no durations — those come from ORS during the wizard's routing step.
For `fixtures/iceland-day1.json` the routing step is stubbed with the values in
§12 (100 min / 118 km and 40 min / 44 km) so the fixture is deterministic.

**Wizard steps:** paste → Zod validation with readable per-field errors →
geocode each `place_hint` via Photon and confirm matches on a map, ambiguous
ones flagged → route car legs via ORS → preview the full cascade with warnings
and the uncategorized count → commit, or go back.

Ship the schema and a ready-made prompt template on the import screen, so the
text you paste into an LLM reliably produces something that validates.

Export writes the same format, so trips round-trip.

---

## 9. Screens

**Desktop (≥1280), three panes.**

- Left rail (~220 px): days as a list with computed dates and a one-line
  summary, drag to reorder, insert-day affordance between any two, then the
  wishlist below, draggable onto the timeline.
- Centre: the timeline. **Days are headers, not tabs** — the pane scrolls
  continuously through the whole trip so day boundaries are visible and stops
  can be dragged across them. Rows alternate stop and leg. Computed times are
  muted, anchors are full-contrast with a pin icon. Right-hand icons on each
  stop indicate attached blocks.
- Right (~380 px): map on top, inspector below. Selecting a stop fills the
  inspector without a modal, so map, timeline and block editor are all visible.
  That is the reason to plan on a laptop.

Hover a stop and its marker lifts; hover a leg and the map fits its bounds.

**Keyboard:** `n` new stop, `d` new day, `k` kind picker, `p` cycle a block's
visibility, `⌥↑/↓` move a stop, `⌘K` place search. Multi-select stops and shift
them all by an offset.

**900–1280:** map collapses to a toggle. **Below 900:** single column.

**Mobile** is a companion, not a squeezed workspace. It opens on today, swipes
between days, and exposes only the edits you would make at a trailhead: adjust
a dwell, reorder the next two stops, add a photo or note, open a booking, tap
out to Google Maps or Komoot. Structural editing — inserting days, moving stops
between days, import — is desktop-only.

**Other screens:** trip list, full map, budget, wishlist, uncategorized review,
import wizard, share view, print view.

---

## 10. Sharing, PDF, offline

**Share link** is served by a PocketBase JS hook at `/api/share/:token`, which
assembles the payload with only `public` blocks. Expressing three-level
visibility in collection API rules is harder and easier to get wrong. The share
view is read-only, has no auth, and renders the same cascade output as the
editor.

**PDF** is the browser print stylesheet — no headless Chrome on the server. One
page per day: timeline, map image, public and trip-level blocks, attribution
for any Commons photos. Each day's map is rendered client-side from the
MapLibre canvas to PNG and placed in the print flow. A checkbox controls
whether `private` blocks are included, defaulting to yes for personal copies
and forced off for the share view.

**Offline is read-only in v1.** A service worker caches the app shell;
`persistQueryClient` keeps the active trip in IndexedDB. Today's plan works in
a valley with no signal because the cache was persisted, not because sync was
written. Editing requires a connection.

---

## 11. Deployment

One container on Coolify. PocketBase serves the built SPA from `pb_public`, so
there is no separate web server and one volume to back up. Schema changes made
in the admin UI generate migrations in `pb_migrations` — commit them, or
production drifts from local.

Environment: `ORS_API_KEY`, `TILE_URL`, `PHOTON_URL`, `OVERPASS_URL`,
`APP_URL`. The last three are build-time only, baked into the SPA bundle by
`docker-compose build` — see `.env.example`. `PB_ADMIN_EMAIL` /
`PB_ADMIN_PASSWORD`, if set, bootstrap the first superuser on container start
(`scripts/docker-entrypoint.sh`); otherwise create one by hand via
`pocketbase superuser upsert`. Hooks live in `pb_hooks/` and run in Goja —
roughly ES2015, no npm. Keep them small: the share endpoint, the ORS proxy,
the short-link resolver.

---

## 12. Worked example — Iceland day 1

The canonical fixture: `fixtures/iceland-day1.json`. Trip buffer 5%, date
2026-09-12.

| time | item | detail |
|---|---|---|
| 10:25 | Keflavík airport | anchor, arrival · dwell 65 (pick up 4×4) |
| | leg, car, paved | routed 100 min + 5 = 105 min · 118 km |
| 13:15 | Gullfoss | activity: walk the falls, 120 min, Komoot link |
| | leg, car, gravel | routed 40 min + 2 = 42 min · 44 km |
| 15:57 | Hótel Skálholt | accommodation |

Totals: 65 + 105 + 120 + 42 = 332 min, so 5 h 32 elapsed and 162 km.

The gravel leg is *not* scaled for its surface — the engine's 40 minutes
already account for the road. Only the 5 % buffer is added, and it is
rounded (2.0 → 2) before being added.

Departure at 11:30 is fixed by the plan ("pick up the 4×4, leave at 11:30"), so
the 65-minute dwell is an input, not a free parameter. The ORS durations are
chosen round to keep the expected values readable — they are fixture inputs,
not measurements.

Sunset at Skálholt on 12 September is around 20:15, so this day emits **no
warnings at all**. That is deliberate: the canonical fixture proves the happy
path, and each warning code gets a fixture that isolates it.

`AFTER_DARK` is covered by the same day with the daylight stub returning a
15:56 sunset, expecting one warning with a deficit of 1 min. Use a stub rather than a real winter date; the point is to test the
comparison, not SunCalc.

The §12 table, the §8 JSON snippet and `fixtures/iceland-day1.json` must agree
exactly. If a change touches one, it touches all three.