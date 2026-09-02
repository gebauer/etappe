/// <reference path="../pb_data/types.d.ts" />

// Wishlist contributor attribution (WORK 15.1): assign every new account a
// stable colour so the same person reads the same hue in every trip and on
// every surface. Not a hash of the name, not picked from the palette at
// render time — stored on the user record, snapshotted onto each `pois`
// row they create.
//
// Fixed lightness/chroma band (L 0.74 / C 0.13), hue only varying, kept
// clear of the accent (215) and the wishlist amber (80). The first two
// match the design handoff's demo pair (Julia violet 300, Jan green 155).
// Wraps once the list is exhausted — a self-hosted trip for family and
// friends will not run out.
//
// `onRecordAfterCreateSuccess` + an explicit save, matching the existing
// `users` hook in `membership.pb.js` rather than a before-create mutation.

onRecordAfterCreateSuccess((e) => {
  const HUES = [300, 155, 350, 120, 265, 35, 175, 330, 255, 285];
  if (!e.record.get('color')) {
    const all = e.app.findRecordsByFilter('users', '1=1', 'created', 0, 0);
    let idx = 0;
    for (let i = 0; i < all.length; i++) {
      if (all[i].id === e.record.id) {
        idx = i;
        break;
      }
    }
    e.record.set('color', `oklch(0.74 0.13 ${HUES[idx % HUES.length]})`);
    e.app.save(e.record);
  }
  e.next();
}, 'users');
