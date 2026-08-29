/// <reference path="../pb_data/types.d.ts" />

// Initial Etappe schema (BUILD §2): every collection, its fields, indexes and
// role-based API rules.
//
// Rules are applied in a second pass. trip_members relates to trips, and every
// collection's rules reference @collection.trip_members, so the collections
// must all exist before any rule that names them can be validated.
//
// Note: `blocks.creator` is not in BUILD §2's field list but is required to
// enforce "private blocks readable only by their creator" (§2/§10). The stop
// `kind` enum mirrors src/lib/taxonomy.ts and must stay in sync with it.

migrate(
  (app) => {
    const USERS = app.findCollectionByNameOrId('users').id;

    const STOP_KINDS = [
      'waterfall',
      'canyon',
      'glacier',
      'hot_spring',
      'volcano',
      'cave',
      'lake',
      'coast',
      'viewpoint',
      'hike',
      'museum',
      'monument',
      'church',
      'town',
      'restaurant',
      'hotel',
      'campsite',
      'airport',
      'ferry',
      'fuel',
      'shop',
      'pool',
      'wildlife',
      'parking',
      'other',
      'uncategorized',
    ];

    // --- field builders -----------------------------------------------------
    const text = (name, o = {}) => ({
      name,
      type: 'text',
      required: !!o.required,
      min: o.min || 0,
      max: o.max || 0,
      pattern: o.pattern || '',
      autogeneratePattern: o.autogenerate || '',
    });
    const num = (name, o = {}) => {
      const f = {
        name,
        type: 'number',
        required: !!o.required,
        onlyInt: !!o.int,
      };
      if (o.min !== undefined) f.min = o.min;
      if (o.max !== undefined) f.max = o.max;
      return f;
    };
    const bool = (name) => ({ name, type: 'bool' });
    const sel = (name, values, o = {}) => ({
      name,
      type: 'select',
      required: !!o.required,
      maxSelect: 1,
      values,
    });
    const rel = (name, collectionId, o = {}) => ({
      name,
      type: 'relation',
      required: !!o.required,
      maxSelect: 1,
      minSelect: 0,
      collectionId,
      cascadeDelete: !!o.cascade,
    });
    const json = (name, o = {}) => ({
      name,
      type: 'json',
      required: !!o.required,
      maxSize: o.maxSize || 2000000,
    });
    const datef = (name, o = {}) => ({
      name,
      type: 'date',
      required: !!o.required,
    });
    const urlf = (name) => ({ name, type: 'url', required: false });
    const filef = (name, o = {}) => ({
      name,
      type: 'file',
      maxSelect: 1,
      maxSize: o.maxSize || 10485760,
      mimeTypes: o.mimeTypes || [],
    });
    const stamps = () => [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ];

    const collections = {};
    const make = (name, fields, indexes = []) => {
      const c = new Collection({ type: 'base', name, fields, indexes });
      app.save(c);
      collections[name] = c;
      return c;
    };

    make(
      'trips',
      [
        text('title', { required: true }),
        datef('start_date', { required: true }),
        text('timezone', { required: true }),
        text('currency', { required: true }),
        num('car_buffer_pct', { required: true, min: 0 }),
        json('surface_multipliers', { required: true, maxSize: 2000 }),
        json('default_dwell', { required: true, maxSize: 20000 }),
        rel('owner', USERS, { required: true, cascade: false }),
        text('share_token', { autogenerate: '[a-zA-Z0-9]{22}' }),
        bool('share_enabled'),
        ...stamps(),
      ],
      [
        "CREATE UNIQUE INDEX `idx_trips_share_token` ON `trips` (`share_token`) WHERE `share_token` != ''",
      ],
    );

    make(
      'trip_members',
      [
        rel('trip', collections.trips.id, { required: true, cascade: true }),
        rel('user', USERS, { required: true, cascade: true }),
        sel('role', ['owner', 'editor', 'viewer'], { required: true }),
        ...stamps(),
      ],
      [
        'CREATE UNIQUE INDEX `idx_trip_members_trip_user` ON `trip_members` (`trip`, `user`)',
      ],
    );

    make(
      'days',
      [
        rel('trip', collections.trips.id, { required: true, cascade: true }),
        num('order_index', { required: true, int: true, min: 0 }),
        text('title'),
        sel('kind', ['travel', 'rest'], { required: true }),
        text('notes'),
        ...stamps(),
      ],
      ['CREATE INDEX `idx_days_trip_order` ON `days` (`trip`, `order_index`)'],
    );

    make(
      'stops',
      [
        rel('day', collections.days.id, { required: true, cascade: true }),
        num('order_index', { required: true, int: true, min: 0 }),
        text('title', { required: true }),
        sel('kind', STOP_KINDS, { required: true }),
        bool('kind_confirmed'),
        num('lat'),
        num('lon'),
        text('address'),
        bool('is_accommodation'),
        text('anchor_time'),
        sel('anchor_type', ['arrival', 'departure']),
        num('dwell_override', { int: true, min: 0 }),
        ...stamps(),
      ],
      ['CREATE INDEX `idx_stops_day_order` ON `stops` (`day`, `order_index`)'],
    );

    make(
      'activities',
      [
        rel('stop', collections.stops.id, { required: true, cascade: true }),
        num('order_index', { required: true, int: true, min: 0 }),
        text('title', { required: true }),
        num('duration_min', { required: true, int: true, min: 0 }),
        sel('kind', ['activity', 'break'], { required: true }),
        text('notes'),
        ...stamps(),
      ],
      [
        'CREATE INDEX `idx_activities_stop_order` ON `activities` (`stop`, `order_index`)',
      ],
    );

    make('legs', [
      rel('from_stop', collections.stops.id, { required: true, cascade: true }),
      rel('to_stop', collections.stops.id, { required: true, cascade: true }),
      sel('mode', ['car', 'walk', 'flight', 'ferry', 'bike', 'other'], {
        required: true,
      }),
      sel('surface', ['paved', 'gravel', 'froad']),
      num('duration_min', { min: 0 }),
      num('distance_m', { min: 0 }),
      json('geometry'),
      sel('routing_source', ['ors', 'manual']),
      num('buffer_override_pct'),
      bool('seasonal_warning'),
      ...stamps(),
    ]);

    make(
      'blocks',
      [
        rel('trip', collections.trips.id, { required: true, cascade: true }),
        sel('parent_type', ['trip', 'day', 'stop', 'leg'], { required: true }),
        text('parent_id', { required: true }),
        sel('kind', ['note', 'link', 'photo', 'file'], { required: true }),
        sel('visibility', ['private', 'trip', 'public'], { required: true }),
        rel('creator', USERS, { required: true, cascade: false }),
        text('title'),
        text('body'),
        urlf('url'),
        filef('file'),
        num('order_index', { int: true, min: 0 }),
        num('lat'),
        num('lon'),
        datef('taken_at'),
        text('attribution_author'),
        text('attribution_licence'),
        urlf('attribution_url'),
        ...stamps(),
      ],
      [
        'CREATE INDEX `idx_blocks_parent` ON `blocks` (`parent_type`, `parent_id`)',
        'CREATE INDEX `idx_blocks_trip` ON `blocks` (`trip`)',
      ],
    );

    make('costs', [
      rel('trip', collections.trips.id, { required: true, cascade: true }),
      sel('parent_type', ['trip', 'day', 'stop', 'leg']),
      text('parent_id'),
      text('label', { required: true }),
      num('amount', { required: true }),
      text('currency', { required: true }),
      text('category'),
      bool('is_estimate'),
      ...stamps(),
    ]);

    make('pois', [
      rel('trip', collections.trips.id, { required: true, cascade: true }),
      text('title', { required: true }),
      sel('kind', STOP_KINDS),
      num('lat'),
      num('lon'),
      text('notes'),
      urlf('url'),
      sel('status', ['idea', 'scheduled', 'rejected'], { required: true }),
      ...stamps(),
    ]);

    make(
      'route_cache',
      [
        text('key', { required: true }),
        num('duration_min'),
        num('distance_m'),
        json('geometry'),
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      ['CREATE UNIQUE INDEX `idx_route_cache_key` ON `route_cache` (`key`)'],
    );

    // --- second pass: role-based API rules ----------------------------------
    // A record is visible to any trip member (viewer+) and writable by
    // editors+; membership is a row in trip_members for the record's trip.
    const read = (t) =>
      "@request.auth.id != '' && @collection.trip_members.user = @request.auth.id && @collection.trip_members.trip = " +
      t;
    const write = (t) =>
      read(t) + " && @collection.trip_members.role != 'viewer'";
    const owner = (t) =>
      read(t) + " && @collection.trip_members.role = 'owner'";

    const setRules = (name, r) => {
      const c = collections[name];
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
      // Any authenticated user may create a trip, naming themselves owner. The
      // matching trip_members owner row is created server-side (phase 1.3).
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

    // route_cache is server-managed (ORS hook, superuser context). Leaving all
    // rules null keeps it inaccessible through the public API.
  },
  (app) => {
    const names = [
      'route_cache',
      'pois',
      'costs',
      'blocks',
      'legs',
      'activities',
      'stops',
      'days',
      'trip_members',
      'trips',
    ];
    for (const n of names) {
      try {
        app.delete(app.findCollectionByNameOrId(n));
      } catch (_) {
        // already removed
      }
    }
  },
);
