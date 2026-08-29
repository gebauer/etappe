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
  const collection = app.findCollectionByNameOrId('trip_members');
  const member = new Record(collection, {
    trip: tripId,
    user: userId,
    role: role,
  });
  app.save(member);
}

module.exports = { ensureMembership };
