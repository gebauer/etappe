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

import { buildStopFeatures } from './map-features';

describe('buildStopFeatures', () => {
  const recs = {
    trip: { id: 't', start_date: '2026-09-12' },
    days: [{ id: 'd1', order_index: 0, kind: 'travel' }],
    stops: [
      {
        id: 'A',
        day: 'd1',
        order_index: 0,
        kind: 'waterfall',
        lat: 64,
        lon: -20,
      },
      {
        id: 'B',
        day: 'd1',
        order_index: 1,
        kind: 'hotel',
        lat: 63,
        lon: -21,
        is_accommodation: true,
        anchor_time: '18:00',
      },
      { id: 'C', day: 'd1', order_index: 2, kind: 'town', lat: 0, lon: 0 }, // no coords
    ],
    legs: [],
    activities: [],
  } as unknown as TripRecords;

  it('emits a marker per stop with coordinates', () => {
    const fc = buildStopFeatures(recs);
    expect(fc.features.map((f) => f.properties.stopId)).toEqual(['A', 'B']);
  });

  it('maps the kind icon and ranks accommodation first', () => {
    const [a, b] = buildStopFeatures(recs).features;
    expect(a!.properties.icon).toBe('waterfall');
    expect(b!.properties.icon).toBe('lodging'); // hotel -> lodging
    expect(b!.properties.isAccommodation).toBe(true);
    expect(b!.properties.sortKey).toBe(0); // accommodation ranks first
    expect(a!.properties.sortKey).toBe(2); // plain stop
  });
});
