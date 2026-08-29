/// <reference path="../pb_data/types.d.ts" />

// Membership side effects (WORK 1.3). Trip creation, invites and registration
// each need a trip_members row created with superuser authority (the API rules
// deliberately forbid clients from bootstrapping their own membership). Shared
// logic lives in membership_lib.js — see the note there on isolated VMs.

// 1. A new trip's owner becomes its first member. Compensate by deleting the
//    trip if that fails, since without it the creator cannot see the trip.
onRecordAfterCreateSuccess((e) => {
  const { ensureMembership } = require(`${__hooks}/membership_lib.js`);
  try {
    ensureMembership(e.app, e.record.id, e.record.get('owner'), 'owner');
  } catch (err) {
    try {
      e.app.delete(e.record);
    } catch (_) {
      // best effort
    }
    throw err;
  }
  e.next();
}, 'trips');

// 2. An invite for an already-registered email is materialised immediately.
onRecordAfterCreateSuccess((e) => {
  const { ensureMembership } = require(`${__hooks}/membership_lib.js`);
  const email = e.record.get('email');
  let user = null;
  try {
    user = e.app.findAuthRecordByEmail('users', email);
  } catch (_) {
    user = null;
  }
  if (user) {
    ensureMembership(
      e.app,
      e.record.get('trip'),
      user.id,
      e.record.get('role'),
    );
    e.record.set('status', 'accepted');
    e.app.save(e.record);
  }
  e.next();
}, 'invites');

// 3. On registration, materialise every pending invite for that email.
onRecordAfterCreateSuccess((e) => {
  const { ensureMembership } = require(`${__hooks}/membership_lib.js`);
  const email = e.record.get('email');
  const invites = e.app.findRecordsByFilter(
    'invites',
    "email = {:email} && status = 'pending'",
    '',
    200,
    0,
    { email: email },
  );
  for (let i = 0; i < invites.length; i++) {
    const invite = invites[i];
    if (!invite) continue;
    ensureMembership(
      e.app,
      invite.get('trip'),
      e.record.id,
      invite.get('role'),
    );
    invite.set('status', 'accepted');
    e.app.save(invite);
  }
  e.next();
}, 'users');
