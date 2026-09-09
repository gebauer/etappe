/// <reference path="../pb_data/types.d.ts" />

// A trip lock (author request 2026-09-09): an accident guard against
// editing a trip you consider finished. Not a permission — roles already
// answer "may this person edit?" — so it is deliberately not enforced in
// the API rules: the person it stops is the one who set it, and clearing it
// is one click in the header. See src/lib/trip-lock.ts.
//
// Two levels, because they guard different mistakes: `days` blocks only the
// structural edit that is expensive to undo (insert/delete reindexes every
// day below and shifts date-derived blocks), `all` freezes the itinerary
// outright. Unset (`''`) is open, which is what every existing trip gets.

migrate(
  (app) => {
    const trips = app.findCollectionByNameOrId('trips');
    trips.fields.push(
      new SelectField({
        name: 'locked',
        values: ['days', 'all'],
        maxSelect: 1,
        required: false,
      }),
    );
    app.save(trips);
  },
  (app) => {
    const trips = app.findCollectionByNameOrId('trips');
    trips.fields.removeByName('locked');
    app.save(trips);
  },
);
