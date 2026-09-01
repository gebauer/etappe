/// <reference path="../pb_data/types.d.ts" />

// Wishlist carousel (WORK 12.10): the `★ Top choices` filter and the gold
// star badge on a wishlist pin both need a place's starred flag to persist
// across sessions, so it lives on the record, not in local UI state. Not
// required (a `required` bool would reject the `false`/absent default the
// same way `order_index` rejects 0 — see WORK.md), so an existing idea and a
// freshly-imported one both read back as unstarred without a backfill.

migrate(
  (app) => {
    const pois = app.findCollectionByNameOrId('pois');
    pois.fields.push(new Field({ name: 'starred', type: 'bool' }));
    app.save(pois);
  },
  (app) => {
    const pois = app.findCollectionByNameOrId('pois');
    pois.fields.removeByName('starred');
    app.save(pois);
  },
);
