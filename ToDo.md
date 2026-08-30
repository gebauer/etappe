# ToDo

Deferred fixes and polish found while building. Not blocking the current phase;
pick up before v1.

- [ ] **Fix adding POIs by map-clicking** — show a reverse-geocoded suggestion
      with a confirm dialog (accept / rename / cancel) instead of dropping the
      stop immediately (BUILD §6: "reverse-geocode for a name suggestion;
      accept or rename").
- [ ] Confirmation (or undo) before deleting stops — row ✕, Delete key, and the
      inspector currently delete without asking.
- [x] **Manual legs still not routing** — root cause: `buildLegRecord`
      collapses a genuine "no road nearby" (ORS 404) and an actual provider
      failure (network/auth/rate-limit, hook 502) into the identical `manual`
      state, so ⟳ route always looked like it "ran" either way with zero
      feedback. Rather than only fixing the error reporting, added the
      underlying workaround: stops can carry an `access_lat`/`access_lon`
      (2026-08-30 migration `1788000004`) — routing prefers this over the
      stop's own coordinates when set, so an off-road POI (trailhead, viewpoint)
      can route via a nearby road/car park instead. It's a property of the
      POI, not the route: set/cleared from the stop's own inspector (next to
      lat/lon), which arms click-the-map placement; a manual leg's "⟳ route"
      button just points there. Legs can also be flipped to manual explicitly ("✎
      manual") with an editable duration input, and any leg with no route
      geometry now draws a thin grey dashed straight connector on the map
      instead of no line at all — see `src/lib/map-features.ts`. Still open:
      the hook/client still don't distinguish a _genuine_ 404 from a swallowed
      502/network error in the UI (both still read as "manual") — low priority
      now that there's a real workaround, but worth doing if it causes
      confusion again.
- [ ] Re-add leg-direction arrows as a sprite icon (`icon-image` + line
      placement). The old text-glyph arrow (`text-field: '▸'`) was removed: the
      basemap's glyph endpoint 404s on that range, and a failed symbol glyph
      aborts the whole source's worker tile — which silently dropped the leg
      lines themselves. Must not reintroduce a `text-field` on the legs source.
- [ ] Code-split the map — MapLibre makes the main bundle large (>500 kB).
