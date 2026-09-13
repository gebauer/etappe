#!/usr/bin/env node
/**
 * The registration gate (author, 2026-09-13: "currently the registration is
 * completely open ... otherwise we get many bots").
 *
 * Talks to the API rather than the browser: what is being checked is who
 * may authenticate, and that is decided by the collection's auth rule, not
 * by anything the UI does.
 *
 * Needs a backend with the gate ON and mail pointed at `mail-sink.py` —
 * see SKILL.md, "Testing the registration gate". It refuses to run against
 * an open backend rather than passing vacuously.
 */

import { readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const API = process.env.ETAPPE_API_URL ?? 'http://127.0.0.1:8090';
const MAILDIR = process.env.ETAPPE_MAIL_DIR ?? '/tmp/etappe-mail';
const DOMAIN = process.env.APPROVED_EMAIL_DOMAIN ?? 'trusted.example';
const PASSWORD = 'TestPass123!';

function expect(cond, message) {
  if (!cond) throw new Error(message);
  console.log('  ok:', message);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, init) {
  const res = await fetch(`${API}${pathname}`, init);
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = null;
  }
  return { status: res.status, body };
}

const register = (email) =>
  api('/api/collections/users/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      passwordConfirm: PASSWORD,
    }),
  });

const authenticate = (email) =>
  api('/api/collections/users/auth-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password: PASSWORD }),
  });

/** Every message the sink has written since it was last emptied. */
function mails() {
  return readdirSync(MAILDIR)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => readFileSync(path.join(MAILDIR, f), 'utf8'));
}

function clearMail() {
  for (const f of readdirSync(MAILDIR).filter((f) => f.endsWith('.txt'))) {
    rmSync(path.join(MAILDIR, f));
  }
}

/** Wait for the sink, which the server writes to on its own schedule. */
async function waitForMail(count, timeoutMs = 8000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const found = mails();
    if (found.length >= count) return found;
    await sleep(250);
  }
  return mails();
}

const firstMatch = (haystack, re) => {
  for (const text of haystack) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
};

async function main() {
  try {
    readdirSync(MAILDIR);
  } catch (_) {
    console.error(
      `No mail directory at ${MAILDIR}. Start mail-sink.py first — see SKILL.md.`,
    );
    process.exit(1);
  }

  const stamp = Date.now();
  const stranger = `gate-stranger-${stamp}@example.com`;
  const insider = `gate-insider-${stamp}@${DOMAIN}`;

  try {
    console.log('--- a stranger registers ---');
    clearMail();
    const created = await register(stranger);
    if (created.status === 400) {
      console.error(
        `\nThe server refused to register at all: ${created.body?.message}\n` +
          'That is the fail-closed path — its mail server is unreachable. ' +
          'Point SMTP_HOST/SMTP_PORT at mail-sink.py and restart.',
      );
      process.exit(1);
    }
    expect(created.status === 200, 'the account is created');

    const signedIn = await authenticate(stranger);
    if (signedIn.status === 200) {
      console.error(
        '\nThis backend has the gate OFF (ETAPPE_OPEN_REGISTRATION=true), so ' +
          'there is nothing here to test. Restart it without that flag.',
      );
      process.exit(1);
    }
    expect(signedIn.status === 403, 'but it cannot sign in');

    console.log('--- the owner is told, with links ---');
    const inbox = await waitForMail(2);
    expect(
      inbox.length >= 2,
      'two mails went out: the registrant and the owner',
    );
    const approve = firstMatch(inbox, /registration\/approve\/([A-Za-z0-9]+)/);
    const reject = firstMatch(inbox, /registration\/reject\/([A-Za-z0-9]+)/);
    expect(
      !!approve && approve.length >= 20,
      'the approve link carries a long token',
    );
    expect(!!reject, 'and there is a way to say no');
    const verify = firstMatch(inbox, /confirm-verification\/([A-Za-z0-9._-]+)/);
    expect(!!verify, 'the registrant gets a verification link');
    expect(
      inbox.some((m) => /Verify your Etappe/.test(m)),
      'which introduces the app by name, not as PocketBase\'s "Acme"',
    );

    console.log('--- approval alone is not enough ---');
    const approved = await fetch(`${API}/api/registration/approve/${approve}`);
    expect(approved.status === 200, "the owner's link works");
    expect(
      (await authenticate(stranger)).status === 403,
      'approved but unverified still cannot sign in',
    );

    console.log('--- nor is verification alone ---');
    clearMail();
    const second = `gate-unapproved-${stamp}@example.com`;
    await register(second);
    const inbox2 = await waitForMail(2);
    const verify2 = firstMatch(
      inbox2,
      /confirm-verification\/([A-Za-z0-9._-]+)/,
    );
    await api('/api/collections/users/confirm-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verify2 }),
    });
    expect(
      (await authenticate(second)).status === 403,
      'verified but unapproved cannot sign in either',
    );

    console.log('--- both, and the door opens ---');
    const confirmed = await api('/api/collections/users/confirm-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verify }),
    });
    expect(confirmed.status === 204, 'the address confirms itself');
    expect(
      (await authenticate(stranger)).status === 200,
      'and now they are in',
    );

    console.log("--- the owner's link is single use ---");
    const again = await fetch(`${API}/api/registration/approve/${approve}`);
    expect(again.status === 404, 'a used approve link approves nothing else');

    console.log(`--- the trusted domain needs no yes (${DOMAIN}) ---`);
    clearMail();
    await register(insider);
    const inbox3 = await waitForMail(2);
    expect(
      inbox3.some((m) => /approved already/.test(m)),
      'the owner is told, but not asked',
    );
    expect(
      !inbox3.some((m) => /registration\/approve\//.test(m)),
      'and gets no approve link, because there is nothing to approve',
    );
    const verify3 = firstMatch(
      inbox3,
      /confirm-verification\/([A-Za-z0-9._-]+)/,
    );
    expect(
      (await authenticate(insider)).status === 403,
      'the trusted domain still has to prove the address is real',
    );
    await api('/api/collections/users/confirm-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verify3 }),
    });
    expect(
      (await authenticate(insider)).status === 200,
      'and then it is in, with no owner involved',
    );

    console.log('--- rejecting deletes ---');
    clearMail();
    const doomed = `gate-rejected-${stamp}@example.com`;
    await register(doomed);
    const inbox4 = await waitForMail(2);
    const rejectToken = firstMatch(
      inbox4,
      /registration\/reject\/([A-Za-z0-9]+)/,
    );
    const rejected = await fetch(
      `${API}/api/registration/reject/${rejectToken}`,
    );
    expect(rejected.status === 200, 'the reject link works');
    expect(
      (await register(doomed)).status === 200,
      'and the address is free again, so the record really is gone',
    );

    console.log('\nPASS');
  } catch (err) {
    console.error('\nFAIL:', err.message ?? err);
    process.exitCode = 1;
  }
}

main();
