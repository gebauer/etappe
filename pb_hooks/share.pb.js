/// <reference path="../pb_data/types.d.ts" />

// Public share payload (WORK 9.1 / 16.6). GET /api/share/{token} returns a
// whole trip as one document for an unauthenticated reader.
//
// This is assembled **server-side on purpose** — CLAUDE.md rule 5,
// "visibility is enforced server-side; never filter private blocks in client
// code and call it done". The client never sees a block it isn't allowed to,
// so there is nothing to leak through a devtools inspection or a bug in a
// filter someone forgets to apply.
//
// What crosses the line:
//   - the trip's title, start date, timezone (dates are derived from these,
//     never stored per day — BUILD §2),
//   - days, stops, legs, activities: the plan itself,
//   - blocks whose visibility is exactly `public`. A block defaults to
//     `trip`, so a freshly-enabled link shows the plan and nothing else
//     until something is explicitly promoted.
//
// What never does:
//   - `costs`, at all. Not by filter — this hook does not read the
//     collection, which is a cheaper thing to be sure of (WORK 16.7).
//   - members, invites, share tokens, creator ids, or any `private`/`trip`
//     block.

routerAdd('GET', '/api/share/{token}', (e) => {
  const token = e.request.pathValue('token');
  if (!token) return e.json(404, { message: 'Not found.' });

  let trip;
  try {
    trip = e.app.findFirstRecordByFilter(
      'trips',
      'share_token = {:token} && share_enabled = true',
      { token: token },
    );
  } catch (_) {
    // Deliberately the same answer as a wrong token: a disabled link must
    // not be distinguishable from one that never existed.
    return e.json(404, { message: 'This link is not shared.' });
  }

  const days = e.app.findRecordsByFilter(
    'days',
    'trip = {:trip}',
    'order_index',
    0,
    0,
    { trip: trip.id },
  );

  const publicBlocks = e.app.findRecordsByFilter(
    'blocks',
    "trip = {:trip} && visibility = 'public'",
    'order_index',
    0,
    0,
    { trip: trip.id },
  );
  const blocksByParent = {};
  for (const block of publicBlocks) {
    const key = block.get('parent_type') + ':' + block.get('parent_id');
    if (!blocksByParent[key]) blocksByParent[key] = [];
    blocksByParent[key].push({
      id: block.id,
      kind: block.get('kind'),
      title: block.get('title'),
      body: block.get('body'),
      url: block.get('url'),
      file: block.get('file')
        ? '/api/files/blocks/' + block.id + '/' + block.get('file')
        : '',
      attribution_author: block.get('attribution_author'),
      attribution_licence: block.get('attribution_licence'),
      attribution_url: block.get('attribution_url'),
    });
  }
  const blocksFor = (type, id) => blocksByParent[type + ':' + id] || [];

  const payload = {
    trip: {
      title: trip.get('title'),
      start_date: trip.get('start_date'),
      timezone: trip.get('timezone'),
      car_buffer_pct: trip.get('car_buffer_pct'),
      surface_multipliers: trip.get('surface_multipliers'),
      default_dwell: trip.get('default_dwell'),
    },
    days: [],
  };

  for (const day of days) {
    const stops = e.app.findRecordsByFilter(
      'stops',
      'day = {:day}',
      'order_index',
      0,
      0,
      { day: day.id },
    );
    const stopPayload = [];
    for (const stop of stops) {
      const activities = e.app.findRecordsByFilter(
        'activities',
        'stop = {:stop}',
        'order_index',
        0,
        0,
        { stop: stop.id },
      );
      stopPayload.push({
        id: stop.id,
        title: stop.get('title'),
        kind: stop.get('kind'),
        lat: stop.get('lat'),
        lon: stop.get('lon'),
        is_accommodation: stop.get('is_accommodation'),
        anchor_time: stop.get('anchor_time'),
        anchor_type: stop.get('anchor_type'),
        dwell_override: stop.get('dwell_override'),
        routing_kind: stop.get('routing_kind'),
        activities: activities.map((a) => ({
          duration_min: a.get('duration_min'),
          kind: a.get('kind'),
          title: a.get('title'),
        })),
        blocks: blocksFor('stop', stop.id),
      });
    }

    const legs = [];
    for (let i = 0; i < stops.length - 1; i++) {
      let leg = null;
      try {
        leg = e.app.findFirstRecordByFilter(
          'legs',
          'from_stop = {:from} && to_stop = {:to}',
          { from: stops[i].id, to: stops[i + 1].id },
        );
      } catch (_) {
        leg = null;
      }
      legs.push(
        leg
          ? {
              mode: leg.get('mode'),
              surface: leg.get('surface'),
              duration_min: leg.get('duration_min'),
              distance_m: leg.get('distance_m'),
              geometry: leg.get('geometry'),
            }
          : { mode: 'other', duration_min: 0 },
      );
    }

    payload.days.push({
      id: day.id,
      order_index: day.get('order_index'),
      title: day.get('title'),
      kind: day.get('kind'),
      start_stop: day.get('start_stop'),
      stops: stopPayload,
      legs: legs,
      blocks: blocksFor('day', day.id),
    });
  }

  return e.json(200, payload);
});
