import { describe, it, expect } from 'vitest';
import { buildLegFeatures } from './map-features';
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
});

import { buildStopFeatures, buildWishlistFeatures } from './map-features';

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
    ]);
    expect(fc.features.map((f) => f.properties.title)).toEqual([
      'Skógafoss',
      'Hótel Skálholt',
      'Gullfoss',
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

  it('names the composited badge image after the sequence number', () => {
    const fc = buildStopFeatures(recs);
    const a = fc.features.find((f) => f.properties.stopId === 'A')!;
    const d = fc.features.find((f) => f.properties.stopId === 'D')!;
    expect(a.properties.iconImage).toBe('n:1');
    expect(d.properties.iconImage).toBe('n:1'); // same key, different day — fine, badges carry no day-specific styling
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
  });
});
