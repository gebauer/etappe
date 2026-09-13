/// <reference path="../pb_data/types.d.ts" />

// The registration gate (author, 2026-09-13). See the migration
// `1788000028_registration_gate.js` for what the two locks are and why the
// collection's auth rule — not this file — is what actually holds the door.
//
// This file does four things:
//   1. decides `approved` at registration, and pins it on every write
//   2. fails closed when the server cannot send mail
//   3. sends the verification link, and tells the owner someone signed up
//   4. serves the owner's one-click approve / reject links
//
// Every handler re-`require`s registration_lib.js and re-reads the
// environment: hook handlers run in isolated VMs and cannot see this file's
// top-level declarations (see the note in membership_lib.js).
//
// `ETAPPE_OPEN_REGISTRATION=true` switches the whole gate off, for local
// development and the browser checks — they have no SMTP and could not
// create the throwaway accounts they run on. It announces itself at boot so
// it cannot be on in production unnoticed.

onBootstrap((e) => {
  e.next();
  const { gateIsOff } = require(`${__hooks}/registration_lib.js`);
  if (gateIsOff()) {
    console.log(
      '[registration] ETAPPE_OPEN_REGISTRATION=true — the gate is OFF: ' +
        'anyone can register and sign in without verification or approval. ' +
        'This must not be set in production.',
    );
  }
});

// 1. Decide the account's standing before it is written. Never trust what
//    arrived: `approved` is hidden, but a hidden field is a rule about
//    responses, not a promise about payloads.
onRecordCreateRequest((e) => {
  const {
    approvalFor,
    gateIsOff,
    trustedDomain,
    mailEnabled,
    hasPendingInvite,
  } = require(`${__hooks}/registration_lib.js`);

  if (gateIsOff()) {
    e.record.set('approved', true);
    e.record.set('approval_token', '');
    // `verified` is a protected field: a create *request* may not set it,
    // whoever asks (PocketBase answers `validation_values_mismatch`). It is
    // flipped after the fact below, with the hook's own authority.
    return e.next();
  }

  // Fail closed (author's choice, 2026-09-13): without mail there is no
  // verification link and no way to ask the owner, so there is no honest
  // way to let someone in.
  if (!mailEnabled(e.app)) {
    throw new BadRequestError(
      'Registration is closed at the moment — the server cannot send email. Try again later.',
    );
  }

  const email = e.record.getString('email');
  const decision = approvalFor({
    email: email,
    domain: trustedDomain(),
    invited: hasPendingInvite(e.app, email),
  });

  e.record.set('approved', decision.approved);
  e.record.set(
    'approval_token',
    decision.approved ? '' : $security.randomString(40),
  );
  e.next();
}, 'users');

// 2. An account cannot promote itself. `users.updateRule` is
//    `id = @request.auth.id`, so without this the gate lasts exactly as long
//    as it takes someone to PATCH their own record.
onRecordUpdateRequest((e) => {
  const { gateIsOff } = require(`${__hooks}/registration_lib.js`);
  if (gateIsOff()) return e.next();
  let stored = null;
  try {
    stored = e.app.findRecordById('users', e.record.id);
  } catch (_) {
    stored = null;
  }
  if (stored) {
    e.record.set('approved', stored.get('approved'));
    e.record.set('approval_token', stored.get('approval_token'));
  }
  e.next();
}, 'users');

// 3. Send the verification link, and tell the owner. Both best effort: a
//    mail failure must not undo an account that is already written, and the
//    account is useless until verified anyway.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { gateIsOff, ownerAddress, appUrl } = require(
    `${__hooks}/registration_lib.js`,
  );
  if (gateIsOff()) {
    // Local dev and the browser checks: sign in straight away, no mail.
    try {
      e.record.setVerified(true);
      e.app.save(e.record);
    } catch (err) {
      console.log(`[registration] could not open the account: ${err}`);
    }
    return;
  }

  const record = e.record;
  const email = record.getString('email');
  const approved = !!record.get('approved');
  const token = record.getString('approval_token');

  // The verification link is the account's only way in, so a send that
  // fails leaves a record nobody can use and nobody knows about. Undo it
  // and say so — the same compensation membership.pb.js makes when a trip
  // cannot get its owner row. `smtp.enabled` is not enough on its own: it
  // is a stored setting, and it stays true after the host it names stops
  // answering (found while testing, 2026-09-13).
  try {
    $mails.sendRecordVerification(e.app, record);
  } catch (err) {
    console.log(`[registration] verification mail failed for ${email}: ${err}`);
    try {
      e.app.delete(record);
    } catch (_) {
      // best effort — an account with no verification mail is inert anyway
    }
    throw new BadRequestError(
      'Registration is closed at the moment — the server could not send the confirmation email. Try again later.',
    );
  }

  const to = ownerAddress(e.app);
  if (!to) return;
  const base = appUrl();
  const lines = [`A new Etappe account: ${email}`, ''];
  if (approved) {
    lines.push(
      'It is approved already — the address is on the trusted domain, or it was invited.',
      'They still have to confirm the address before they can sign in.',
    );
  } else if (base) {
    lines.push(
      'It is waiting for you. Nobody can sign in to it until you say yes.',
      '',
      `Approve: ${base}/api/registration/approve/${token}`,
      `Reject:  ${base}/api/registration/reject/${token}`,
      '',
      'Rejecting deletes the account. Doing nothing also keeps it out.',
    );
  } else {
    lines.push(
      'It is waiting for you, but APP_URL is not set, so there are no links to click.',
      'Approve it in the admin UI instead.',
    );
  }

  try {
    const settings = e.app.settings();
    const msg = new MailerMessage({
      from: {
        address: settings.meta.senderAddress,
        name: settings.meta.senderName,
      },
      to: [{ address: to }],
      subject: approved
        ? `Etappe: ${email} registered`
        : `Etappe: ${email} wants an account`,
      text: lines.join('\n'),
    });
    e.app.newMailClient().send(msg);
  } catch (err) {
    console.log(`[registration] owner mail failed for ${email}: ${err}`);
  }
}, 'users');

// 4. The owner's two links. Unguessable, single use, and they say plainly
//    what happened — they are read in a mail app on a phone, with no
//    session and nothing else on screen to explain them.
routerAdd('GET', '/api/registration/approve/{token}', (e) => {
  const { findByToken, resultPage } = require(`${__hooks}/registration_lib.js`);
  const user = findByToken(e.app, e.request.pathValue('token'));
  if (!user) {
    return e.html(
      404,
      resultPage(
        'Nothing to approve',
        'This link has already been used, or the account is gone.',
      ),
    );
  }
  user.set('approved', true);
  user.set('approval_token', '');
  e.app.save(user);
  return e.html(
    200,
    resultPage(
      'Approved',
      `${user.getString('email')} can sign in once they confirm their email address.`,
    ),
  );
});

routerAdd('GET', '/api/registration/reject/{token}', (e) => {
  const { findByToken, resultPage } = require(`${__hooks}/registration_lib.js`);
  const user = findByToken(e.app, e.request.pathValue('token'));
  if (!user) {
    return e.html(
      404,
      resultPage(
        'Nothing to reject',
        'This link has already been used, or the account is gone.',
      ),
    );
  }
  const email = user.getString('email');
  e.app.delete(user);
  return e.html(200, resultPage('Rejected', `${email} has been deleted.`));
});
