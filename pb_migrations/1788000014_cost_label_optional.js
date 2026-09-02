/// <reference path="../pb_data/types.d.ts" />

// The simplified single-cost field (WORK 16.10) writes no label at all — a
// cost's meaning now comes from its parent stop's title, not a typed-in
// name, so a required label has nothing to require. Without this, every
// write from the new field 400s ("label: Cannot be blank"), the same
// required-text-rejects-empty-string trap the required-number-rejects-0
// gotcha already in WORK.md warned about, just for text instead of a
// number.

migrate(
  (app) => {
    const costs = app.findCollectionByNameOrId('costs');
    costs.fields.getByName('label').required = false;
    app.save(costs);
  },
  (app) => {
    const costs = app.findCollectionByNameOrId('costs');
    costs.fields.getByName('label').required = true;
    app.save(costs);
  },
);
