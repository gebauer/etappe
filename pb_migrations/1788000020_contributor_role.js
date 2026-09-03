/// <reference path="../pb_data/types.d.ts" />

// A fourth membership role, `contributor`, sitting between `editor` and
// `viewer` (author request): it can create and edit **every** wishlist
// `pois` row and the note/link/photo `blocks` hanging off them, but it
// cannot touch the itinerary — no stops, days, legs, costs, trip settings,
// promotion of a poi to a stop, or member management. A `viewer` stays
// strictly read-only.
//
// The poi-block scoping is fully declarative: `blocks.parent_type` is a real
// select field (`stop|trip|day|leg|poi`), so "only poi blocks for a
// contributor" is `parent_type = 'poi'` in the rule — no hook needed.
//
// Rule helpers mirror 1788000003. Same-alias `?=` role alternatives
// correlate to one `trip_members` row (verified there), so `poiWrite` is
// just `write` with one extra alternative.

migrate(
  (app) => {
    // 1. Widen the two role enums.
    for (const [name, field] of [
      ['trip_members', 'role'],
      ['invites', 'role'],
    ]) {
      const c = app.findCollectionByNameOrId(name);
      const f = c.fields.getByName(field);
      if (!f.values.includes('contributor')) {
        f.values = [...f.values, 'contributor'];
        app.save(c);
      }
    }

    // 2. Rules.
    const read = (t) =>
      "@request.auth.id != '' && @collection.trip_members.user ?= @request.auth.id && @collection.trip_members.trip ?= " +
      t;
    const write = (t) =>
      read(t) +
      " && (@collection.trip_members.role ?= 'owner' || @collection.trip_members.role ?= 'editor')";
    const poiWrite = (t) =>
      read(t) +
      " && (@collection.trip_members.role ?= 'owner' || @collection.trip_members.role ?= 'editor' || @collection.trip_members.role ?= 'contributor')";

    const setRules = (name, r) => {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = r.list;
      c.viewRule = r.view;
      c.createRule = r.create;
      c.updateRule = r.update;
      c.deleteRule = r.delete;
      app.save(c);
    };

    // pois — a contributor gets full CRUD on the whole wishlist.
    setRules('pois', {
      list: read('trip'),
      view: read('trip'),
      create: poiWrite('trip'),
      update: poiWrite('trip'),
      delete: poiWrite('trip'),
    });

    // blocks — a contributor may only reach blocks whose parent is a poi.
    const privateVis =
      " && (visibility != 'private' || creator = @request.auth.id)";
    const poiBlock = (t) => `(${poiWrite(t)}) && parent_type = 'poi'`;
    setRules('blocks', {
      list: read('trip') + privateVis,
      view: read('trip') + privateVis,
      create: `(${write('trip')} || ${poiBlock('trip')}) && creator = @request.auth.id`,
      update: `${write('trip')} || ${poiBlock('trip')}`,
      delete: `${write('trip')} || ${poiBlock('trip')}`,
    });
  },
  (app) => {
    // Restore the editor-only rules and drop the enum value.
    const read = (t) =>
      "@request.auth.id != '' && @collection.trip_members.user ?= @request.auth.id && @collection.trip_members.trip ?= " +
      t;
    const write = (t) =>
      read(t) +
      " && (@collection.trip_members.role ?= 'owner' || @collection.trip_members.role ?= 'editor')";
    const setRules = (name, r) => {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = r.list;
      c.viewRule = r.view;
      c.createRule = r.create;
      c.updateRule = r.update;
      c.deleteRule = r.delete;
      app.save(c);
    };
    setRules('pois', {
      list: read('trip'),
      view: read('trip'),
      create: write('trip'),
      update: write('trip'),
      delete: write('trip'),
    });
    const privateVis =
      " && (visibility != 'private' || creator = @request.auth.id)";
    setRules('blocks', {
      list: read('trip') + privateVis,
      view: read('trip') + privateVis,
      create: write('trip') + ' && creator = @request.auth.id',
      update: write('trip'),
      delete: write('trip'),
    });
    for (const [name, field] of [
      ['trip_members', 'role'],
      ['invites', 'role'],
    ]) {
      const c = app.findCollectionByNameOrId(name);
      const f = c.fields.getByName(field);
      f.values = f.values.filter((v) => v !== 'contributor');
      app.save(c);
    }
  },
);
