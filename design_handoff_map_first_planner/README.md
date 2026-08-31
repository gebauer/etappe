# Handoff: Etappe — map-first planner redesign

## Overview

A visual/layout redesign of Etappe's desktop trip editor and its phone companion view. It replaces today's fixed three-pane grid (day rail / timeline / boxed map + inspector form) with a **map-dominant layout**: the map fills the screen, day pills dock over it, the itinerary becomes a right column, and a **single progressive card** — read-only first, expanding in place to edit — replaces the technical stop-inspector form.

Scope of this bundle: shell layout, day pills, pin rendering, the unified pin-click card, the itinerary column, the wishlist surface, and the phone card. It does **not** touch the cascade engine, the data model, routing, or geocoding.

Corresponds to the "queued, bigger — map-dominant layout" and "resolved — unified pin-click card" items in the branch notes.

## About the design files

`Etappe Redesign.dc.html` in this folder is a **design reference created in HTML** — a prototype showing intended look and behavior. It is **not production code to copy**. `support.js` is only the runtime that makes the prototype render; it has no place in the target app.

The task is to **recreate this design inside Etappe's existing environment**: React 18 + TypeScript (strict), Tailwind utility classes, MapLibre GL, TanStack Query, PocketBase. No UI component library, no CSS-in-JS — same as today. The prototype uses inline styles purely because of how it was authored; **translate every value below into Tailwind classes or theme tokens**, do not port inline styles.

The prototype's map is a **placeholder surface** (a CSS gradient with a grid and an SVG polyline), not MapLibre. Pin positions are percentage coordinates on that fake surface. In the real app all pin rendering stays a **MapLibre symbol layer, not DOM pins** — collision detection at density is why. The card, pills, wishlist box and itinerary column are ordinary DOM overlaid on the map canvas.

Photos are striped placeholders throughout — every stripe block is a photo slot fed by the existing PocketBase thumbnail pipeline.

## Fidelity

**High-fidelity.** Final colors, typography, spacing and interaction behavior. Recreate pixel-accurately using Tailwind. Colors are given in `oklch()` — Tailwind 3.4+ and 4 both accept them as arbitrary values or theme entries; keep the oklch values rather than converting to hex, so the dark palette stays perceptually even.

Two things are deliberately unresolved and marked as such below: the photo-wheel filmstrip (not built) and light theme (not built — dark only).

---

## Screens / views

### 1. Desktop shell (≥860px)

**Purpose**: planning. Everything happens here.

**Layout**

- Root: `100vh`, `display:flex; flex-direction:column; overflow:hidden`. Background `oklch(0.17 0.012 250)`, text `oklch(0.95 0.005 250)`.
- **Header**, fixed 52px: `flex`, `align-items:center`, `gap:14px`, `padding:0 14px`. Background `oklch(0.20 0.013 250)`, bottom border `1px solid oklch(0.27 0.012 250)`.
  - `← Trips` link, 13px, `oklch(0.68 0.01 250)`, `white-space:nowrap`.
  - 1px × 20px divider, `oklch(0.30 0.012 250)`.
  - Trip title, 15px/600, `letter-spacing:-0.01em`, truncates with ellipsis; beside it a mono meta line `2 days · 8 stops`, 11px, `oklch(0.62 0.01 250)`.
  - Right: two 30px ghost buttons (Search, Import) and a **30px circular avatar** (`oklch(0.32 0.03 250)`, initial letter, email in `title`).
  - The avatar is the fix for the known "phone width breaks the header first" friction — the email string never renders as text at any width.
- **Body**: `display:grid; grid-template-columns: minmax(0,1fr) 400px`, fills remaining height, `min-height:0`.

#### Map pane (left, fluid)

`position:relative; overflow:hidden`. Clicking the surface opens the card in *empty map click* mode; cursor is `crosshair`.

