/// <reference path="../pb_data/types.d.ts" />

// Unify wishlist ideas and stops (WORK 14.1): a POI becomes "a stop without
// a day" — they share title/kind/lat/lon/address/access point/star and the
// whole block system, and a POI adds nothing of its own once `status` is
// gone. Promoting an idea to a stop now re-parents its blocks and deletes
// the POI outright (WORK 14.2) rather than leaving a hidden `scheduled`
// tombstone, so `status` has no reader left and free text/links move fully
// onto blocks (`note`/`link`), matching how a stop already represents them.
//
// `status != 'idea'` rows are the tombstones themselves — `listWishlist`
// only ever showed `idea`, so nothing in the app has read a `scheduled` or
// `rejected` row since it was set. Dropped rather than resurrected.

migrate(
  (app) => {
    const stale = app.findRecordsByFilter(
      'pois',
      "status != 'idea'",
      '',
      2000,
      0,
    );
    for (const rec of stale) app.delete(rec);

    const pois = app.findCollectionByNameOrId('pois');
    pois.fields.removeByName('url');
    pois.fields.removeByName('notes');
    pois.fields.removeByName('status');
    pois.fields.push(new Field({ name: 'access_lat', type: 'number' }));
    pois.fields.push(new Field({ name: 'access_lon', type: 'number' }));
    pois.fields.push(new Field({ name: 'address', type: 'text' }));
    app.save(pois);

    const stops = app.findCollectionByNameOrId('stops');
    stops.fields.push(new Field({ name: 'starred', type: 'bool' }));
    app.save(stops);
  },
  (app) => {
    const stops = app.findCollectionByNameOrId('stops');
    stops.fields.removeByName('starred');
    app.save(stops);

    const pois = app.findCollectionByNameOrId('pois');
    pois.fields.removeByName('access_lat');
    pois.fields.removeByName('access_lon');
    pois.fields.removeByName('address');
    pois.fields.push(new Field({ name: 'url', type: 'url' }));
    pois.fields.push(new Field({ name: 'notes', type: 'text' }));
    pois.fields.push(
      new Field({
        name: 'status',
        type: 'select',
        maxSelect: 1,
        values: ['idea', 'scheduled', 'rejected'],
      }),
    );
    app.save(pois);
  },
);
