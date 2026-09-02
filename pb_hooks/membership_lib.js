// Shared membership helpers, required by membership.pb.js. This file is not a
// *.pb.js hook, so PocketBase does not auto-run it — each handler pulls it in
// with require(), because hook handlers execute in isolated VMs and cannot see
// each other's top-level declarations.

function ensureMembership(app, tripId, userId, role) {
  try {
    app.findFirstRecordByFilter(
      'trip_members',
      'trip = {:trip} && user = {:user}',
      { trip: tripId, user: userId },
    );
    return; // already a member
  } catch (_) {
    // not found -> create below
  }
  // The membership carries the person's email so a members panel can name
  // them: `users` is readable only by its own account, and keeping it that
  // way is better than widening it to everyone who shares a trip (WORK 16.6,
  // migration 1788000011).
  let label = '';
  try {
    label = app.findRecordById('users', userId).get('email');
  } catch (_) {
    // No user record to read from — the panel falls back to the role.
  }
  const collection = app.findCollectionByNameOrId('trip_members');
  const member = new Record(collection, {
    trip: tripId,
    user: userId,
    role: role,
    label: label,
  });
  app.save(member);
}

module.exports = { ensureMembership };
