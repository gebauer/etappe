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
    if (key) keys[provider] = key;
    else delete keys[provider];

    const stored = Object.keys(keys);
    user.set('routing_keys', keys);
    user.set('routing_providers', stored);
    e.app.save(user);

    return e.json(200, { providers: stored });
  },
  $apis.requireAuth(),
);
