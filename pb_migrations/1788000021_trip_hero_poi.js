/// <reference path="../pb_data/types.d.ts" />

// Trip settings (WORK 23): `trips.hero_poi` names which wishlist idea's
// photo represents the trip on the selection screen. Without it the card
// auto-picks the first starred idea, which is often not the one you'd
// choose. A pointer, not a copy — `cascadeDelete: false`, so removing the
// idea just clears the choice and the card falls back to the default.

migrate(
  (app) => {
    const trips = app.findCollectionByNameOrId('trips');
    const pois = app.findCollectionByNameOrId('pois');
    trips.fields.push(
      new Field({
        name: 'hero_poi',
        type: 'relation',
        required: false,
        collectionId: pois.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      }),
    );
    app.save(trips);
  },
  (app) => {
    const trips = app.findCollectionByNameOrId('trips');
    trips.fields.removeByName('hero_poi');
    app.save(trips);
  },
);