**Day pills**, top-left at `top:12px; left:12px`:
- Container: `display:flex; gap:6px; padding:5px; border-radius:11px`, background `oklch(0.20 0.013 250 / 0.88)`, `backdrop-filter: blur(10px)`, border `1px solid oklch(0.30 0.012 250)`.
- Pill: 28px tall, `padding:0 12px`, `radius:8px`, 12.5px. Active — background = accent, text `oklch(0.16 0.02 240)`. Inactive — transparent, text `oklch(0.78 0.008 250)`. Each shows `Day N` (600 weight) plus a mono meta at 10.5px / 0.7 opacity (`8 stops`, `empty`).
- Trailing `+` button: 28×28, dashed border `oklch(0.36 0.012 250)`.
- To the right of the container, a **Fit trip** button: 38px tall, same glass treatment, `white-space:nowrap`. This is the affordance for the known "map doesn't grow with the trip" friction — an explicit re-fit rather than automatic re-framing.
- The whole row is `pointer-events:none` with `pointer-events:auto` on the interactive children, so the map stays draggable between pills.

**Stop pins** (numbered, sequence order):
- Unselected: 26px circle, background `oklch(0.24 0.013 250)`, 2px accent border, number 12px mono `oklch(0.92 0.006 250)`, `box-shadow:0 2px 10px oklch(0.12 0.02 250 / 0.45)`, z-index 4.
- Selected: 34px, background = accent, number 14px `oklch(0.16 0.02 240)`, 2px border `oklch(0.96 0.01 240)`, plus an 8px accent halo at 16% alpha, z-index 6.
- Both `transform: translate(-50%,-50%)`.

**Wishlist pins** — square photo thumbnails, not dots:
- Unselected: 30×30, `border-radius:9px`, photo fill, 2px border `oklch(0.78 0.13 80)` (amber), shadow `0 2px 10px oklch(0.12 0.02 250 / 0.55)`, z-index 3.
- Selected: 38×38, border `oklch(0.90 0.10 85)`, plus `outline:6px solid oklch(0.78 0.13 80 / 0.18)`, z-index 6.
- Amber border is the entire visual distinction from stops. No clustering, no zoom-gating — per the resolved pin-density decision, ~100 hand-curated pins read fine.

**Wishlist panel**, bottom-left, `width:236px`, `radius:12px`, same glass treatment, z-index 8:
- Header button: full width, `padding:9px 11px`, label `WISHLIST · 6` at 12px uppercase `letter-spacing:0.08em`, chevron `▾`/`▸` at right. Toggles the list.
- Rows: `padding:8px 11px`, `gap:10px` — 34px rounded-7px thumbnail, name 13px/500 (truncating), kind 11.5px `oklch(0.64 0.01 250)`. Selected row background `oklch(0.26 0.02 235)`.
- Shows the first four; it is the fallback list, not the primary surface.
- **Hidden whenever a card is open** — it occupies the same bottom-left slot.
- **Undecided, not built**: the horizontal "photo wheel" filmstrip floated as a richer replacement for this panel.

**Attribution**: `MapLibre · OpenFreeMap`, 10px mono `oklch(0.55 0.01 250)`, bottom-right, `pointer-events:none`.

#### The unified card (desktop)

Docked bottom-left over the map. Wrapper is `position:absolute; inset:0; z-index:20; display:flex; align-items:flex-end; padding:62px 14px 14px; pointer-events:none` — the 62px top inset keeps it clear of the day pills. The card itself sets `pointer-events:auto`.

Card: `width:min(382px,100%)`, `max-height:100%`, `display:flex; flex-direction:column`, background `oklch(0.215 0.012 250)`, border `1px solid oklch(0.31 0.012 250)`, `radius:14px`, shadow `0 18px 50px oklch(0.10 0.02 250 / 0.55)`, `overflow:hidden`.

