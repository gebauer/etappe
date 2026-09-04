/// <reference path="../pb_data/types.d.ts" />

// Backfill wishlist contributor attribution (WORK 15.1 added the fields;
// this fills the gap). Every `pois` row imported before phase 15.1 landed —
// the whole first Highlights import of a trip, in practice — has an empty
// `creator` / `creator_name` / `creator_color`, so it shows no contributor
// mark anywhere and reads as belonging to nobody.
//
// A self-hosted trip's wishlist was imported by whoever owns the trip, so
// that is the stamp: for each unattributed poi, copy the trip owner's id,
// display name (nickname, else email local part — same rule as
// `contributorName`) and colour onto the row. Rows that already carry a
// creator are left alone, so this only ever touches the legacy import.
//
// No `down`: once stamped, a backfilled row is indistinguishable from one
// created normally, so there is nothing safe to undo.

migrate(
  (app) => {
    const owners = {}; // tripId -> { id, name, color } | null (miss)

    const ownerOf = (tripId) => {
      if (tripId in owners) return owners[tripId];
      let info = null;
      try {
        const trip = app.findRecordById('trips', tripId);
        const user = app.findRecordById('users', trip.get('owner'));
        const email = user.get('email') || '';
        const at = email.indexOf('@');
        const local = at > 0 ? email.slice(0, at) : email;
        info = {
          id: user.id,
          name: (user.get('name') || '').trim() || local,
          color: user.get('color') || '',
        };
      } catch (_) {
        info = null; // trip or owner gone — leave the poi as-is
      }
      owners[tripId] = info;
      return info;
    };

    const pois = app.findRecordsByFilter('pois', '1=1', '', 0, 0);
    for (const poi of pois) {
      if (poi.get('creator')) continue;
      const owner = ownerOf(poi.get('trip'));
      if (!owner) continue;
      poi.set('creator', owner.id);
      poi.set('creator_name', owner.name);
      poi.set('creator_color', owner.color);
      app.save(poi);
    }
  },
  (_app) => {
    // Irreversible — see the note above.
  },
);
