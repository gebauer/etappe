/// <reference path="../pb_data/types.d.ts" />

// Routing proxy + cache (WORK 3.1), backend-agnostic (WORK note from the user).
// POST /api/route with two coordinates returns { duration_min, distance_m,
// geometry } for a car route. route_cache is consulted first and populated on a
// miss. The backend is chosen by env so a self-hosted OSRM can replace ORS
// without touching client code:
//
//   ROUTING_BACKEND = "ors" (default) | "osrm"
//   ORS_URL   base, default https://api.heigit.org/openrouteservice/v2
//             (api.openrouteservice.org is deprecated; shut off 2026-08-24)
//   ORS_API_KEY   required for the ors backend; never sent to the browser
//   OSRM_URL  base of a self-hosted OSRM (e.g. https://osrm.example.com)
//
// Handler-local helpers (not top-level) because each hook runs in its own VM.

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

    const backend = ($os.getenv('ROUTING_BACKEND') || 'ors').toLowerCase();

    // Cache key: coordinates (fixed to 6 decimals), profile and backend, so
    // switching backends never returns another engine's geometry.
    const f = (n) => n.toFixed(6);
    const keySource = [
      f(from.lat),
      f(from.lon),
      f(to.lat),
      f(to.lon),
      profile,
      backend,
    ].join(',');
    const key = $security.sha256(keySource);

    let cached = null;
    try {
      cached = e.app.findFirstRecordByFilter('route_cache', 'key = {:key}', {
        key: key,
      });
    } catch (_) {
      cached = null;
    }
    if (cached) {
      return e.json(200, {
        duration_min: cached.get('duration_min'),
        distance_m: cached.get('distance_m'),
        geometry: cached.get('geometry'),
        cached: true,
      });
    }

    // --- backend request (local helpers; returns {durationSec, distanceM, geometry}) ---
    const routeORS = () => {
      const apiKey = $os.getenv('ORS_API_KEY');
      if (!apiKey) throw new Error('ORS_API_KEY is not set');
      const base =
        $os.getenv('ORS_URL') || 'https://api.heigit.org/openrouteservice/v2';
      const res = $http.send({
        url: base + '/directions/' + profile + '/geojson',
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
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error('ORS error ' + res.statusCode);
      }
      const feature = res.json && res.json.features && res.json.features[0];
      if (!feature || !feature.properties || !feature.properties.summary) {
        throw new Error('ORS returned no route');
      }
      return {
        durationSec: feature.properties.summary.duration,
        distanceM: feature.properties.summary.distance,
        geometry: feature.geometry,
      };
    };

    const routeOSRM = () => {
      const base = $os.getenv('OSRM_URL');
      if (!base) throw new Error('OSRM_URL is not set');
      const coords = from.lon + ',' + from.lat + ';' + to.lon + ',' + to.lat;
      const res = $http.send({
        url:
          base +
          '/route/v1/driving/' +
          coords +
          '?overview=full&geometries=geojson',
        method: 'GET',
        timeout: 20,
      });
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error('OSRM error ' + res.statusCode);
      }
      const route = res.json && res.json.routes && res.json.routes[0];
      if (!route) throw new Error('OSRM returned no route');
      return {
        durationSec: route.duration,
        distanceM: route.distance,
        geometry: route.geometry,
      };
    };

    let out;
    try {
      out = backend === 'osrm' ? routeOSRM() : routeORS();
    } catch (err) {
      return e.json(502, { message: 'Routing unavailable: ' + String(err) });
    }

    const durationMin = Math.round(out.durationSec / 60);
    const distanceM = Math.round(out.distanceM);
    const geometry = out.geometry;

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
      // caching is best-effort
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
