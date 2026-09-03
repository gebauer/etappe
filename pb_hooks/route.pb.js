/// <reference path="../pb_data/types.d.ts" />

// Routing proxy + cache (WORK 3.1), backend-agnostic (WORK note from the user).
// POST /api/route with two coordinates returns { duration_min, distance_m,
// geometry } for a car route. route_cache is consulted first and populated on a
// miss. The backend is chosen by env so a self-hosted OSRM can replace ORS
// without touching client code:
//
//   ROUTING_BACKEND = "ors" (default) | "here" | "osrm"
//   ORS_URL   base, default https://api.heigit.org/openrouteservice/v2
//             (api.openrouteservice.org is deprecated; shut off 2026-08-24)
//   ORS_API_KEY   required for the ors backend; never sent to the browser
//   HERE_API_KEY  required for the here backend; never sent to the browser
//   OSRM_URL  base of a self-hosted OSRM (e.g. https://osrm.example.com)
//
// These are the *fallback*. When the request names a `trip`, the engine and
// key come from that trip's owner (WORK 19.1) — see below.
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

    // Which engine, and whose key (WORK 19.1). Resolved from the **trip
    // owner**, never the caller: every member of a shared trip has to see
    // the same durations, and the owner pays the quota. The caller must be
    // a member of the trip they name, or anyone could spend a stranger's
    // credits. Falls back to the server env when the owner set nothing.
    let backend = ($os.getenv('ROUTING_BACKEND') || 'ors').toLowerCase();
    let ownerKeys = null;
    if (body.trip) {
      const caller = e.auth;
      let member = null;
      try {
        member = caller
          ? e.app.findFirstRecordByFilter(
              'trip_members',
              'trip = {:t} && user = {:u}',
              { t: String(body.trip), u: caller.id },
            )
          : null;
      } catch (_) {
        member = null;
      }
      if (!member) return e.json(403, { message: 'Not a trip member.' });
      try {
        const trip = e.app.findRecordById('trips', String(body.trip));
        const owner = e.app.findRecordById('users', trip.get('owner'));
        const chosen = String(owner.get('routing_backend') || '').toLowerCase();
        // A PocketBase JSON field is a Go-backed value in Goja, not a plain
        // object — `raw[chosen]` on it reads `undefined` and the engine
        // choice was silently ignored (every leg fell back to the ORS env
        // default). Round-trip through text, the same way routing.pb.js does
        // when it writes the field.
        const raw = owner.get('routing_keys');
        const text =
          raw == null ? '' : typeof raw === 'string' ? raw : String(raw);
        let parsed = {};
        try {
          const p = JSON.parse(text || '{}');
          if (p && typeof p === 'object' && !Array.isArray(p)) parsed = p;
        } catch (_) {
          parsed = {};
        }
        if (chosen && parsed[chosen]) {
          backend = chosen;
          ownerKeys = parsed;
        }
      } catch (_) {
        // Owner record gone, or no settings — the env default stands.
      }
    }
    const keyFor = (provider, envName) =>
      (ownerKeys && ownerKeys[provider]) || $os.getenv(envName);

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
      // The backend is part of the cache key, so a hit is by definition an
      // answer from this backend — no need to store it on the row.
      return e.json(200, {
        routable: true,
        duration_min: cached.get('duration_min'),
        distance_m: cached.get('distance_m'),
        geometry: cached.get('geometry'),
        backend: backend,
        cached: true,
      });
    }

    // --- backend request (local helpers; returns {durationSec, distanceM, geometry}) ---
    const routeORS = () => {
      const apiKey = keyFor('ors', 'ORS_API_KEY');
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
      // 404 = no routable point / no route for these coordinates (e.g. a POI
      // not near a road). That is an expected outcome, not a failure.
      if (res.statusCode === 404) return null;
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error('ORS error ' + res.statusCode);
      }
      const feature = res.json && res.json.features && res.json.features[0];
      if (!feature || !feature.properties || !feature.properties.summary) {
        return null;
      }
      return {
        durationSec: feature.properties.summary.duration,
        distanceM: feature.properties.summary.distance,
        geometry: feature.geometry,
      };
    };

    // HERE Routing v8 (WORK 19.2). Chosen over Google/Mapbox because its
    // terms permit caching results, which `route_cache` depends on. Its
    // speed model is markedly closer to real driving times than ORS's
    // default car profile, which is what prompted the whole backend
    // (author, 2026-09-03: ORS put 195 km of paved Ring Road at 3 h 06
    // against Google's 2 h 19).
    const routeHERE = () => {
      const apiKey = keyFor('here', 'HERE_API_KEY');
      if (!apiKey) throw new Error('HERE_API_KEY is not set');
      const { decodeFlexPolyline } = require(`${__hooks}/flexpolyline_lib.js`);
      const url =
        'https://router.hereapi.com/v8/routes' +
        '?transportMode=car' +
        '&origin=' +
        from.lat +
        ',' +
        from.lon +
        '&destination=' +
        to.lat +
        ',' +
        to.lon +
        '&return=summary,polyline' +
        '&apikey=' +
        encodeURIComponent(apiKey);
      const res = $http.send({ url: url, method: 'GET', timeout: 20 });
      // No route between these points — same expected outcome as ORS's 404.
      if (res.statusCode === 404) return null;
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error('HERE error ' + res.statusCode);
      }
      const route = res.json && res.json.routes && res.json.routes[0];
      if (!route || !route.sections || route.sections.length === 0) return null;
      // A car route is normally one section, but sum defensively.
      let durationSec = 0;
      let distanceM = 0;
      let coords = [];
      for (let i = 0; i < route.sections.length; i++) {
        const s = route.sections[i];
        if (s.summary) {
          durationSec += s.summary.duration || 0;
          distanceM += s.summary.length || 0;
        }
        if (s.polyline) coords = coords.concat(decodeFlexPolyline(s.polyline));
      }
      if (!durationSec && !distanceM) return null;
      return {
        durationSec: durationSec,
        distanceM: distanceM,
        geometry:
          coords.length >= 2
            ? { type: 'LineString', coordinates: coords }
            : null,
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
      if (res.statusCode === 404) return null;
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error('OSRM error ' + res.statusCode);
      }
      const route = res.json && res.json.routes && res.json.routes[0];
      if (!route) return null;
      return {
        durationSec: route.duration,
        distanceM: route.distance,
        geometry: route.geometry,
      };
    };

    let out;
    try {
      out =
        backend === 'osrm'
          ? routeOSRM()
          : backend === 'here'
            ? routeHERE()
            : routeORS();
    } catch (err) {
      return e.json(502, { message: 'Routing unavailable: ' + String(err) });
    }

    // No route for these coordinates — expected (POI off-road); the client
    // falls back to a manual leg without treating it as an error.
    if (!out) {
      return e.json(200, {
        routable: false,
        duration_min: 0,
        distance_m: 0,
        geometry: null,
        backend: backend,
        cached: false,
      });
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
      routable: true,
      duration_min: durationMin,
      distance_m: distanceM,
      geometry: geometry,
      backend: backend,
      cached: false,
    });
  },
  $apis.requireAuth(),
);
