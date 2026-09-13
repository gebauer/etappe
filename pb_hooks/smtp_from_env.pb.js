/// <reference path="../pb_data/types.d.ts" />

// SMTP from the environment (Phase 22). PocketBase keeps mail settings in the
// database, but this deployment's source of truth is the container env — the
// same choice `scripts/docker-entrypoint.sh` makes for the superuser. Applied
// on every boot so changing `SMTP_*` and restarting takes effect; leaving
// `SMTP_HOST` empty leaves mail disabled and the app works unchanged (invites
// are still created, just not emailed).

onBootstrap((e) => {
  e.next(); // settings are only available once bootstrap has run

  const host = ($os.getenv('SMTP_HOST') || '').trim();
  if (!host) return;

  try {
    const s = $app.settings();
    s.smtp.enabled = true;
    s.smtp.host = host;
    s.smtp.port = parseInt($os.getenv('SMTP_PORT') || '587', 10);
    s.smtp.username = $os.getenv('SMTP_USERNAME') || '';
    s.smtp.password = $os.getenv('SMTP_PASSWORD') || '';
    // tls=true forces TLS; the default (false) sends STARTTLS and lets the
    // server decide. Opt in explicitly with SMTP_TLS=true.
    s.smtp.tls = ($os.getenv('SMTP_TLS') || '').toLowerCase() === 'true';

    const from = ($os.getenv('SMTP_SENDER_ADDRESS') || '').trim();
    const fromName = ($os.getenv('SMTP_SENDER_NAME') || '').trim();
    if (from) s.meta.senderAddress = from;
    if (fromName) s.meta.senderName = fromName;

    // The name and URL PocketBase's own templates interpolate. Without
    // these the verification mail introduces the app as "Acme" and points
    // its confirm link at whatever `appURL` was left as — which is
    // localhost, and therefore a dead link for everyone (found while
    // testing the registration gate, 2026-09-13).
    s.meta.appName = ($os.getenv('APP_NAME') || 'Etappe').trim();
    const url = ($os.getenv('APP_URL') || '').trim().replace(/\/+$/, '');
    if (url) s.meta.appURL = url;

    $app.save(s);
    console.log(
      `[smtp] configured from env: ${host}:${s.smtp.port} as ${s.meta.appName} (${s.meta.appURL})`,
    );
  } catch (err) {
    console.log(`[smtp] could not apply env config: ${err}`);
  }
});
