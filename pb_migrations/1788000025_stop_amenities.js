/// <reference path="../pb_data/types.d.ts" />

// Amenities on an accommodation stop (WORK 33). A short JSON array of keys
// from a closed set — `["linen","breakfast"]` — for the one question a
// planner actually asks a guesthouse before a trip: what do I have to bring?
// An Iceland hut that hands you a mattress and nothing else is a real and
// important distinction from a hotel.
//
// A list, not a column per amenity: the set is small and closed (see
// `src/lib/amenities.ts`), and "add one more" should be a one-line change
// there, not a migration. Absent from the list means "not provided / don't
// know" — the planner packs it either way, so the app does not distinguish.

migrate(
  (app) => {
    const stops = app.findCollectionByNameOrId('stops');
    stops.fields.push(
      new Field({ name: 'amenities', type: 'json', maxSize: 500 }),
    );
    app.save(stops);
  },
  (app) => {
    const stops = app.findCollectionByNameOrId('stops');
    stops.fields.removeByName('amenities');
    app.save(stops);
  },
);
