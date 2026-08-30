import { describe, it, expect } from 'vitest';
import { enumerateGaps, rankPlacements, describeGap } from './placement';
import type { TripRecords } from './pb-trip-doc';
import type { LatLon, RouteResult, RoutingProvider } from './routing';

const records = {
  trip: { id: 't', start_date: '2026-09-12' },
  days: [
    { id: 'd1', order_index: 0, kind: 'travel' },
    { id: 'd2', order_index: 1, kind: 'travel' },
  ],
  stops: [
    { id: 'A', day: 'd1', order_index: 0, title: 'A', lat: 1, lon: 1 },
    { id: 'B', day: 'd1', order_index: 1, title: 'B', lat: 2, lon: 2 },
  ],
  legs: [{ id: 'AB', from_stop: 'A', to_stop: 'B', duration_min: 100 }],
  activities: [],
} as unknown as TripRecords;

describe('enumerateGaps', () => {
  it('gives an empty day a single gap with no neighbours', () => {
    const gaps = enumerateGaps(records).filter((g) => g.dayId === 'd2');
    expect(gaps).toEqual([
      {
        dayId: 'd2',
        dayIndex: 1,
        prevStopId: null,
        prevTitle: null,
        nextStopId: null,
        nextTitle: null,
      },
    ]);
  });

  it('gives a two-stop day three gaps: before, between, after', () => {
    const gaps = enumerateGaps(records).filter((g) => g.dayId === 'd1');
    expect(gaps).toEqual([
      {
        dayId: 'd1',
        dayIndex: 0,
        prevStopId: null,
        prevTitle: null,
        nextStopId: 'A',
        nextTitle: 'A',
      },
      {
        dayId: 'd1',
        dayIndex: 0,
        prevStopId: 'A',
        prevTitle: 'A',
        nextStopId: 'B',
        nextTitle: 'B',
      },
      {
        dayId: 'd1',
        dayIndex: 0,
        prevStopId: 'B',
        prevTitle: 'B',
        nextStopId: null,
        nextTitle: null,
      },
    ]);
  });
});

describe('describeGap', () => {
  it('describes every gap shape', () => {
    const g = (prevTitle: string | null, nextTitle: string | null) => ({
      dayId: 'd',
      dayIndex: 0,
      prevStopId: prevTitle,
      prevTitle,
      nextStopId: nextTitle,
      nextTitle,
    });
    expect(describeGap(g(null, null))).toBe('first stop of the day');
    expect(describeGap(g(null, 'B'))).toBe('before B');
    expect(describeGap(g('A', null))).toBe('after A');
    expect(describeGap(g('A', 'B'))).toBe('between A and B');
  });
});

const candidate: LatLon = { lat: 9, lon: 9 };

/** Distinguishes calls by rounding coordinates to identify from/to. */
function fakeProvider(
  durations: Record<string, number | null>,
): RoutingProvider {
  const key = (p: LatLon) => `${p.lat},${p.lon}`;
  return {
    async route(from, to): Promise<RouteResult> {
      const k = `${key(from)}->${key(to)}`;
      const d = durations[k];
      if (d == null)
        return {
          routable: false,
          duration_min: 0,
          distance_m: 0,
          geometry: null,
          cached: false,
        };
      return {
        routable: true,
        duration_min: d,
        distance_m: d * 1000,
        geometry: {},
        cached: false,
      };
    },
  };
}

describe('rankPlacements', () => {
  it('nets the delta for a between-pair gap against the existing leg', async () => {
    const provider = fakeProvider({
      '1,1->9,9': 60, // A -> candidate
      '9,9->2,2': 54, // candidate -> B
    });
    const options = await rankPlacements(records, candidate, provider);
    const between = options.find(
      (o) => o.prevStopId === 'A' && o.nextStopId === 'B',
    )!;
    expect(between.addedMin).toBe(60 + 54 - 100); // 14, per the BUILD §6 example shape
  });

  it('charges the single new leg (no subtraction) before the first stop', async () => {
    const provider = fakeProvider({ '9,9->1,1': 38 });
    const options = await rankPlacements(records, candidate, provider);
    const beforeFirst = options.find(
      (o) => o.prevStopId === null && o.dayId === 'd1',
    )!;
    expect(beforeFirst.addedMin).toBe(38);
  });

  it('charges the single new leg after the last stop', async () => {
    const provider = fakeProvider({ '2,2->9,9': 22 });
    const options = await rankPlacements(records, candidate, provider);
    const afterLast = options.find(
      (o) => o.nextStopId === null && o.dayId === 'd1',
    )!;
    expect(afterLast.addedMin).toBe(22);
  });

  it('gives an empty day zero added minutes with no routing calls needed', async () => {
    const options = await rankPlacements(records, candidate, fakeProvider({}));
    const empty = options.find((o) => o.dayId === 'd2')!;
    expect(empty.addedMin).toBe(0);
  });

  it('sorts ascending by added minutes, with unsolvable gaps last', async () => {
    const options = await rankPlacements(records, candidate, fakeProvider({}));
    const values = options.map((o) => o.addedMin);
    const nulls = values.filter((v) => v === null).length;
    const numbers = values.filter((v): v is number => v !== null);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(values.slice(values.length - nulls)).toEqual(
      Array(nulls).fill(null),
    );
  });
});