**Photo header**, 158px fixed:
- Photo fill; caption/credit bottom-left, 10px mono `oklch(0.62 0.01 250)`.
- Close `✕`: 28px circle top-right, `oklch(0.18 0.012 250 / 0.72)` + `blur(6px)`.
- Top-left nav cluster (stops and wishlist entries only): `‹` and `›` 28px circles, same glass, then a counter chip — 28px tall, `radius:14px`, `padding:0 10px`, 10.5px mono `oklch(0.80 0.008 250)`, reading `STOP 3 / 8` or `NEAREST · 3 / 6`.

**Body**, scrollable, `padding:14px 16px 0`:
- Sequence badge (stops only): 24px accent circle, 12px mono, dark text.
- Title `h2`, 19px/600, `letter-spacing:-0.01em`.
- Subtitle 13px `oklch(0.68 0.01 250)` — `Viewpoint · Day 1`, `Waterfall · Wishlist`, or for an empty click `Headland · 63.4028, -19.1264 · identified from Nearby`.
- **Computed strip** (stops only): three equal cells in a `1px solid oklch(0.29 0.012 250)` rounded-10px box with 1px dividers. Each cell: 10.5px uppercase label `oklch(0.60 0.01 250)`, value 17px mono. Arrive / Depart / Dwell. **All three come from the cascade engine — render, never compute.**
- **Daylight line** (stops only): 7px dot `oklch(0.78 0.12 90)` + 12.5px text `oklch(0.70 0.01 250)`.
- Description paragraph 13.5px `oklch(0.80 0.008 250)`, `text-wrap:pretty`.
- `Official site` link where present.

**Expanded edit region** — revealed in place when Edit is pressed, never a separate mode. Separated by `border-top:1px solid oklch(0.28 0.012 250)`, `padding-top:14px`, `display:grid; grid-template-columns:1fr 1fr; gap:12px`:
- Title (full width), Kind (opens the existing kind picker), Dwell (min, mono), Anchor (mono), Type — all 36px tall, `radius:8px`, border `oklch(0.32 0.012 250)`, background `oklch(0.22 0.012 250)`.
- Access point row: full-width panel, `oklch(0.215 0.012 250)`, label + hint + a `Set on map` button.
- Block buttons: `+ Note`, `+ Link`, `+ Photo`, `+ File` — 30px, dashed border, wired to the existing block editor.

**Action bar**, `padding:11px 16px`, top border, background `oklch(0.205 0.012 250)`. Buttons 34px, `radius:8px`, `white-space:nowrap`. Primary = accent fill with `oklch(0.16 0.02 240)` text; ghost = `1px solid oklch(0.33 0.012 250)`; the trailing destructive/dismiss button takes `margin-left:auto`.

Action bar **by what was clicked** — one component, three action sets:

| Source | Actions |
|---|---|
| Existing stop pin | `Edit` (ghost; becomes primary `Done` while expanded) · `Remove` (right-aligned) |
| Wishlist pin | `Add to itinerary` (primary) · `Reject` (right-aligned) |
| Empty map click | `+ Wishlist` (primary) · `+ Day` (ghost) · `Dismiss` (right-aligned) |

`Add to itinerary` leads to the existing ranked placement picker one step later. `Remove` must gain the delete confirmation flagged in the notes — the prototype does not show it.

#### Itinerary column (right, 400px)

Background `oklch(0.195 0.012 250)`, `border-left:1px solid oklch(0.27 0.012 250)`, `display:flex; flex-direction:column`.

- **Header**, `padding:13px 15px 11px`, bottom border: day title 15px/600; below it a mono meta `Thu 10 Jun · travel` 11.5px `oklch(0.62 0.01 250)`; right-aligned mono span `09:00 – 16:05`.
- **Scroll area**, `padding:8px 10px 90px`.
- **Stop row**: `display:flex; align-items:center; gap:11px; padding:9px 11px; radius:10px`. Contents in order — 22px sequence circle (mono 11px; accent fill when selected), **38px photo thumbnail** (`radius:8px`, border `oklch(0.31 0.012 250)`, accent at 60% when selected), name 13.5px/500 truncating with kind + dwell beneath at 11.5px `oklch(0.63 0.01 250)`, then a right-aligned mono block: arrival 12.5px over departure 11.5px `oklch(0.58 0.01 250)`.
  - Selected: background `oklch(0.25 0.02 235)`, border `1px solid <accent>/0.55`. Unselected: transparent border (prevents reflow).
