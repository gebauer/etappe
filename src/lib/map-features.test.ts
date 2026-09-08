import { describe, it, expect } from 'vitest';
import { buildLegFeatures, boundsForDay } from './map-features';
import { dayHue, flatColor, legColor } from './map-colors';
import type { TripRecords } from './pb-trip-doc';
import type { CascadeResult } from './cascade';

const line = {
  type: 'LineString',
  coordinates: [
    [-22, 64],
    [-21, 63],
  ],
};

const records = {
  trip: { id: 't', start_date: '2026-09-12' },
  days: [{ id: 'd1', order_index: 0, kind: 'travel' }],
  stops: [
    { id: 'A', day: 'd1', order_index: 0, lat: 64, lon: -22 },
    { id: 'B', day: 'd1', order_index: 1, lat: 63, lon: -21 },
    { id: 'C', day: 'd1', order_index: 2, lat: 62, lon: -20 },
  ],
  legs: [
    { id: 'AB', from_stop: 'A', to_stop: 'B', geometry: line },
    { id: 'BC', from_stop: 'B', to_stop: 'C', geometry: null }, // manual, straight line
  ],
  activities: [],
} as unknown as TripRecords;

const result = {
  days: [
    {
      dayId: 'd1',
      date: '2026-09-12',
      daylight: { sunrise: 400, sunset: 1200, dusk: 1230 },
      stops: [
        { stopId: 'A', arrival: 600, departure: 660, dwell: 60 },
        { stopId: 'B', arrival: 1300, departure: 1300, dwell: 0 }, // after dusk
        { stopId: 'C', arrival: 1400, departure: 1400, dwell: 0 },
      ],
      legs: [],
      elapsedMin: 0,
    },
  ],
  warnings: [],
} as unknown as CascadeResult;

describe('buildLegFeatures', () => {
  it('emits a routed feature with day colours for a leg with geometry', () => {
    const fc = buildLegFeatures(records, result);
    const f = fc.features.find((x) => x.properties.legId === 'AB')!;
    expect(f.properties.manual).toBe(false);
    expect(f.properties.flat).toBe(flatColor(dayHue(0)));
    expect(f.properties.shade).toBe(legColor(dayHue(0), 0));
    expect(f.geometry.coordinates).toHaveLength(2);
  });

  it('tags every leg with the day it belongs to, for the hover highlight', () => {
    const fc = buildLegFeatures(records, result);
    expect(fc.features.map((x) => x.properties.dayId)).toEqual(['d1', 'd1']);
  });

  it('falls back to a straight manual connector when a leg has no geometry', () => {
    const fc = buildLegFeatures(records, result);
    expect(fc.features).toHaveLength(2);
    const f = fc.features.find((x) => x.properties.legId === 'BC')!;
    expect(f.properties.manual).toBe(true);
    expect(f.geometry.coordinates).toEqual([
      [-21, 63],
      [-20, 62],
    ]);
  });

  it('skips a manual leg when either endpoint has no coordinates', () => {
    const noCoords = {
      ...records,
      stops: [
        records.stops[0],
        records.stops[1],
        { ...records.stops[2], lat: 0, lon: 0 },
      ],
    } as unknown as TripRecords;
    const fc = buildLegFeatures(noCoords, result);
    expect(fc.features.map((f) => f.properties.legId)).toEqual(['AB']);
  });

  it('flags a leg arriving after civil dusk', () => {
    const f = buildLegFeatures(records, result).features.find(
      (x) => x.properties.legId === 'AB',
    )!;
    expect(f.properties.afterDusk).toBe(true); // arrival at B (1300) > dusk (1230)
  });

  it('has no after-dusk flag without a daylight band', () => {
    const noDay = {
      ...result,
      days: [{ ...result.days[0]!, daylight: null }],
    } as unknown as CascadeResult;
    const f = buildLegFeatures(records, noDay).features.find(
      (x) => x.properties.legId === 'AB',
    )!;
    expect(f.properties.afterDusk).toBe(false);
  });

  it('emits a leading-leg line for a day with a start point (WORK 13.3)', () => {
    const withStart = {
      ...records,
      days: [
        { id: 'd0', order_index: 0, kind: 'travel' },
        { id: 'd1', order_index: 1, kind: 'travel', start_stop: 'H' },
      ],
      stops: [
        { id: 'H', day: 'd0', order_index: 0, lat: 65, lon: -19 },
        ...records.stops,
      ],
      legs: [
        ...records.legs,
        { id: 'HA', from_stop: 'H', to_stop: 'A', geometry: line },
      ],
    } as unknown as TripRecords;
    const fc = buildLegFeatures(withStart, result);
    const f = fc.features.find((x) => x.properties.legId === 'HA')!;
    expect(f.properties.manual).toBe(false);
    expect(f.properties.flat).toBe(flatColor(dayHue(1))); // day 1's hue
  });

  it('draws the leading leg as a straight connector until it is routed', () => {
    const withStart = {
      ...records,
      days: [
        { id: 'd0', order_index: 0, kind: 'travel' },
        { id: 'd1', order_index: 1, kind: 'travel', start_stop: 'H' },
      ],
      stops: [
        { id: 'H', day: 'd0', order_index: 0, lat: 65, lon: -19 },
        ...records.stops,
      ],
      legs: records.legs, // no H->A leg yet
    } as unknown as TripRecords;
    const f = buildLegFeatures(withStart, result).features.find(
      (x) => x.properties.legId === 'lead:d1',
    )!;
    expect(f.properties.manual).toBe(true);
    expect(f.geometry.coordinates).toEqual([
      [-19, 65],
      [-22, 64],
    ]);
  });
});

