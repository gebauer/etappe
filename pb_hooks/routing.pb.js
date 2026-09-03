/// <reference path="../pb_data/types.d.ts" />

// Routing credentials (WORK 19.1). `users.routing_keys` is a hidden field —
// the client can never read it back, so it cannot merge one provider's key
// into the map itself. This endpoint does the merge server-side and keeps
// the readable `routing_providers` list in sync.
//
//   POST /api/routing-credentials  { provider, key }        → store a key
//   POST /api/routing-credentials  { provider, key: null }  → clear it
//
// Always acts on the *caller's own* record. Never echoes a key back.

routerAdd(
  'POST',
  '/api/routing-credentials',
  (e) => {
    const user = e.auth;
    if (!user) return e.json(401, { message: 'Sign in first.' });

    const body = e.requestInfo().body;
    const provider = String(body.provider || '').trim();
    if (!/^[a-z0-9_-]{1,32}$/.test(provider)) {
      return e.json(400, { message: 'Unknown provider.' });
    }

    // A PocketBase JSON field comes back as a Go-backed value, not a plain
    // JS object — assigning a property straight onto it throws. Round-trip
    // through text so what we mutate is genuinely a JS object.
    let keys = {};
    try {
      const raw = user.get('routing_keys');
      const text =
        raw == null ? '' : typeof raw === 'string' ? raw : String(raw);
      const parsed = JSON.parse(text || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Copy key by key: `parsed` is still whatever JSON.parse produced.
        for (const k of Object.keys(parsed)) keys[k] = String(parsed[k]);
      }
    } catch (_) {
      keys = {};
    }

    const key = body.key == null ? null : String(body.key).trim();

    // Storing a key: prove it actually routes before it lands, so a typo or
    // a dead key surfaces here instead of silently falling back to the
    // server default on the next re-route (author, 2026-09-03).
    if (key) {
      const probe = probeRoutingKey(provider, key);
      if (!probe.ok) {
        return e.json(400, {
          message:
            provider.toUpperCase() +
            " didn't accept that key" +
            (probe.detail ? ' — ' + probe.detail : '') +
            '.',
        });
      }
      keys[provider] = key;
    } else {
      delete keys[provider];
    }

    const stored = Object.keys(keys);
    user.set('routing_keys', keys);
    user.set('routing_providers', stored);
    e.app.save(user);

    return e.json(200, { providers: stored });
  },
  $apis.requireAuth(),
);

// One live routing request with the given key — an auth check, not a real
// route. Two points ~4 km apart near Reykjavík; any working car router
// answers. Handler-local: each hook runs in its own VM (see route.pb.js).
function probeRoutingKey(provider, apiKey) {
  const o = { lat: 64.1466, lon: -21.9426 };
  const d = { lat: 64.1355, lon: -21.8954 };
  try {
    if (provider === 'here') {
      const url =
        'https://router.hereapi.com/v8/routes?transportMode=car&origin=' +
        o.lat +
        ',' +
        o.lon +
        '&destination=' +
        d.lat +
        ',' +
        d.lon +
        '&return=summary&apikey=' +
        encodeURIComponent(apiKey);
      const r = $http.send({ url: url, method: 'GET', timeout: 15 });
      return r.statusCode === 200
        ? { ok: true }
        : { ok: false, detail: 'HTTP ' + r.statusCode };
    }
    if (provider === 'ors') {
      const base =
        $os.getenv('ORS_URL') || 'https://api.heigit.org/openrouteservice/v2';
      const url =
        base +
        '/directions/driving-car?api_key=' +
        encodeURIComponent(apiKey) +
        '&start=' +
        o.lon +
        ',' +
        o.lat +
        '&end=' +
        d.lon +
        ',' +
        d.lat;
      const r = $http.send({ url: url, method: 'GET', timeout: 15 });
      return r.statusCode === 200
        ? { ok: true }
        : { ok: false, detail: 'HTTP ' + r.statusCode };
    }
    // A provider with no key to check (self-hosted OSRM) — nothing to prove.
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}