- **Leg row** between stops: `padding:3px 12px 3px 22px`, a 1px × 16px connector `oklch(0.34 0.012 250)`, then 11px mono `oklch(0.58 0.01 250)` reading `18 min · 21 km`.
- **Warning banner**: `radius:9px`, border `1px solid oklch(0.42 0.09 80)`, background `oklch(0.26 0.045 80)`, text `oklch(0.88 0.07 85)` 12.5px, 7px dot `oklch(0.78 0.13 80)`. Copy comes verbatim from the engine, e.g. `NO_ACCOMMODATION — day ends without a place to stay`.
- **Empty day**: dashed `oklch(0.32 0.012 250)` panel, centered 13px `oklch(0.62 0.01 250)`: "No stops on this day yet. / Click the map or a wishlist pin to add one."
- **`+ Stop`**: full-width 36px dashed button at the end.

Per the notes this column is the existing timeline kept functionally as-is — restyled, not rewritten.

### 2. Phone (<860px)

**Purpose**: read-mostly companion during the trip, with permitted edits.

- Body switches to `flex-direction:column`. Map takes `flex:0 0 58%`, itinerary column fills the rest below it (`oklch(0.195 0.012 250)`, no left border).
- Day pills, wishlist panel and desktop card are all suppressed. The bottom-left wishlist panel does not exist at this width.
- **Phone card** — a compact strip, *not* the full-bleed photo sheet, so the map stays readable behind it:
  - `position:absolute; left:8px; right:8px; bottom:8px; z-index:20`, `radius:14px`, background `oklch(0.215 0.012 250 / 0.97)`, `backdrop-filter:blur(14px)`, border `1px solid oklch(0.31 0.012 250)`, shadow `0 10px 30px oklch(0.10 0.02 250 / 0.55)`.
  - Row 1, `padding:10px 11px; gap:11px`: 46px thumbnail (`radius:9px`; amber border for wishlist entries, `oklch(0.33 0.012 250)` for stops), name 14px/600 truncating, subtitle 11.5px, right-aligned mono arrive over dwell, 28px close button.
  - Row 2 (nav): `‹` and `›` as 30×30 rounded-8px buttons, and between them a centered hint — 10.5px mono `oklch(0.62 0.01 250)` reading `swipe · 3 / 8`, followed by a chevron running a looping nudge animation.
  - Row 3: the same action bar as desktop.
  - Edit expands the strip in place with a **44px-target** version of the edit form (title, kind, dwell, anchor, access point, block buttons), `max-height:44vh` and scrollable.
- **Not built**: drag-to-expand on the sheet, and a rubber-band transform during the swipe. Both were called out as worth adding if the strip shape holds.

---

## Interactions & behavior

**Selection**
- Click a stop pin or an itinerary row → card opens in stop mode; that pin enlarges and gains a halo; that row highlights. Pin and row selection are one state.
- Click a wishlist pin or a wishlist-panel row → card opens in wishlist mode.
- Click bare map → card opens in empty-click mode. Identification is the existing reverse-geocode / Nearby path; the prototype hardcodes one result.
- Close (`✕`, or Dismiss/Reject) clears selection and restores the wishlist panel.
- Opening a card always collapses the edit region (`editing` resets to false).

**Stop browsing** — `‹`/`›` step through the day's stops in **sequence order**, wrapping at both ends.

**Wishlist browsing** — `‹`/`›` step through wishlist entries in **proximity order**: a nearest-neighbour chain built once from a fixed anchor (index 0) and **cached**. Do not recompute per selection — recomputing from the current pin makes `‹` and `›` disagree and the sequence unstable. Build the chain greedily: start at the anchor, repeatedly append the nearest not-yet-chained entry to the current one. In the real app use great-circle distance on lat/lon, not planar distance. Counter reads `NEAREST · <position in chain> / <total>`.

