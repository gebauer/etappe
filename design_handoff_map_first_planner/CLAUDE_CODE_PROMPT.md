# Prompt for Claude Code

Paste everything below into Claude Code, from the repo root, with `design_handoff_map_first_planner/` copied into the repo (or anywhere Claude Code can read).

---

Implement the map-first planner redesign described in `design_handoff_map_first_planner/README.md`.

**Read first, in this order:**
1. `design_handoff_map_first_planner/README.md` — the full spec. Every measurement, colour and behaviour is in it. Treat it as authoritative.
2. `design_handoff_map_first_planner/Etappe Redesign.dc.html` — the HTML prototype. Open it in a browser to see the intended result and click through the states. It is a **design reference, not production code**: it uses inline styles and a fake CSS map surface purely because of how it was authored. Do not port its markup, its inline styles, or `support.js` (prototype runtime only — ignore that file entirely).

**What to build:** replace the current three-pane trip editor (day rail / timeline / boxed map + stop inspector) with a map-dominant shell — full-bleed map, day pills docked over it, a 400px itinerary column on the right, and one progressive card that handles stop pins, wishlist pins and empty map clicks. Plus the expanded full-details modal, access-point picking mode, the wishlist carousel, and the phone strip layout. The retiring inspector's fields are not dropped; the README's field-tier table says where each one lands.

**Stack — fixed, do not introduce anything new:**
- PocketBase, React 18 + TypeScript (strict), MapLibre GL, TanStack Query, Tailwind.
- No UI component library. No CSS-in-JS. Translate every value in the README into Tailwind classes or theme tokens.
- Keep the oklch() colour values as given; do not convert to hex. The dark palette is perceptually even and stays that way.
- Dark theme only. There is no light variant in this design and none should be invented.

