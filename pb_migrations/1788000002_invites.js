/// <reference path="../pb_data/types.d.ts" />

// Pending invites (WORK 1.3). An owner invites by email; if the invitee has no
// account yet the invite stays `pending` and is materialised into a
// trip_members row when that email registers (see pb_hooks/membership.js).

migrate(
  (app) => {
    const trips = app.findCollectionByNameOrId('trips').id;
    const users = app.findCollectionByNameOrId('users').id;

    const invites = new Collection({
      type: 'base',
      name: 'invites',
      fields: [
        {
          name: 'trip',
          type: 'relation',
          required: true,
          maxSelect: 1,
          minSelect: 0,
          collectionId: trips,
          cascadeDelete: true,
        },
        { name: 'email', type: 'email', required: true },
        {
          name: 'role',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['owner', 'editor', 'viewer'],
        },
        {
          name: 'invited_by',
          type: 'relation',
          required: true,
          maxSelect: 1,
          minSelect: 0,
          collectionId: users,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pending', 'accepted', 'revoked'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_invites_trip_email` ON `invites` (`trip`, `email`)',
        'CREATE INDEX `idx_invites_email_status` ON `invites` (`email`, `status`)',
      ],
    });
    app.save(invites);

    const read =
      "@request.auth.id != '' && @collection.trip_members.user = @request.auth.id && @collection.trip_members.trip = trip";
    const owner = read + " && @collection.trip_members.role = 'owner'";
    invites.listRule = read;
    invites.viewRule = read;
    invites.createRule = owner + ' && invited_by = @request.auth.id';
    invites.updateRule = owner;
    invites.deleteRule = owner;
    app.save(invites);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('invites'));
    } catch (_) {
      // already removed
    }
  },
);
