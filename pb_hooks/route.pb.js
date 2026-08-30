/// <reference path="../pb_data/types.d.ts" />

// ORS routing proxy + cache (WORK 3.1). POST /api/route with two coordinates
// returns { duration_min, distance_m, geometry } for a driving-car route.
// route_cache is consulted first and populated on a miss, so repeated planning
// of the same trip costs no ORS calls. The ORS key is read from the server
// environment and never reaches the browser. Auth is required so the key cannot
// be abused anonymously.

routerAdd(
  'POST',
  '/api/route',
  (e) => {
    const body = e.requestInfo().body;
    const from = body.from;
    const to = body.to;
    const profile = body.profile || 'driving-car';

    const valid = (p) =>
      p && typeof p.lat === 'number' && typeof p.lon === 'number';
    if (!valid(from) || !valid(to)) {
      return e.json(400, {
        message: 'Expected { from: {lat, lon}, to: {lat, lon} }.',
      });
    }

    // Stable cache key: sha256 of the coordinate pair + profile, coordinates
    // fixed to 6 decimals so float noise cannot fragment the cache.
    const f = (n) => n.toFixed(6);
    const keySource = [
      f(from.lat),
      f(from.lon),
      f(to.lat),
      f(to.lon),
      profile,
    ].join(',');
    const key = $security.sha256(keySource);

    let cached = null;
    try {
      cached = e.app.findFirstRecordByFilter('route_cache', 'key = {:key}', {
        key: key,
      });
    } catch (_) {
      cached = null; // not found
    }
    if (cached) {
      return e.json(200, {
        duration_min: cached.get('duration_min'),
        distance_m: cached.get('distance_m'),
        geometry: cached.get('geometry'),
        cached: true,
      });
    }

    const apiKey = $os.getenv('ORS_API_KEY');
    if (!apiKey) {
      return e.json(502, {
        message: 'Routing unavailable: ORS_API_KEY is not set.',
      });
    }

    let res;
    try {
      res = $http.send({
        url:
          'https://api.openrouteservice.org/v2/directions/' +
          profile +
          '/geojson',
        method: 'POST',
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ],
        }),
        timeout: 20,
      });
    } catch (err) {
      return e.json(502, { message: 'Routing request failed: ' + String(err) });
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      return e.json(502, { message: 'ORS error ' + res.statusCode });
    }

    const feature =
      res.json && res.json.features ? res.json.features[0] : undefined;
    if (!feature || !feature.properties || !feature.properties.summary) {
      return e.json(502, { message: 'ORS returned no route.' });
    }
    const summary = feature.properties.summary;
    const durationMin = Math.round(summary.duration / 60);
    const distanceM = Math.round(summary.distance);
    const geometry = feature.geometry;

    try {
      const collection = e.app.findCollectionByNameOrId('route_cache');
      const record = new Record(collection, {
        key: key,
        duration_min: durationMin,
        distance_m: distanceM,
        geometry: geometry,
      });
      e.app.save(record);
    } catch (_) {
      // caching is best-effort; still return the freshly computed route
    }

    return e.json(200, {
      duration_min: durationMin,
      distance_m: distanceM,
      geometry: geometry,
      cached: false,
    });
  },
  $apis.requireAuth(),
);
