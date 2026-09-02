/// <reference path="../pb_data/types.d.ts" />

// Wishlist contributor attribution (WORK 15.1). A shared trip's wishlist is
// where each planner's own research shows up, so every `pois` row records
// who added it. Deliberately wishlist-only — an itinerary stop carries no
// attribution, because the day plan is shared while the candidate list is
// personal.
//
// `pois.creator` is the provenance pointer (a user relation, like
// `blocks.creator`), `cascadeDelete: false` so a since-deleted account just
// leaves the pointer dangling rather than taking the idea with it. The
// contributor's name and colour are *snapshotted* onto the row at create
// time (`creator_name`, `creator_color`) rather than resolved through
// `users` at render time: the `users` collection is readable only by its
// own account (see WORK 16.6 / `1788000011`), and that is worth keeping —
// the same denormalise-what-you-need-to-show move `trip_members.label`
// already makes.
//
// `users.color` is the stable per-person assignment the snapshot copies
// from — one hue per account, in a fixed lightness/chroma band, hue only
// varying and staying clear of the accent (215) and the wishlist amber
// (80). Assigned on registration by `contributor_color.pb.js`; backfilled
// here for accounts that predate the field.

const HUES = [300, 155, 350, 120, 265, 35, 175, 330, 255, 285];
const colorForIndex = (i) => `oklch(0.74 0.13 ${HUES[i % HUES.length]})`;

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.push(new Field({ name: 'color', type: 'text' }));
    app.save(users);

    // Backfill existing accounts by creation order, so the assignment is
    // stable and matches what the hook would have done.
    const existing = app.findRecordsByFilter('users', '1=1', 'created', 0, 0);
    for (let i = 0; i < existing.length; i++) {
      const u = existing[i];
      if (u.get('color')) continue;
      u.set('color', colorForIndex(i));
      app.save(u);
    }

    const pois = app.findCollectionByNameOrId('pois');
    pois.fields.push(
      new Field({
        name: 'creator',
        type: 'relation',
        required: false,
        collectionId: users.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      }),
    );
    pois.fields.push(new Field({ name: 'creator_name', type: 'text' }));
    pois.fields.push(new Field({ name: 'creator_color', type: 'text' }));
    app.save(pois);
  },
  (app) => {
    const pois = app.findCollectionByNameOrId('pois');
    pois.fields.removeByName('creator');
    pois.fields.removeByName('creator_name');
    pois.fields.removeByName('creator_color');
    app.save(pois);

    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('color');
    app.save(users);
  },
);
