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