describe('boundsForDay', () => {
  // Day d1's only stop is its accommodation (H2); it leaves from S, the
  // previous day's stay, via an as-yet-unrouted leading leg.
  const stayOnly = {
    trip: { id: 't', start_date: '2026-09-12' },
    days: [
      { id: 'd0', order_index: 0, kind: 'travel' },
      { id: 'd1', order_index: 1, kind: 'travel', start_stop: 'S' },
    ],
    stops: [
      { id: 'S', day: 'd0', order_index: 0, lat: 60, lon: 10 },
      {
        id: 'H2',
        day: 'd1',
        order_index: 0,
        lat: 61,
        lon: 12,
        is_accommodation: true,
      },
    ],
    legs: [],
    activities: [],
  } as unknown as TripRecords;

  it('frames the leading leg, not just the lone stop', () => {
    const legs = buildLegFeatures(stayOnly, null);
    const bbox = boundsForDay(stayOnly, legs, 'd1');
    // Without the leg pass this collapses to [12, 61, 12, 61] on H2 alone;
    // the leading leg pulls the west/south edge back to the start point S.
    expect(bbox).toEqual([10, 60, 12, 61]);
  });

  it('returns null for a day with no coordinates anywhere', () => {
    const empty = {
      ...stayOnly,
      stops: [{ id: 'X', day: 'd1', order_index: 0 }],
      days: [{ id: 'd1', order_index: 0, kind: 'travel' }],
    } as unknown as TripRecords;
    expect(boundsForDay(empty, buildLegFeatures(empty, null), 'd1')).toBeNull();
  });
});

import {
  buildStopFeatures,
  buildWishlistFeatures,
  dayTag,
  dayTagNeedle,
} from './map-features';

