/// <reference path="../pb_data/types.d.ts" />

// Enable the transactional batch API. Day reordering (phase 1.2) rewrites many
// days' order_index in a single all-or-nothing batch; without this the SDK's
// createBatch() requests are rejected.

migrate(
  (app) => {
    const settings = app.settings();
    settings.batch.enabled = true;
    settings.batch.maxRequests = 200; // long trips reindex many days at once
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.batch.enabled = false;
    app.save(settings);
  },
);
