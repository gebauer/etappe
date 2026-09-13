/// <reference path="../pb_data/types.d.ts" />

// Who the owner is, and where their admin UI lives (author, 2026-09-13).
//
// The client cannot work this out for itself: `OWNER_EMAIL` is server
// configuration, and the alternative — shipping the owner's address in the
// bundle for every visitor to read — trades a round trip for a disclosure.
// So the server answers the only question the UI has: is the person asking
// the owner, and if so what should the link point at.
//
// This is a convenience, not a lock. `/_/` is PocketBase's own dashboard
// behind its own superuser login; hiding the link from everyone else keeps
// the UI honest about who it is for, and nothing more.

routerAdd('GET', '/api/owner', (e) => {
  const owner = String($os.getenv('OWNER_EMAIL') || '')
    .trim()
    .toLowerCase();
  const email = e.auth
    ? String(e.auth.getString('email') || '')
        .trim()
        .toLowerCase()
    : '';
  const isOwner = !!owner && !!email && email === owner;

  return e.json(200, {
    isOwner: isOwner,
    // Same origin by default — Vite proxies `/_` to PocketBase in dev, and
    // in production PocketBase serves both. `PB_ADMIN_URL` is for a
    // deployment that puts the dashboard somewhere else.
    adminUrl: isOwner
      ? String($os.getenv('PB_ADMIN_URL') || '').trim() || '/_/'
      : '',
  });
});
