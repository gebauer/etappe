/// <reference path="../pb_data/types.d.ts" />

// Fixes two bugs in the initial schema (1788000000):
//
// 1. Membership rules compared @collection.trip_members fields with `=`, but a
//    @collection join needs the any-match `?=` or it matches nothing — so every
//    collection's rules rejected legitimate members. The editor check also has
//    to be expressed as explicit role alternatives (a `!= 'viewer'` on the join
//    does not correlate to the same row).
// 2. `order_index` was `required`, and PocketBase treats a required number's 0
//    as blank — so the first day/stop/activity (index 0) could never be
//    created. Same class of bug would block a 0% trips.car_buffer_pct.

migrate(
  (app) => {
    const read = (t) =>
      "@request.auth.id != '' && @collection.trip_members.user ?= @request.auth.id && @collection.trip_members.trip ?= " +
      t;
    const write = (t) =>
      read(t) +
      " && (@collection.trip_members.role ?= 'owner' || @collection.trip_members.role ?= 'editor')";
    const owner = (t) =>
      read(t) + " && @collection.trip_members.role ?= 'owner'";

    const setRules = (name, r) => {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = r.list;
      c.viewRule = r.view;
      c.createRule = r.create;
      c.updateRule = r.update;
      c.deleteRule = r.delete;
      app.save(c);
    };

    setRules('trips', {
      list: read('id'),
      view: read('id'),
      create: "@request.auth.id != '' && owner = @request.auth.id",
      update: write('id'),
      delete: owner('id'),
    });
    setRules('trip_members', {
      list: read('trip'),
      view: read('trip'),
      create: owner('trip'),
      update: owner('trip'),
      delete: owner('trip'),
    });

    const member = (name, t) =>
      setRules(name, {
        list: read(t),
        view: read(t),
        create: write(t),
        update: write(t),
        delete: write(t),
      });
    member('days', 'trip');
    member('stops', 'day.trip');
    member('activities', 'stop.day.trip');
    member('legs', 'from_stop.day.trip');
    member('costs', 'trip');
    member('pois', 'trip');

    const privateVis =
      " && (visibility != 'private' || creator = @request.auth.id)";
    setRules('blocks', {
      list: read('trip') + privateVis,
      view: read('trip') + privateVis,
      create: write('trip') + ' && creator = @request.auth.id',
      update: write('trip'),
      delete: write('trip'),
    });
    setRules('invites', {
      list: read('trip'),
      view: read('trip'),
      create: owner('trip') + ' && invited_by = @request.auth.id',
      update: owner('trip'),
      delete: owner('trip'),
    });

    // Allow order_index 0 (the normal first position).
    for (const name of ['days', 'stops', 'activities']) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.getByName('order_index').required = false;
      app.save(c);
    }
    // Allow a 0% car buffer.
    const trips = app.findCollectionByNameOrId('trips');
    trips.fields.getByName('car_buffer_pct').required = false;
    app.save(trips);
  },
  (app) => {
    // Revert only the field flags; the buggy rules are not worth restoring.
    for (const name of ['days', 'stops', 'activities']) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.getByName('order_index').required = true;
      app.save(c);
    }
    const trips = app.findCollectionByNameOrId('trips');
    trips.fields.getByName('car_buffer_pct').required = true;
    app.save(trips);
  },
);
