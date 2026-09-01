/// <reference path="../pb_data/types.d.ts" />

// Price tags on a wishlist idea (WORK 16.7). `costs.parent_type` was written
// in phase 1 as trip | day | stop | leg, before phase 14 made a poi "a stop
// without a day". An idea's admission fee is exactly the thing that decides
// whether it makes the cut, so it needs somewhere honest to live: filing it
// under `stop` with a poi id would be a lie the next reader has to unpick.

migrate(
  (app) => {
    const costs = app.findCollectionByNameOrId('costs');
    const field = costs.fields.getByName('parent_type');
    field.values = ['trip', 'day', 'stop', 'leg', 'poi'];
    app.save(costs);
  },
  (app) => {
    const costs = app.findCollectionByNameOrId('costs');
    // Anything filed against a poi has nowhere to go in the old enum.
    for (const rec of app.findRecordsByFilter(
      'costs',
      "parent_type = 'poi'",
      '',
      2000,
      0,
    )) {
      app.delete(rec);
    }
    const field = costs.fields.getByName('parent_type');
    field.values = ['trip', 'day', 'stop', 'leg'];
    app.save(costs);
  },
);
