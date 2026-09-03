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

/** A person's display name: their chosen `name`, else the local part of
 * their email, else the raw id. Mirrors `contributorName()` on the client. */
function displayName(app, userId) {
  try {
    const u = app.findRecordById('users', userId);
    const name = (u.get('name') || '').trim();
    if (name) return name;
    const email = u.get('email') || '';
    return email.indexOf('@') > 0 ? email.slice(0, email.indexOf('@')) : email;
  } catch (_) {
    return 'Someone';
  }
}

/**
 * Email the person an invite touches — best effort, never throws.
 *
 * - `accepted` true  → they already had an account and were added straight
 *   to the trip: a plain "you're on the trip now" note.
 * - `accepted` false → no account yet: "register with this address to
 *   accept".
 *
 * No-ops silently unless SMTP is configured (`smtp_from_env.pb.js` sets it
 * from the container env).
 */
function sendInviteMail(app, opts) {
  try {
    if (!app.settings().smtp.enabled) return;
  } catch (_) {
    return;
  }
  const appUrl = ($os.getenv('APP_URL') || '').trim() || 'the app';
  const from = {
    address: app.settings().meta.senderAddress,
    name: app.settings().meta.senderName,
  };
  const subject = opts.accepted
    ? `${opts.inviterName} added you to “${opts.tripTitle}” on Etappe`
    : `${opts.inviterName} invited you to plan “${opts.tripTitle}” on Etappe`;
  const text = opts.accepted
    ? `${opts.inviterName} added you to the trip “${opts.tripTitle}” as ${opts.role}.\n\n` +
      `Open Etappe to see it: ${appUrl}`
    : `${opts.inviterName} wants you to help plan the trip “${opts.tripTitle}” on Etappe (as ${opts.role}).\n\n` +
      `Create an account with this email address to accept: ${appUrl}`;
  try {
    const msg = new MailerMessage({
      from: from,
      to: [{ address: opts.to }],
      subject: subject,
      text: text,
    });
    app.newMailClient().send(msg);
  } catch (err) {
    console.log(`[invite mail] send failed for ${opts.to}: ${err}`);
  }
}

module.exports = { ensureMembership, displayName, sendInviteMail };
