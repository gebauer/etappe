# ToDo

Deferred fixes and polish found while building. Not blocking the current phase;
pick up before v1.

- [ ] **Fix adding POIs by map-clicking** — show a reverse-geocoded suggestion
      with a confirm dialog (accept / rename / cancel) instead of dropping the
      stop immediately (BUILD §6: "reverse-geocode for a name suggestion;
      accept or rename").
- [ ] Confirmation (or undo) before deleting stops — row ✕, Delete key, and the
      inspector currently delete without asking.
- [ ] Leg-direction arrows don't render — OpenFreeMap's font lacks the `▸`
      glyph. Swap for a supported glyph or an SDF arrow icon.
- [ ] Code-split the map — MapLibre makes the main bundle large (>500 kB).
