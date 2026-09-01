/// <reference path="../pb_data/types.d.ts" />

// Day-start continuity (WORK 13.1): a day can point at an existing stop as
// the place you leave in the morning — normally the previous day's
// accommodation. It's a pointer, not a copy: re-booking that hotel means
// editing one stop, and every day pointing at it re-routes its leading leg.
//
// `cascadeDelete: false` on purpose — deleting the referenced stop clears
// the pointer (PocketBase drops the dangling id), and the day falls back to
// island behaviour rather than the deletion cascading into other days.
// Not required: day 1 has no start point, and a cleared pointer is valid.

migrate(
  (app) => {
    const days = app.findCollectionByNameOrId('days');
    const stops = app.findCollectionByNameOrId('stops');
    days.fields.push(
      new Field({
        name: 'start_stop',
        type: 'relation',
        required: false,
        collectionId: stops.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      }),
    );
    app.save(days);
  },
  (app) => {
    const days = app.findCollectionByNameOrId('days');
    days.fields.removeByName('start_stop');
    app.save(days);
  },
);
