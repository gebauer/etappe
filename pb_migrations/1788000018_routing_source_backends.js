/// <reference path="../pb_data/types.d.ts" />

// `legs.routing_source` names the engine that answered (WORK 19.6).
//
// It was `ors | manual`, and `buildLegRecord` wrote the literal 'ors' for
// every routed leg — so once HERE existed (WORK 19.2) every HERE-routed leg
// was filed under the wrong engine. Nothing depended on the value beyond
// `!== 'manual'`, so the mislabelling was invisible until the leg row
// started showing which API produced a number.
//
// Existing rows are left as 'ors': they were routed before HERE was
// selectable, so 'ors' is what they actually are.

migrate(
  (app) => {
    const legs = app.findCollectionByNameOrId('legs');
    legs.fields.getByName('routing_source').values = [
      'ors',
      'here',
      'osrm',
      'manual',
    ];
    app.save(legs);
  },
  (app) => {
    const legs = app.findCollectionByNameOrId('legs');
    // Anything routed by an engine the old schema never knew about becomes
    // 'ors', the only routed value it accepts.
    for (const leg of app.findAllRecords('legs')) {
      const src = String(leg.get('routing_source') || '');
      if (src === 'here' || src === 'osrm') {
        leg.set('routing_source', 'ors');
        app.save(leg);
      }
    }
    const fresh = app.findCollectionByNameOrId('legs');
    fresh.fields.getByName('routing_source').values = ['ors', 'manual'];
    app.save(fresh);
  },
);
