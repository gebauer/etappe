import { describe, it, expect } from 'vitest';
import { buildCascadeTrip, type TripRecords } from './pb-trip-doc';
import { cascade, formatClock } from './cascade';
import { stubDaylight } from './daylight';
import type {
  TripsResponse,
  DaysResponse,
  StopsResponse,
  LegsResponse,
  ActivitiesResponse,
} from '../types/pb';

const trip = {
  id: 't',
  start_date: '2026-09-12 00:00:00.000Z',
  car_buffer_pct: 15,
  surface_multipliers: { paved: 1.0, gravel: 1.3, froad: 2.0 },
  default_dwell: { waterfall: 45 },
} as unknown as TripsResponse;

const day = {
  id: 'd1',
  order_index: 0,
  kind: 'travel',
} as unknown as DaysResponse;

const stop = (o: Partial<StopsResponse>) =>
  ({ day: 'd1', is_accommodation: false, ...o }) as unknown as StopsResponse;

const records: TripRecords = {
  trip,
  days: [day],
  stops: [
    stop({
      id: 'A',
      order_index: 0,
      kind: 'airport',
      anchor_time: '10:25',
      anchor_type: 'arrival',
      dwell_override: 65,
      lat: 0,
      lon: 0, // unset -> should become null
    }),
    stop({
      id: 'B',
      order_index: 1,
      kind: 'waterfall',
      dwell_override: 0, // unset -> null, so the activity sum is used
    }),
    stop({ id: 'C', order_index: 2, kind: 'hotel', is_accommodation: true }),
  ],
  legs: [
    {
      id: 'L0',
      from_stop: 'A',
      to_stop: 'B',
      mode: 'car',
      surface: 'paved',
      duration_min: 100,
    } as unknown as LegsResponse,
    {
      id: 'L1',
      from_stop: 'B',
      to_stop: 'C',
      mode: 'car',
      surface: 'gravel',
      duration_min: 40,
    } as unknown as LegsResponse,
  ],
  activities: [
    {
      id: 'act',
      stop: 'B',
      order_index: 0,
      duration_min: 120,
      kind: 'activity',
    } as unknown as ActivitiesResponse,
  ],
  blocks: [],
};

describe('buildCascadeTrip', () => {
  it('maps records and treats 0/"" as unset', () => {
    const ct = buildCascadeTrip(records);
    const [a, b] = ct.days[0]!.stops;
    expect(a!.dwell_override).toBe(65);
    expect(a!.lat).toBeNull(); // 0 -> null
    expect(a!.lon).toBeNull();
    expect(b!.dwell_override).toBeNull(); // 0 -> null
    expect(b!.activities).toEqual([{ duration_min: 120, kind: 'activity' }]);
    expect(ct.days[0]!.legs.map((l) => l.duration_min)).toEqual([100, 40]);
  });

  it('feeds the engine so it reproduces the §12 timings', () => {
    const { days } = cascade(
      buildCascadeTrip(records),
      stubDaylight({ sunrise: 400, sunset: 1215, dusk: 1245 }),
    );
    const [a, b, c] = days[0]!.stops;
    expect(formatClock(a!.arrival)).toBe('10:25');
    expect(formatClock(b!.arrival)).toBe('13:25'); // +115
    expect(formatClock(c!.arrival)).toBe('16:25'); // +60
  });
});

// --- day-start continuity: start_stop -> startPoint + leading leg (WORK 13.1)

describe('buildCascadeTrip / start_stop', () => {
  const twoDayTrip = { ...trip, id: 't2' } as unknown as TripsResponse;
  const d1 = {
    id: 'd1',
    order_index: 0,
    kind: 'travel',
  } as unknown as DaysResponse;
  // Day 2 leaves from day 1's accommodation ('C').
  const d2 = {
    id: 'd2',
    order_index: 1,
    kind: 'travel',
    start_stop: 'C',
  } as unknown as DaysResponse;

  const base: TripRecords = {
    trip: twoDayTrip,
    days: [d1, d2],
    stops: [
      stop({ id: 'A', day: 'd1', order_index: 0, kind: 'airport' }),
      stop({
        id: 'C',
        day: 'd1',
        order_index: 1,
        kind: 'hotel',
        is_accommodation: true,
        lat: 64.1,
        lon: -21.9,
      }),
      stop({
        id: 'D',
        day: 'd2',
        order_index: 0,
        kind: 'waterfall',
        anchor_time: '',
        dwell_override: 30,
      }),
      stop({
        id: 'E',
        day: 'd2',
        order_index: 1,
        kind: 'hotel',
        is_accommodation: true,
      }),
    ],
    legs: [
      {
        id: 'L_DE',
        from_stop: 'D',
        to_stop: 'E',
        mode: 'car',
        surface: 'paved',
        duration_min: 30,
      } as unknown as LegsResponse,
    ],
    activities: [],
    blocks: [],
  };

  it('resolves the pointer to a startPoint but leaves leadingLeg null until routed', () => {
    const ct = buildCascadeTrip(base);
    expect(ct.days[1]!.startPoint).toEqual({ id: 'C', lat: 64.1, lon: -21.9 });
    expect(ct.days[1]!.leadingLeg).toBeNull();
    // Not routed yet -> day 2 still starts its first stop at 09:00.
    const { days } = cascade(ct, () => null);
    expect(formatClock(days[1]!.stops[0]!.arrival)).toBe('09:00');
  });

  it('picks up the leading leg record (C -> D) and shifts day 2 by its duration', () => {
    const withLead: TripRecords = {
      ...base,
      legs: [
        ...base.legs,
        {
          id: 'L_CD',
          from_stop: 'C',
          to_stop: 'D',
          mode: 'car',
          surface: 'paved',
          duration_min: 60, // 60 x 1.15 = 69
        } as unknown as LegsResponse,
      ],
    };
    const ct = buildCascadeTrip(withLead);
    expect(ct.days[1]!.leadingLeg).toMatchObject({
      id: 'L_CD',
      duration_min: 60,
    });
    const { days } = cascade(ct, () => null);
    expect(formatClock(days[1]!.stops[0]!.arrival)).toBe('10:09'); // 09:00 + 69
    expect(days[1]!.leadingLeg).toEqual({
      legId: 'L_CD',
      effectiveDuration: 69,
    });
  });

  it('ignores a dangling start_stop pointer', () => {
    const dangling: TripRecords = {
      ...base,
      days: [d1, { ...d2, start_stop: 'ghost' } as unknown as DaysResponse],
    };
    expect(buildCascadeTrip(dangling).days[1]!.startPoint).toBeNull();
  });
});
