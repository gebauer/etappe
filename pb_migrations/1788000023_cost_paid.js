/// <reference path="../pb_data/types.d.ts" />

// What's already been handed over on a price (WORK: phase 27). A booking is
// often a deposit now and the balance later; the planner wants to see the
// balance without doing the subtraction in their head.
//
// One number, not a "fully paid" flag: paid === amount *is* fully paid, and a
// bare boolean would drift out of sync the moment the price is edited. The
// app clamps writes into [0, amount]; this field just stores the figure.

migrate(
  (app) => {
    const costs = app.findCollectionByNameOrId('costs');
    costs.fields.push(new Field({ name: 'paid', type: 'number', min: 0 }));
    app.save(costs);
  },
  (app) => {
    const costs = app.findCollectionByNameOrId('costs');
    costs.fields.removeByName('paid');
    app.save(costs);
  },
);