**Phone swipe** — horizontal swipe on the strip with a >40px threshold calls the same step function; left = next, right = previous. Chevron nudge animation loops on a 2.4s ease-in-out cycle (rest, then a −6px kick with an opacity lift, then a −2px settle) as the discoverability cue.

**Day switching** — clicking a day pill swaps the itinerary column and the map's numbered pins to that day. Wishlist pins are day-independent and always visible.

**Hover** — header ghost buttons lighten to `oklch(0.28 0.014 250)`; Fit trip to `oklch(0.25 0.014 250 / 0.94)`; `+ Stop` border to `oklch(0.46 0.012 250)` and text to `oklch(0.92 0.006 250)`; the `+` pill to `oklch(0.5 0.012 250)` border.

**Keyboard** — preserve today's bindings; `k` still opens the kind picker from the expanded card's Kind field.

**Not covered** (unchanged from today): loading states, form validation, error states.

## State management

The prototype needs four pieces of local UI state. None of it belongs in the trip document.

- `selection: { type: 'stop' | 'wish' | 'empty', index } | null` — drives the card, pin emphasis and row highlight.
- `editing: boolean` — card expansion. Reset on every selection change.
- `activeDay: number`.
- `wishlistPanelOpen: boolean`.

Plus a cached `wishOrder: number[]` (the proximity chain), invalidated only when the wishlist set itself changes.

Data all comes from existing sources: the trip document via TanStack Query, computed arrival/departure/daylight/warnings from the cascade engine, photos from PocketBase thumbs. **The redesign renders engine output and never computes times.**

## Design tokens

Colors (oklch, dark theme only):

| Token | Value | Use |
|---|---|---|
| `bg` | `oklch(0.17 0.012 250)` | app background |
| `surface-1` | `oklch(0.195 0.012 250)` | itinerary column |
| `surface-2` | `oklch(0.20 0.013 250)` | header, glass panels |
| `surface-3` | `oklch(0.205 0.012 250)` | action bars |
| `surface-4` | `oklch(0.215 0.012 250)` | card body, inset panels |
| `field` | `oklch(0.22 0.012 250)` | input backgrounds |
| `control` | `oklch(0.24 0.013 250)` | ghost buttons, unselected pins |
| `control-hover` | `oklch(0.28 0.014 250)` | |
| `border` | `oklch(0.27 0.012 250)` | pane dividers |
| `border-strong` | `oklch(0.31 0.012 250)` / `oklch(0.32–0.34 0.012 250)` | cards, fields, dashed controls |
| `text` | `oklch(0.95 0.005 250)` | primary |
| `text-2` | `oklch(0.80 0.008 250)` | body copy |
| `text-3` | `oklch(0.68 0.01 250)` | subtitles |
| `text-4` | `oklch(0.62 0.01 250)` | labels, meta |
| `text-5` | `oklch(0.55–0.58 0.01 250)` | attribution, departure times |
| `accent` | `oklch(0.72 0.13 215)` | selection, primary actions, route line |
| `on-accent` | `oklch(0.16 0.02 240)` | text on accent |
| `accent-surface` | `oklch(0.25 0.02 235)` | selected row background |
| `wishlist` | `oklch(0.78 0.13 80)` | wishlist pin borders, warning dot |
| `warn-bg` / `warn-border` / `warn-text` | `oklch(0.26 0.045 80)` / `oklch(0.42 0.09 80)` / `oklch(0.88 0.07 85)` | warning banner |
| `daylight` | `oklch(0.78 0.12 90)` | daylight dot |

Alternative accents offered as prototype tweaks: `oklch(0.75 0.13 155)` green, `oklch(0.75 0.14 65)` amber, `oklch(0.72 0.13 300)` violet.