describe('buildStopFeatures', () => {
  const recs = {
    trip: { id: 't', start_date: '2026-09-12' },
    days: [
      { id: 'd1', order_index: 0, kind: 'travel' },
      { id: 'd2', order_index: 1, kind: 'travel' },
    ],
    stops: [
      {
        id: 'A',
        day: 'd1',
        order_index: 0,
        title: 'Skógafoss',
        kind: 'waterfall',
        lat: 64,
        lon: -20,
      },
      {
        id: 'B',
        day: 'd1',
        order_index: 1,
        title: 'Hótel Skálholt',
        kind: 'hotel',
        lat: 63,
        lon: -21,
        is_accommodation: true,
      },
      {
        id: 'C',
        day: 'd1',
        order_index: 2,
        title: 'No coords',
        kind: 'town',
        lat: 0,
        lon: 0,
      }, // no coords, skipped — and doesn't consume a sequence number
      {
        id: 'D',
        day: 'd2',
        order_index: 0,
        title: 'Gullfoss',
        kind: 'waterfall',
        lat: 64.3,
        lon: -20.1,
      },
      {
        id: 'E',
        day: 'd2',
        order_index: 1,
        title: 'Starred spot',
        kind: 'viewpoint',
        lat: 64.4,
        lon: -20.2,
        starred: true,
      },
    ],
    legs: [],
    activities: [],
  } as unknown as TripRecords;

  it('emits a marker per stop with coordinates', () => {
    const fc = buildStopFeatures(recs);
    expect(fc.features.map((f) => f.properties.stopId)).toEqual([
      'A',
      'B',
      'D',
      'E',
    ]);
    expect(fc.features.map((f) => f.properties.title)).toEqual([
      'Skógafoss',
      'Hótel Skálholt',
      'Gullfoss',
      'Starred spot',
    ]);
  });

  it('numbers stops in sequence order, restarting each day', () => {
    const fc = buildStopFeatures(recs);
    const byId = new Map(fc.features.map((f) => [f.properties.stopId, f]));
    expect(byId.get('A')!.properties.seq).toBe(1);
    expect(byId.get('B')!.properties.seq).toBe(2); // C has no coords, doesn't take a number
    expect(byId.get('D')!.properties.seq).toBe(1); // restarts on day 2
    expect(byId.get('A')!.properties.dayId).toBe('d1');
    expect(byId.get('D')!.properties.dayId).toBe('d2');
  });

  it('names the composited image after the stop, not the sequence number', () => {
    // The tile key is per-stop ("s:<id>") so a late kind change or photo
    // arriving re-composites just that stop's image, not every stop that
    // happens to share a sequence number across days.
    const fc = buildStopFeatures(recs);
    const a = fc.features.find((f) => f.properties.stopId === 'A')!;
    const d = fc.features.find((f) => f.properties.stopId === 'D')!;
    expect(a.properties.iconImage).toBe('s:A');
    expect(d.properties.iconImage).toBe('s:D');
  });

  it('gives a starred stop its own starred flag (WORK 14.3)', () => {
    const fc = buildStopFeatures(recs);
    const a = fc.features.find((f) => f.properties.stopId === 'A')!;
    const e = fc.features.find((f) => f.properties.stopId === 'E')!;
    expect(a.properties.starred).toBe(false);
    expect(e.properties.starred).toBe(true);
    expect(e.properties.seq).toBe(2); // second stop on day 2
    expect(e.properties.iconImage).toBe('s:E'); // star is baked into the tile, not a distinct key
  });

  it('a photo-less stop still gets the tile key, dim key included (WORK 25, author request 2026-09-04)', () => {
    // MapPane composites the kind icon onto this tile when there's no
    // photo (compositeStopPin, map-markers.ts) — the feature layer no
    // longer distinguishes "has a photo" by routing to a different key.
    const fc = buildStopFeatures(recs);
    const a = fc.features.find((f) => f.properties.stopId === 'A')!;
    expect(a.properties.hasPhoto).toBe(false);
    expect(a.properties.iconImage).toBe('s:A');
    expect(a.properties.iconImageDim).toBe('s:A:dim');
  });

  it('a stop with a resolvable photo block renders as a photo tile (WORK 25)', () => {
    const withPhoto = {
      ...recs,
      blocks: [
        { parent_type: 'stop', parent_id: 'A', kind: 'photo', url: 'x.jpg' },
        { parent_type: 'stop', parent_id: 'B', kind: 'note', body: 'hi' },
        { parent_type: 'poi', parent_id: 'A', kind: 'photo', url: 'y.jpg' },
      ],
    } as unknown as TripRecords;
    const fc = buildStopFeatures(withPhoto);
    const a = fc.features.find((f) => f.properties.stopId === 'A')!;
    const b = fc.features.find((f) => f.properties.stopId === 'B')!;
    expect(a.properties.hasPhoto).toBe(true);
    expect(a.properties.iconImage).toBe('s:A');
    expect(a.properties.iconImageDim).toBe('s:A:dim');
    // A note block is not a photo; a POI-parented photo isn't this stop's.
    expect(b.properties.hasPhoto).toBe(false);
    expect(b.properties.iconImage).toBe('s:B');
  });

  it('a waypoint never becomes a photo tile even with a photo block (WORK 25)', () => {
    const wp = {
      ...recs,
      stops: [
        { ...recs.stops[0], routing_kind: 'waypoint' },
        ...recs.stops.slice(1),
      ],
      blocks: [
        { parent_type: 'stop', parent_id: 'A', kind: 'photo', url: 'x.jpg' },
      ],
    } as unknown as TripRecords;
    const fc = buildStopFeatures(wp);
    const a = fc.features.find((f) => f.properties.stopId === 'A')!;
    expect(a.properties.hasPhoto).toBe(false);
    expect(a.properties.iconImage).toBe('n:wp:1');
    expect(a.properties.iconImageDim).toBe('n:wp:1');
  });

  // WORK 30: the previous night's hotel gets a "0" pin inside the day that
  // leaves from it, so it is numbered and hoverable rather than an anonymous
  // greyed other-day dot.
  describe('the carried-in start point', () => {
    const carried = {
      ...recs,
      days: [
        { id: 'd1', order_index: 0, kind: 'travel' },
        { id: 'd2', order_index: 1, kind: 'travel', start_stop: 'B' },
      ],
    } as unknown as TripRecords;

    it('adds a seq-0 pin for it in the day that carries it', () => {
      const fc = buildStopFeatures(carried);
      const zero = fc.features.filter((f) => f.properties.carried);
      expect(zero).toHaveLength(1);
      expect(zero[0]!.properties).toMatchObject({
        stopId: 'B',
        title: 'Hótel Skálholt',
        dayId: 'd2',
        seq: 0,
        iconImage: 'n:0',
      });
      // Same place as the stop's own pin.
      expect(zero[0]!.geometry.coordinates).toEqual([-21, 63]);
    });

    it('leaves the stop’s own pin in place, tagged with who carries it', () => {
      const fc = buildStopFeatures(carried);
      const own = fc.features.find(
        (f) => f.properties.stopId === 'B' && !f.properties.carried,
      )!;
      expect(own.properties.dayId).toBe('d1');
      expect(own.properties.seq).toBe(2);
      expect(own.properties.carriedInto).toBe('|d2|');
    });

    it('is a plain circle — never a photo tile or a star', () => {
      const withPhoto = {
        ...carried,
        stops: carried.stops.map((s) =>
          s.id === 'B' ? { ...s, starred: true } : s,
        ),
        blocks: [
          { parent_type: 'stop', parent_id: 'B', kind: 'photo', url: 'x.jpg' },
        ],
      } as unknown as TripRecords;
      const zero = buildStopFeatures(withPhoto).features.find(
        (f) => f.properties.carried,
      )!;
      expect(zero.properties.iconImage).toBe('n:0');
      expect(zero.properties.hasPhoto).toBe(false);
      expect(zero.properties.starred).toBe(false);
    });

    it('lists every day of a base camp that leaves from the same hotel', () => {
      const baseCamp = {
        ...recs,
        days: [
          { id: 'd1', order_index: 0, kind: 'travel' },
          { id: 'd2', order_index: 1, kind: 'travel', start_stop: 'B' },
          { id: 'd3', order_index: 2, kind: 'travel', start_stop: 'B' },
        ],
        stops: [
          ...recs.stops,
          {
            id: 'F',
            day: 'd3',
            order_index: 0,
            title: 'Geysir',
            kind: 'other',
            lat: 64.31,
            lon: -20.3,
          },
        ],
      } as unknown as TripRecords;
      const fc = buildStopFeatures(baseCamp);
      expect(
        fc.features
          .filter((f) => f.properties.carried)
          .map((f) => f.properties.dayId),
      ).toEqual(['d2', 'd3']);
      const own = fc.features.find(
        (f) => f.properties.stopId === 'B' && !f.properties.carried,
      )!;
      expect(own.properties.carriedInto).toBe('|d2|d3|');
    });

    it('ignores a pointer at a stop in the same day, or one with no coords', () => {
      const noop = {
        ...recs,
        days: [
          { id: 'd1', order_index: 0, kind: 'travel', start_stop: 'A' },
          { id: 'd2', order_index: 1, kind: 'travel', start_stop: 'C' },
        ],
      } as unknown as TripRecords;
      const fc = buildStopFeatures(noop);
      expect(fc.features.some((f) => f.properties.carried)).toBe(false);
      expect(fc.features.every((f) => f.properties.carriedInto === '')).toBe(
        true,
      );
    });

    it('ignores a dangling pointer', () => {
      const dangling = {
        ...recs,
        days: [
          { id: 'd1', order_index: 0, kind: 'travel' },
          { id: 'd2', order_index: 1, kind: 'travel', start_stop: 'ghost' },
        ],
      } as unknown as TripRecords;
      expect(
        buildStopFeatures(dangling).features.some((f) => f.properties.carried),
      ).toBe(false);
    });
  });
});

