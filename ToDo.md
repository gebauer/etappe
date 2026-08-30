# ToDo

Deferred fixes and polish found while building. Not blocking the current phase;
pick up before v1.

- [ ] **Fix adding POIs by map-clicking** — show a reverse-geocoded suggestion
      with a confirm dialog (accept / rename / cancel) instead of dropping the
      stop immediately (BUILD §6: "reverse-geocode for a name suggestion;
      accept or rename").
- [ ] Confirmation (or undo) before deleting stops — row ✕, Delete key, and the
      inspector currently delete without asking.
- [ ] Re-add leg-direction arrows as a sprite icon (`icon-image` + line
      placement). The old text-glyph arrow (`text-field: '▸'`) was removed: the
      basemap's glyph endpoint 404s on that range, and a failed symbol glyph
      aborts the whole source's worker tile — which silently dropped the leg
      lines themselves. Must not reintroduce a `text-field` on the legs source.
- [ ] Code-split the map — MapLibre makes the main bundle large (>500 kB).
