/// <reference path="../pb_data/types.d.ts" />

// Day-end continuity (WORK 29) — the mirror of `days.start_stop` (migration
// 1788000008). A day can point at an existing stop as the place you come
// back to in the evening, so a base camp — the same hotel for four nights,
// day trips out and back — needs one hotel row, not four.
//
// Same shape and same reasons as `start_stop`: a pointer, not a copy, so
// re-booking edits one stop and every day pointing at it re-routes its
// trailing leg. `cascadeDelete: false` — deleting the referenced stop clears
// the pointer and the day falls back to ending at its own last stop.

migrate(
  (app) => {
    const days = app.findCollectionByNameOrId('days');
    const stops = app.findCollectionByNameOrId('stops');
    days.fields.push(
      new Field({
        name: 'end_stop',
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
    days.fields.removeByName('end_stop');
    app.save(days);
  },
);