// The `stops-dim` filter is `['in', dayTagNeedle(focus), ['get','carriedInto']]`
// — a substring test. These two helpers have to agree, and the delimiters are
// what stop one id matching inside another.
describe('dayTag / dayTagNeedle', () => {
  const contains = (tag: string, dayId: string) =>
    tag.includes(dayTagNeedle(dayId));

  it('round-trips every day it was built from', () => {
    const tag = dayTag(['d2', 'd3']);
    expect(contains(tag, 'd2')).toBe(true);
    expect(contains(tag, 'd3')).toBe(true);
  });

  it('is empty for a stop nothing carries', () => {
    expect(dayTag(undefined)).toBe('');
    expect(dayTag([])).toBe('');
    expect(contains('', 'd2')).toBe(false);
  });

  it('does not match an id that merely contains a member id', () => {
    const tag = dayTag(['d2']);
    expect(contains(tag, 'd')).toBe(false);
    expect(contains(tag, 'd22')).toBe(false);
    expect(contains(dayTag(['abc']), 'b')).toBe(false);
  });
});

describe('buildWishlistFeatures', () => {
  const items = [
    { id: 'W1', title: 'Jökulsárlón', kind: 'lake', lat: 64.05, lon: -16.18 },
    { id: 'W2', title: 'Unplaced idea', kind: 'hike', lat: 0, lon: 0 },
  ];

  it('skips items without real coordinates', () => {
    const fc = buildWishlistFeatures(items);
    expect(fc.features.map((f) => f.properties.poiId)).toEqual(['W1']);
  });

  it('names distinct unselected/selected image keys per item', () => {
    const fc = buildWishlistFeatures(items);
    expect(fc.features[0]!.properties.iconImage).toBe('w:W1');
    expect(fc.features[0]!.properties.iconImageSelected).toBe('w:W1:sel');
    expect(fc.features[0]!.properties.iconImageHovered).toBe('w:W1:hover');
  });
});