Typography — **Instrument Sans** (400/500/600) for UI, **IBM Plex Mono** (400/500) for every number: times, distances, durations, coordinates, counters, meta lines. That split is load-bearing; it is what makes the computed values read as computed.

Scale: 19px/600 card title · 15px/600 pane and trip titles · 14px/600 phone card title · 13.5px/500 row names · 13px body and buttons · 12.5px secondary · 11.5px meta · 10.5px uppercase labels (`letter-spacing:0.07–0.08em`) · 17px mono computed values · 12.5/11.5px mono times · 11px mono legs · 10–10.5px mono chips and attribution. Base `line-height:1.45`; titles `letter-spacing:-0.01em`.

Radii: `50%` pins/avatars/circular buttons · 14px cards · 12px wishlist panel · 11px pill container · 10px stop rows and computed strip · 9px phone thumbnails and inset panels · 8px pills, buttons, itinerary thumbnails · 7px small controls.

Spacing: 14px header gap and card inset · 16px card body horizontal · 11px row padding · 9–11px gaps · 6–8px tight gaps. Controls: 52px header · 44px phone targets · 38px Fit trip and thumbnails · 36px desktop fields · 34px action buttons · 30px header controls · 28px pills and glass circles.

Shadows: `0 18px 50px oklch(0.10 0.02 250 / 0.55)` desktop card · `0 10px 30px …/0.55` phone card · `0 2px 10px oklch(0.12 0.02 250 / 0.45–0.55)` pins.

Glass: `background: <surface> / 0.88–0.9` + `backdrop-filter: blur(10px)` on map overlays; `blur(6px)` on the small circular buttons over photos; `blur(14px)` on the phone card.

Breakpoint: one, at **860px**. Below it, phone layout. The prototype resolves this in JS off `window.innerWidth` because it has to; in the app use Tailwind's responsive variants.

## Assets

None shipped. Everything in the prototype is CSS.

- **Photos**: every striped block is a photo slot — card header (158px), wishlist pins (30/38px), itinerary rows (38px), phone card (46px). Source them from the existing PocketBase thumbnail pipeline with Wikimedia attribution where applicable. Credit renders bottom-left of the card header.
- **Icons**: none drawn. The 26-kind taxonomy sprites already exist and stay as they are — the kind picker is unchanged. Chevrons and `✕` are text glyphs (`‹`, `›`, `▾`, `▸`, `✕`) and can stay so or move to your icon set.
- **Fonts**: Instrument Sans and IBM Plex Mono, both Google Fonts. Self-host them for the Coolify container rather than hotlinking.
- **Map**: MapLibre GL + OpenFreeMap, unchanged. The prototype's gradient and SVG polyline are stand-ins; real route lines come from ORS. Note the known gap — leg-direction arrows were removed after a basemap glyph issue and are not restored here.

## Files

- `Etappe Redesign.dc.html` — the full prototype: desktop shell, all card modes, phone layout. Open it directly in a browser.
- `support.js` — prototype runtime only. Not for the target app.

Inside the prototype: the markup section is the template, the `class Component` block below it holds the logic. `STOPS` and `WISH` at the top are seeded demo data mirroring the Iceland Ring Road trip from the screenshots. Four tweakable props sit at the bottom of the file — demo state (`rest` / `stop` / `stop-edit` / `wishlist` / `empty`), force-phone, wishlist pins on/off, and accent color — useful for stepping through every state without clicking.

## Constraints carried through

Unchanged from the branch notes, and respected throughout this design:

1. No LLM calls anywhere. There is no "Ask AI" surface in this design and there must not be one.
2. Stack fixed: PocketBase, React 18 + TS, MapLibre GL, Tailwind, TanStack Query.
3. No UI component library, no CSS-in-JS.
4. Markers stay a MapLibre symbol layer. This design changes how a pin looks, not how it renders.
5. Taxonomy enum stays closed at 26 kinds.
6. The cascade engine is untouched. Every computed value here is rendered output.
