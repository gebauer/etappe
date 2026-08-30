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
    { id: 'A', day: 'd1', order_index: 0 },
    { id: 'B', day: 'd1', order_index: 1 },
    { id: 'C', day: 'd1', order_index: 2 },
  ],
  legs: [
    { id: 'AB', from_stop: 'A', to_stop: 'B', geometry: line },
    { id: 'BC', from_stop: 'B', to_stop: 'C', geometry: null }, // unrouted
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
  it('emits one feature per routed leg with day colours', () => {
    const fc = buildLegFeatures(records, result);
    expect(fc.features).toHaveLength(1); // BC has no geometry
    const f = fc.features[0]!;
    expect(f.properties.legId).toBe('AB');
    expect(f.properties.flat).toBe(flatColor(dayHue(0)));
    expect(f.properties.shade).toBe(legColor(dayHue(0), 0));
    expect(f.geometry.coordinates).toHaveLength(2);
  });

  it('flags a leg arriving after civil dusk', () => {
    const f = buildLegFeatures(records, result).features[0]!;
    expect(f.properties.afterDusk).toBe(true); // arrival at B (1300) > dusk (1230)
  });

  it('has no after-dusk flag without a daylight band', () => {
    const noDay = {
      ...result,
      days: [{ ...result.days[0]!, daylight: null }],
    } as unknown as CascadeResult;
    expect(
      buildLegFeatures(records, noDay).features[0]!.properties.afterDusk,
    ).toBe(false);
  });
});
