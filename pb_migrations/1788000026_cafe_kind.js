/// <reference path="../pb_data/types.d.ts" />

// A "cafe" stop kind, split out of "restaurant" (author request 2026-09-04):
// a coffee stop is a shorter, different kind of dwell than a sit-down meal,
// and OSM's amenity=cafe already distinguishes it — folding it into
// "restaurant" was losing information the source data already had.

migrate(
  (app) => {
    for (const name of ['stops', 'pois']) {
      const col = app.findCollectionByNameOrId(name);
      const field = col.fields.getByName('kind');
      field.values = [...field.values, 'cafe'];
      app.save(col);
    }
  },
  (app) => {
    for (const name of ['stops', 'pois']) {
      const col = app.findCollectionByNameOrId(name);
      // Any cafe-kind row left over would violate the narrowed enum on
      // migrate-down; fall back to restaurant — the closest kind, and what
      // amenity=cafe mapped to before this migration — rather than fail the
      // rollback outright.
      for (const rec of app.findRecordsByFilter(
        name,
        "kind = 'cafe'",
        '',
        2000,
        0,
      )) {
        rec.set('kind', 'restaurant');
        // Only stops carry kind_confirmed; pois don't.
        if (name === 'stops') rec.set('kind_confirmed', false);
        app.save(rec);
      }
      const field = col.fields.getByName('kind');
      field.values = field.values.filter((v) => v !== 'cafe');
      app.save(col);
    }
  },
);
