/// <reference path="../pb_data/types.d.ts" />

// Highlights import (WORK 8.1) will create wishlist POIs (the `pois`
// collection) carrying photos/description/links — the same rich content a
// stop already gets via `blocks`. `blocks.parent_type` only allowed
// trip/day/stop/leg; add `poi` so a wishlist item can own its own blocks too.

migrate(
  (app) => {
    const blocks = app.findCollectionByNameOrId('blocks');
    const parentType = blocks.fields.getByName('parent_type');
    parentType.values = [...parentType.values, 'poi'];
    app.save(blocks);
  },
  (app) => {
    const blocks = app.findCollectionByNameOrId('blocks');
    const parentType = blocks.fields.getByName('parent_type');
    parentType.values = parentType.values.filter((v) => v !== 'poi');
    app.save(blocks);
  },
);
