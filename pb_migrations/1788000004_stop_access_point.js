/// <reference path="../pb_data/types.d.ts" />

// A stop's own coordinates are sometimes not reachable by car (a waterfall
// viewpoint, a trailhead) so ORS correctly reports no route. `access_lat` /
// `access_lon` let the user pin a nearby road or car park instead; routing
// prefers this point over the stop's own location when present. The stop's
// displayed marker stays at its real location — only the routing endpoint
// changes.

migrate(
  (app) => {
    const stops = app.findCollectionByNameOrId('stops');
    stops.fields.push(new Field({ name: 'access_lat', type: 'number' }));
    stops.fields.push(new Field({ name: 'access_lon', type: 'number' }));
    app.save(stops);
  },
  (app) => {
    const stops = app.findCollectionByNameOrId('stops');
    stops.fields.removeByName('access_lat');
    stops.fields.removeByName('access_lon');
    app.save(stops);
  },
);
