/// <reference path="../pb_data/types.d.ts" />

// A routing kind for stops (author request, 2026-09-02): sometimes a leg has
// to be forced through a particular point — a mountain pass, a specific
// junction, a scenic detour — without that point being a destination worth
// its own dwell. `kind` (the taxonomy) stays closed and is about *what a
// place is* (CLAUDE.md rule 6); this is a second, orthogonal axis about
// *what role a stop plays* in the day, so it is its own field rather than a
// 27th taxonomy entry that would need an icon and a default dwell it
// doesn't want.
//
// Two values only: 'stop' (the ordinary case — ordering, timing, dwell all
// work as they always have) and 'waypoint' (dwell forced to 0 in cascade.ts;
// see CascadeStop.routing_kind). Not required — a required select rejects a
// blank value the same way a required number rejects 0 (see WORK.md), and
// every row before this migration should read as an ordinary stop with no
// backfill needed.

migrate(
  (app) => {
    const stops = app.findCollectionByNameOrId('stops');
    stops.fields.push(
      new Field({
        name: 'routing_kind',
        type: 'select',
        maxSelect: 1,
        values: ['stop', 'waypoint'],
      }),
    );
    app.save(stops);
  },
  (app) => {
    const stops = app.findCollectionByNameOrId('stops');
    stops.fields.removeByName('routing_kind');
    app.save(stops);
  },
);
