/// <reference path="../pb_data/types.d.ts" />

// A "rental" stop kind (WORK 16.10, author request 2026-09-02): the budget
// popover's "Rental car" line is fed by a stop's *kind*, not a trip-level
// field the earlier handoff draft proposed — a rental picked up partway
// through a trip, or from a different desk than the return, needs to be a
// real place on the map like any other stop, not a single number with
// nowhere to attach a location or a receipt to.

migrate(
  (app) => {
    for (const name of ['stops', 'pois']) {
      const col = app.findCollectionByNameOrId(name);
      const field = col.fields.getByName('kind');
      field.values = [...field.values, 'rental'];
      app.save(col);
    }
  },
  (app) => {
    for (const name of ['stops', 'pois']) {
      const col = app.findCollectionByNameOrId(name);
      // Any rental-kind row left over would violate the narrowed enum on
      // migrate-down; fall back to uncategorized rather than fail the
      // rollback outright.
      for (const rec of app.findRecordsByFilter(
        name,
        "kind = 'rental'",
        '',
        2000,
        0,
      )) {
        rec.set('kind', 'uncategorized');
        // Only stops carry kind_confirmed; pois don't.
        if (name === 'stops') rec.set('kind_confirmed', false);
        app.save(rec);
      }
      const field = col.fields.getByName('kind');
      field.values = field.values.filter((v) => v !== 'rental');
      app.save(col);
    }
  },
);