**Hard constraints (from the project's own rules, carried through this design):**
1. No LLM calls anywhere. There is no "Ask AI" surface in this design and there must not be one.
2. Map markers stay a MapLibre symbol layer — this redesign changes how a pin looks, not how it renders. Only the cards, pills, wishlist panel, carousel and itinerary column are DOM over the canvas.
3. The taxonomy enum stays closed at 26 kinds; the kind picker is unchanged.
4. **The cascade engine is untouched.** Arrival, departure, dwell, daylight and warning strings are rendered engine output. Never compute a time in a component.
5. The itinerary column is the existing timeline restyled, not rewritten.

**Order of work — ship in these slices, each independently reviewable:**
1. Shell: header, map pane, itinerary column, day pills, Fit trip. Pin rendering for stops and wishlist.
2. The docked progressive card in all three modes (stop / wishlist / empty click) with the inline edit region, plus selection state shared with the itinerary rows.
3. Expanded full-details modal, including the accommodation toggle wired to re-run the cascade so the itinerary column's NO_ACCOMMODATION banner updates live.
4. Access-point picking mode: overlay suppression, the accent inset ring, easeTo z17 on the stop, parking chips, banner.
5. Wishlist carousel with the star filter and hover highlights.
6. Phone layout: the compact strip, swipe stepping, inline 44px-target edit form.

**Two things need server work, not just UI:**
- The parking chips come from an Overpass `amenity=parking` + `parking_entrance` query around the stop. **Cache it server-side**, like the existing Nearby call. Bound it hard: one tag, nearest 3–5 results, only fetched while picking mode is active. Unbounded Overpass is what caused the original "too many pins" problem.
- A place's starred flag and a stop's access point are persistent trip-document fields, not UI state. Setting an access point must re-run the cascade — it changes routing into and out of the stop and therefore every downstream arrival.

**The wishlist carousel now exists on phone** — same component as desktop, re-metered to 124px cards with 92px photos, arrows dropped in favour of touch scroll-snap. It is reachable **only while the day detail is collapsed**, via an `★ Explore N places` glass pill at the map's bottom-left. See the README's phone section.

**The phone day detail collapses** — a 30px chevron in the day header's top line hides the itinerary so the map takes the freed height; clicking any day pill reopens it, and phone Fit trip collapses it. Phone only. See the README's phone section.

**Daylight wording changed** — before noon the line reads against dawn (`4 h 48 m after dawn · dawn 04:12`), from noon against dusk as today. See the README's "Daylight wording" note. Dawn/dusk still come from the cascade engine; only the sentence is new.

**Sign-in is redesigned** — see the README's "Sign-in" section and `Etappe Login.dc.html` in this folder. Full-bleed travel photograph, form card floating over the left third on one blurred plate, photo caption bottom-right. The photos come from a **supplied server folder plus a `photos.json` manifest** (file, place, region, coords, month); render only the fields a manifest entry actually has — no placeholder captions. One photo per visit, 7 s crossfade while the page is open, `prefers-reduced-motion` holds the first. Sourcing photos from users' own trips is deliberately out of scope here — it is written up in `FEATURE_REQUEST_trip-photos.md`.

**Fit trip enters a trip overview** — it clears the day selection (`day: null`), so no pill is active; the map then draws one 30px accent pin per day at that day's starting point, numbered 1–X (unplanned days render on `control` instead of accent), and the itinerary column becomes a day list with date, starting point, span and stop count. Stop pins and the day route are not drawn in this state. Clicking any pin, row or pill leaves it. See the README's "Trip overview".

**The day dock is a scrolling rail, not a wrapping row** — see the README's "Day dock" section. Long trips wrapped the pills onto two lines. Now: Fit trip leads as a 38px corner-brackets icon button, then a glass container whose front carries one vertical `DAYS` label (the pills lost the repeated word and show just the number), then a horizontal scroller flanked by dim-at-end chevrons with 26px edge fades on the overflowing sides. `+` add-day sits outside the scroller. The rail also drag-scrolls (with the pill click suppressed once the pointer has moved 4px), and clicking a pill near either edge scrolls the days beyond it into view. The rail must never wrap at any trip length.

**Itinerary rows carry cost marks** — gold `€`/`€€`/`€€€` on the meta line for stops with a cost (bands: 1–50, 51–250, 251+), exact amount in `title`, nothing rendered for free stops.

**Budget is new** — see the README's "Budget" section. A single `€` glyph button in the header opens a 258px popover holding a four-line bill (Accommodation / Flights / Rental car / Sightseeing) and a total; the button itself becomes the running total once any stop has a cost. Cost is one nullable number field on the stop, entered in the expanded card's Timing group; rental cost and trip currency are trip-level fields. Nothing about it touches the cascade engine.

**The block editor inside the expanded card is redesigned** — see the README's "Block editor" section, and the expanded card in the prototype. Today it stacks every block open in native controls (white inputs, a native select for visibility, a `Choose file / No file chosen` row, ↑ ↓ ✕ per block) and three blocks fill the modal. The redesign is a collapsed list of 42px rows with **one block open at a time**, a drag handle replacing the arrow buttons, a two-segment visibility control replacing the select, and a dashed dropzone replacing the native file input. Add buttons move below the list. No white fields anywhere.

**Two carried-over overlays fail contrast and must be retrofitted** — the search overlay and the kind picker. Both were previously "unchanged"; both still render on light/inherited styling: the search field shows light grey text on white, result names read black, and the kind picker's icon glyphs read near-black on a dark panel. See the "Overlays carried over from today" section of the README for exact values. Summary: both panels move onto the dark tokens, placeholders become `text-4` with typed text at `text`, kind glyphs render `text` white at rest, and the selected kind cell goes **gold** (`oklch(0.82 0.13 80)` on `oklch(0.26 0.045 80)`) rather than accent blue, because accent already means "selected on the map". Structure, grid order, taxonomy and the `k` binding do not change — this is colour only.

**Collaboration attribution:** each wishlist entry stores the user who added it, and each user record stores a colour. Do not hash the name or pick a colour at render time — the same person must read the same colour in every trip and every surface. The design shows the contributor as a pill (colour dot + nickname) on the card and carousel card, and an initial chip on the compact list rows. Contributor marks are on wishlist entries only; itinerary stops carry none.

**Known gaps — leave them alone unless asked:**
- A directions link on parking chips: not designed, not built.
- Phone route to the expanded card: not built. `All details` is not offered on phone by design.
- Drag-to-expand and rubber-band swipe on the phone strip: not built.
- `Remove` needs a delete confirmation that the prototype does not show. Add one using the app's existing confirmation pattern.
- Leg-direction arrows are still absent (removed earlier over a basemap glyph issue). Not restored here.

**Before you start:** read the existing trip editor components, the cascade engine's output types, and the current MapLibre setup, then tell me your implementation plan and where you expect friction with the current component structure. Do not begin writing components until we have agreed the plan.
