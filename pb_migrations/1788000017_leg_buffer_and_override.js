/// <reference path="../pb_data/types.d.ts" />

// Buffer and duration override, reworked (WORK 19.5).
//
// Three changes, all driven by moving to a routing engine whose raw numbers
// are worth trusting (author, 2026-09-03):
//
//   `legs.buffer_override` replaces `legs.buffer_override_pct`. It is text
//   because it carries two units in one field: "12%" is a percentage of the
//   routed time, a bare "12" is twelve minutes flat. A short drive wants
//   minutes (5 % of 8 minutes is nothing); a long one wants a percentage.
//   Empty means "use the trip's car_buffer_pct".
//
//   `legs.duration_override_min` is new: "this leg takes N minutes, whatever
//   the engine says". Distinct from `routing_source: 'manual'`, which means
//   *unrouted* — a trailhead with no road near it, or a ferry. An override
//   keeps the geometry, the distance and the engine's own duration, so the
//   road track still draws, re-routing still refreshes it, and the row can
//   show both numbers.
//
//   Trips still sitting on the old 15 % default drop to 5 %. The old figure
//   was compensating for a conservative engine *and* for surface
//   multipliers, which the cascade no longer applies. A trip whose owner
//   typed some other number kept it — that was a decision, not a default.

migrate(
  (app) => {
    const legs = app.findCollectionByNameOrId('legs');
    legs.fields.push(
      new Field({ name: 'buffer_override', type: 'text', max: 8 }),
    );
    legs.fields.push(
      new Field({ name: 'duration_override_min', type: 'number', min: 0 }),
    );
    app.save(legs);

    for (const leg of app.findAllRecords('legs')) {
      const pct = leg.getInt('buffer_override_pct');
      if (pct > 0) {
        leg.set('buffer_override', pct + '%');
        app.save(leg);
      }
    }

    const fresh = app.findCollectionByNameOrId('legs');
    fresh.fields.removeByName('buffer_override_pct');
    app.save(fresh);

    for (const trip of app.findAllRecords('trips')) {
      if (trip.getInt('car_buffer_pct') === 15) {
        trip.set('car_buffer_pct', 5);
        app.save(trip);
      }
    }
  },
  (app) => {
    const legs = app.findCollectionByNameOrId('legs');
    legs.fields.push(
      new Field({ name: 'buffer_override_pct', type: 'number', min: 0 }),
    );
    app.save(legs);

    for (const leg of app.findAllRecords('legs')) {
      const raw = String(leg.get('buffer_override') || '');
      // Only a percentage survives the trip back; a minutes override has no
      // home in the old shape and is dropped.
      const m = raw.match(/^(\d+)%$/);
      if (m) {
        leg.set('buffer_override_pct', parseInt(m[1], 10));
        app.save(leg);
      }
    }

    const fresh = app.findCollectionByNameOrId('legs');
    fresh.fields.removeByName('buffer_override');
    fresh.fields.removeByName('duration_override_min');
    app.save(fresh);
  },
);
