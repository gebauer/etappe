/// <reference path="../pb_data/types.d.ts" />

// A members panel needs to show who the members are (WORK 16.6), and the
// `users` collection is readable only by the account it belongs to
// (`id = @request.auth.id`) — deliberately, and worth keeping that way.
// Rather than opening users up to "anyone who shares a trip with me", which
// is awkward to express as a rule and exposes more than a name, the
// membership row carries the label it needs: the email the person was
// invited by. trip_members is already readable by every member of the trip.
//
// Backfilled from the users table for memberships that predate this.

migrate(
  (app) => {
    const members = app.findCollectionByNameOrId('trip_members');
    members.fields.push(new Field({ name: 'label', type: 'text' }));
    app.save(members);

    for (const row of app.findRecordsByFilter('trip_members', '1=1', '', 0, 0)) {
      try {
        const user = app.findRecordById('users', row.get('user'));
        row.set('label', user.get('email'));
        app.save(row);
      } catch (_) {
        // A membership whose user is gone keeps an empty label.
      }
    }
  },
  (app) => {
    const members = app.findCollectionByNameOrId('trip_members');
    members.fields.removeByName('label');
    app.save(members);
  },
);
