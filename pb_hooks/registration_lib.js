/// <reference path="../pb_data/types.d.ts" />

// The registration gate's helpers, required by registration.pb.js (author,
// 2026-09-13: "currently, the registration is completely open ... otherwise
// we get many bots").
//
// This file is not a *.pb.js hook, so PocketBase does not auto-run it — each
// handler pulls it in with require(), because hook handlers execute in
// isolated VMs and cannot see each other's top-level declarations (the same
// reason membership_lib.js exists).
//
// The decisions that govern who may sign in are pure, so they are testable
// without a running server — see `registration_lib.test.js`. The few
// functions that do read the environment are marked as such.

/** Lower-cased and trimmed; everything below compares in this form. */
function normalizeEmail(email) {
  return String(email == null ? '' : email)
    .trim()
    .toLowerCase();
}

/**
 * Is this address *at* the trusted domain — not merely containing it?
 *
 * The distinction is the whole point. A `~` "contains" test would welcome
 * `bot@trusted.example.net` and `trusted.example@spam.example`, which is
 * exactly what a bot farm tries. This compares the host after the last `@`
 * for equality.
 */
function isTrustedDomain(email, domain) {
  const host = String(domain == null ? '' : domain)
    .trim()
    .toLowerCase()
    .replace(/^@/, '');
  if (!host) return false;
  const address = normalizeEmail(email);
  const at = address.lastIndexOf('@');
  if (at < 1 || at === address.length - 1) return false;
  return address.slice(at + 1) === host;
}

/**
 * Whether an account may be used straight away, and why.
 *
 * An invite is an approval: someone who already has a trip asked for this
 * person by address, and making them wait for a second yes would mean the
 * invite email says "you're invited" while the app says no.
 */
function approvalFor(opts) {
  const o = opts || {};
  if (o.invited) return { approved: true, reason: 'invited' };
  if (isTrustedDomain(o.email, o.domain)) {
    return { approved: true, reason: 'domain' };
  }
  return { approved: false, reason: 'stranger' };
}

// --- environment, read per call: see the isolated-VM note above ---------

/** True only for an explicit `ETAPPE_OPEN_REGISTRATION=true`. */
function gateIsOff() {
  return (
    String($os.getenv('ETAPPE_OPEN_REGISTRATION') || '')
      .trim()
      .toLowerCase() === 'true'
  );
}

/**
 * The domain that needs no approval, from `APPROVED_EMAIL_DOMAIN`.
 *
 * Defaults to nothing, so an install that has not been told trusts nobody
 * and every registration waits for its owner. This repository is public: a
 * default naming one deployment's domain would have every fork of it
 * auto-approving addresses at someone else's.
 */
function trustedDomain() {
  return String($os.getenv('APPROVED_EMAIL_DOMAIN') || '').trim();
}

/** Where "someone signed up" goes; the SMTP sender is the fallback, which in
 * this deployment is the owner's own address. */
function ownerAddress(app) {
  const explicit = String($os.getenv('OWNER_EMAIL') || '').trim();
  if (explicit) return explicit;
  try {
    return app.settings().meta.senderAddress || '';
  } catch (_) {
    return '';
  }
}

/** Trailing slash trimmed, so a link can be built by concatenation. */
function appUrl() {
  return String($os.getenv('APP_URL') || '')
    .trim()
    .replace(/\/+$/, '');
}

function mailEnabled(app) {
  try {
    return !!app.settings().smtp.enabled;
  } catch (_) {
    return false;
  }
}

/** An invite is an approval — see `approvalFor`. */
function hasPendingInvite(app, email) {
  try {
    return (
      app.findRecordsByFilter(
        'invites',
        "email = {:email} && status = 'pending'",
        '',
        1,
        0,
        { email: email },
      ).length > 0
    );
  } catch (_) {
    return false;
  }
}

/** The one account holding this token, or null. Short tokens are refused
 * outright so a stray `/approve/x` cannot become a filter probe. */
function findByToken(app, token) {
  const t = String(token == null ? '' : token);
  if (t.length < 20) return null;
  try {
    return app.findFirstRecordByFilter('users', 'approval_token = {:token}', {
      token: t,
    });
  } catch (_) {
    return null;
  }
}

/** A whole page for one sentence: these links are opened from a mail app on
 * a phone, with no session and nothing else on screen to explain them. */
function resultPage(heading, body) {
  return (
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Etappe</title>' +
    '<body style="margin:0;display:flex;min-height:100dvh;align-items:center;' +
    'justify-content:center;background:oklch(0.17 0.012 250);color:oklch(0.92 0.006 250);' +
    'font:16px/1.5 system-ui,sans-serif;text-align:center">' +
    '<main style="max-width:32rem;padding:2rem">' +
    '<h1 style="font-size:1.25rem;margin:0 0 .5rem">' +
    escapeHtml(heading) +
    '</h1><p style="margin:0;color:oklch(0.70 0.01 250)">' +
    escapeHtml(body) +
    '</p></main>'
  );
}

/** The only untrusted thing on these pages is an email address, but it is
 * still user-supplied text going into markup. */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  normalizeEmail,
  isTrustedDomain,
  approvalFor,
  gateIsOff,
  trustedDomain,
  ownerAddress,
  appUrl,
  mailEnabled,
  hasPendingInvite,
  findByToken,
  resultPage,
  escapeHtml,
};
