/// <reference path="../pb_data/types.d.ts" />

// The registration gate (author, 2026-09-13: "currently the registration is
// completely open ... otherwise we get many bots").
//
// Two locks, both enforced by the collection's own auth rule rather than by
// the client, because the client is not the thing a bot talks to:
//
//   `verified`  — PocketBase's own. The address has to receive a link and
//                 have it clicked. Without this the domain rule below is
//                 worthless: anyone could claim an address at the trusted domain and be
//                 waved through by a domain they do not own.
//   `approved`  — ours. True for the trusted domain and for anyone holding
//                 an invite; otherwise it waits for the owner to say yes
//                 (one-click link, `pb_hooks/registration.pb.js`).
//
// `approved` is **hidden**: never echoed to a client, and not settable
// through the API by the account itself — `users.updateRule` is
// `id = @request.auth.id`, so without that a registration could simply
// approve itself. `registration.pb.js` pins it on every write as well; a
// gate worth having is worth two locks.
//
// `createRule` stays open. Registration itself is not the thing to close —
// signing *in* is. An unapproved record is inert: it can hold nothing and
// reach nothing, since every other rule keys off `@request.auth.id`.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.fields.push(
      new BoolField({
        name: 'approved',
        hidden: true,
        required: false,
      }),
    );
    users.fields.push(
      new TextField({
        name: 'approval_token',
        hidden: true,
        required: false,
      }),
    );

    users.authRule = 'verified = true && approved = true';
    app.save(users);

    // Everyone who already has an account keeps it. Without this the gate
    // closes on the people it is meant to protect — including the owner,
    // who would have no way back in short of the admin UI.
    const existing = app.findAllRecords('users');
    for (let i = 0; i < existing.length; i++) {
      const u = existing[i];
      u.set('approved', true);
      u.setVerified(true);
      app.save(u);
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('approved');
    users.fields.removeByName('approval_token');
    users.authRule = '';
    app.save(users);
  },
);
