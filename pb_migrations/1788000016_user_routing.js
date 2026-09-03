/// <reference path="../pb_data/types.d.ts" />

// Per-user routing settings (WORK 19.1).
//
// Two independent things, deliberately not one setting:
//
//   `routing_backend` + `routing_keys` — which engine computes leg
//   durations, and the key for it. Resolved from the **trip owner**, not
//   the caller: everyone on a shared trip has to see the same numbers, and
//   the owner pays the quota. That is the price of sharing (author,
//   2026-09-03).
//
//   `link_out` — which map app the `↗` links open. Costs nothing, needs no
//   key, so it is per-user and can differ freely between members.
//
// `routing_keys` is **hidden**: excluded from every API response, so a key
// never lands in the browser's persisted authStore. It is written only
// through `POST /api/routing-credentials` (see `routing.pb.js`) — a hidden
// JSON field can't be merged client-side when the client can't read it.
// `routing_providers` is the readable companion: just the names that have a
// key, so the account panel can show "stored ✓" and an ✕ to clear one.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.push(new Field({ name: 'routing_backend', type: 'text' }));
    users.fields.push(
      new Field({
        name: 'routing_keys',
        type: 'json',
        maxSize: 4000,
        hidden: true,
      }),
    );
    users.fields.push(
      new Field({ name: 'routing_providers', type: 'json', maxSize: 1000 }),
    );
    users.fields.push(new Field({ name: 'link_out', type: 'text' }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('routing_backend');
    users.fields.removeByName('routing_keys');
    users.fields.removeByName('routing_providers');
    users.fields.removeByName('link_out');
    app.save(users);
  },
);
