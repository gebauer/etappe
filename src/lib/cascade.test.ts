import { describe, it, expect } from 'vitest';
import {
  cascade,
  formatClock,
  type CascadeTrip,
  type CascadeStop,
  type CascadeLeg,
  type DaylightProvider,
} from './cascade';

// --- builders --------------------------------------------------------------

function stop(id: string, p: Partial<CascadeStop> = {}): CascadeStop {
  return {
    id,
    kind: 'other',
    is_accommodation: false,
    activities: [],
    ...p,
  };
}

function leg(p: Partial<CascadeLeg> = {}): CascadeLeg {
  return { mode: 'car', duration_min: 0, ...p };
}

function trip(p: Partial<CascadeTrip> = {}): CascadeTrip {
  return {
    start_date: '2026-09-12',
    car_buffer_pct: 15,
    surface_multipliers: { paved: 1.0, gravel: 1.3, froad: 2.0 },
    default_dwell: {},
    days: [],
    ...p,
  };
}

const noDaylight: DaylightProvider = () => null;
const sunsetAt =
  (sunset: number): DaylightProvider =>
  () => ({ sunrise: 5 * 60, sunset, dusk: sunset + 30 });

const AT = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

// --- the canonical worked example (BUILD §12) ------------------------------

describe('Iceland day 1 (BUILD §12)', () => {
  const t = trip({
    days: [
      {
        id: 'd1',
        order_index: 0,
        kind: 'travel',
        stops: [
          stop('kef', {
            kind: 'airport',
            lat: 63.985,
            lon: -22.605,
            anchor_time: '10:25',
            anchor_type: 'arrival',
            dwell_override: 65,
          }),
          stop('gullfoss', {
            kind: 'waterfall',
            activities: [{ duration_min: 120, kind: 'activity' }],
          }),
          stop('skalholt', { kind: 'hotel', is_accommodation: true }),
        ],
        legs: [
          leg({ surface: 'paved', duration_min: 100 }),
          leg({ surface: 'gravel', duration_min: 40 }),
        ],
      },
    ],
  });

  it('computes the arrivals, departures and leg durations from §12', () => {
    const { days } = cascade(t, sunsetAt(AT('20:15')));
    const [kef, gullfoss, skalholt] = days[0]!.stops;
    expect(formatClock(kef!.arrival)).toBe('10:25');
    expect(formatClock(kef!.departure)).toBe('11:30'); // 10:25 + 65
    expect(formatClock(gullfoss!.arrival)).toBe('13:25'); // + 115 (100×1.15)
    expect(formatClock(gullfoss!.departure)).toBe('15:25'); // + 120
    expect(formatClock(skalholt!.arrival)).toBe('16:25'); // + 60 (40×1.3×1.15)
    expect(days[0]!.legs.map((l) => l.effectiveDuration)).toEqual([115, 60]);
    expect(days[0]!.elapsedMin).toBe(360);
  });

  it('emits no warnings (sunset ~20:15)', () => {
    expect(cascade(t, sunsetAt(AT('20:15'))).warnings).toEqual([]);
  });

  it('emits exactly one AFTER_DARK of 1 min with a 16:24 sunset', () => {
    const { warnings } = cascade(t, sunsetAt(AT('16:24')));
    expect(warnings).toEqual([
      { code: 'AFTER_DARK', dayId: 'd1', stopId: 'skalholt', deficitMin: 1 },
    ]);
  });
});

// --- rounding --------------------------------------------------------------

describe('effective duration', () => {
  it('rounds half up once after both multipliers', () => {
    // 40 × 1.3 × 1.15 = 59.8 -> 60
    const t = trip({
      days: [
        {
          id: 'd',
          order_index: 0,
          kind: 'travel',
          stops: [
            stop('a', { anchor_time: '09:00', anchor_type: 'departure' }),
            stop('b', { is_accommodation: true }),
          ],
          legs: [leg({ surface: 'gravel', duration_min: 40 })],
        },
      ],
    });
    expect(cascade(t, noDaylight).days[0]!.legs[0]!.effectiveDuration).toBe(60);
  });

  it('passes non-car legs through unmultiplied', () => {
    const t = trip({
      days: [
        {
          id: 'd',
          order_index: 0,
          kind: 'travel',
          stops: [stop('a'), stop('b', { is_accommodation: true })],
          legs: [leg({ mode: 'walk', duration_min: 45 })],
        },
      ],
    });
    expect(cascade(t, noDaylight).days[0]!.legs[0]!.effectiveDuration).toBe(45);
  });
});

// --- downstream anchor re-baselines instead of propagating error -----------

describe('downstream anchor', () => {
  const t = trip({
    days: [
      {
        id: 'd',
        order_index: 0,
        kind: 'travel',
        stops: [
          stop('a', {
            anchor_time: '09:00',
            anchor_type: 'arrival',
            dwell_override: 60,
          }),
          stop('b', {
            anchor_time: '10:00',
            anchor_type: 'arrival',
            dwell_override: 30,
          }),
          stop('c', { is_accommodation: true }),
        ],
        // 09:00 +60 dwell +138 (120×1.15) = 12:18 computed at b, anchor 10:00.
        legs: [
          leg({ surface: 'paved', duration_min: 120 }),
          leg({ surface: 'paved', duration_min: 60 }),
        ],
      },
    ],
  });

  it('flags the miss with the deficit and resets the clock to the anchor', () => {
    const { days, warnings } = cascade(t, noDaylight);
    expect(warnings).toEqual([
      { code: 'MISSED_ANCHOR', dayId: 'd', stopId: 'b', deficitMin: 138 },
    ]);
    // c is computed from b's anchor (10:00 + 30 + 69), not the delayed arrival.
    expect(formatClock(days[0]!.stops[2]!.arrival)).toBe('11:39');
  });
});

// --- each remaining warning code in isolation ------------------------------

describe('warning codes', () => {
  function oneDay(
    stops: CascadeStop[],
    legs: CascadeLeg[],
    over: Partial<CascadeTrip> = {},
  ) {
    return trip({
      ...over,
      days: [{ id: 'd', order_index: 0, kind: 'travel', stops, legs }],
    });
  }

  it('NO_ACCOMMODATION when the day does not end at accommodation', () => {
    const t = oneDay([stop('a'), stop('b')], [leg({ duration_min: 10 })]);
    expect(cascade(t, noDaylight).warnings).toContainEqual({
      code: 'NO_ACCOMMODATION',
      dayId: 'd',
      stopId: 'b',
    });
  });

  it('LONG_DAY when elapsed exceeds 12 h', () => {
    const t = oneDay(
      [
        stop('a', {
          anchor_time: '06:00',
          anchor_type: 'arrival',
          dwell_override: 60,
        }),
        stop('b', { is_accommodation: true }),
      ],
      [leg({ surface: 'paved', duration_min: 600 })], // 690 min -> elapsed 750
    );
    expect(cascade(t, noDaylight).warnings).toContainEqual({
      code: 'LONG_DAY',
      dayId: 'd',
    });
  });

  it('FROAD_SEASON for an F-road leg outside 15 Jun – 10 Sep', () => {
    const t = oneDay(
      [stop('a'), stop('b', { is_accommodation: true })],
      [leg({ id: 'l1', surface: 'froad', duration_min: 30 })],
      { start_date: '2026-09-12' },
    );
    expect(cascade(t, noDaylight).warnings).toContainEqual({
      code: 'FROAD_SEASON',
      dayId: 'd',
      legId: 'l1',
    });
  });

  it('no FROAD_SEASON in season', () => {
    const t = oneDay(
      [stop('a'), stop('b', { is_accommodation: true })],
      [leg({ id: 'l1', surface: 'froad', duration_min: 30 })],
      { start_date: '2026-07-01' },
    );
    expect(
      cascade(t, noDaylight).warnings.some((w) => w.code === 'FROAD_SEASON'),
    ).toBe(false);
  });

  it('UNCATEGORIZED for an uncategorized stop', () => {
    const t = oneDay(
      [
        stop('a', { kind: 'uncategorized' }),
        stop('b', { is_accommodation: true }),
      ],
      [leg({ duration_min: 10 })],
    );
    expect(cascade(t, noDaylight).warnings).toContainEqual({
      code: 'UNCATEGORIZED',
      dayId: 'd',
      stopId: 'a',
    });
  });
});

// --- edge cases ------------------------------------------------------------

describe('edge cases', () => {
  it('handles an empty day without crashing', () => {
    const t = trip({
      days: [{ id: 'd', order_index: 0, kind: 'travel', stops: [], legs: [] }],
    });
    const { days, warnings } = cascade(t, noDaylight);
    expect(days[0]!.stops).toEqual([]);
    expect(days[0]!.elapsedMin).toBe(0);
    expect(warnings).toEqual([]);
  });

  it('starts an anchorless day at 09:00', () => {
    const t = trip({
      days: [
        {
          id: 'd',
          order_index: 0,
          kind: 'travel',
          stops: [
            stop('a', { dwell_override: 30 }),
            stop('b', { is_accommodation: true }),
          ],
          legs: [leg({ surface: 'paved', duration_min: 60 })],
        },
      ],
    });
    const first = cascade(t, noDaylight).days[0]!.stops[0]!;
    expect(formatClock(first.arrival)).toBe('09:00');
  });

  it('renders no AFTER_DARK when the provider returns null (polar day)', () => {
    const t = trip({
      days: [
        {
          id: 'd',
          order_index: 0,
          kind: 'travel',
          stops: [
            stop('a', {
              lat: 66,
              lon: -18,
              anchor_time: '23:30',
              anchor_type: 'arrival',
            }),
            stop('b', { is_accommodation: true, dwell_override: 0 }),
          ],
          legs: [leg({ mode: 'walk', duration_min: 60 })],
        },
      ],
    });
    expect(
      cascade(t, noDaylight).warnings.some((w) => w.code === 'AFTER_DARK'),
    ).toBe(false);
  });

  it('computes a rest day like any other', () => {
    const t = trip({
      days: [
        {
          id: 'd',
          order_index: 0,
          kind: 'rest',
          stops: [
            stop('a', {
              anchor_time: '09:00',
              anchor_type: 'arrival',
              dwell_override: 30,
            }),
            stop('b', { is_accommodation: true }),
          ],
          legs: [leg({ mode: 'walk', duration_min: 15 })],
        },
      ],
    });
    const { days, warnings } = cascade(t, noDaylight);
    expect(formatClock(days[0]!.stops[1]!.arrival)).toBe('09:45');
    expect(warnings).toEqual([]);
  });

  it('flags an unreachable anchor and still baselines the rest to it', () => {
    const t = trip({
      days: [
        {
          id: 'd',
          order_index: 0,
          kind: 'travel',
          stops: [
            stop('a', {
              anchor_time: '09:00',
              anchor_type: 'arrival',
              dwell_override: 30,
            }),
            // Needs 600 min of driving to reach b, but b is anchored 10 min later.
            stop('b', {
              anchor_time: '09:40',
              anchor_type: 'arrival',
              is_accommodation: true,
            }),
          ],
          legs: [leg({ mode: 'car', surface: 'paved', duration_min: 600 })],
        },
      ],
    });
    const { days, warnings } = cascade(t, noDaylight);
    expect(warnings).toContainEqual({
      code: 'MISSED_ANCHOR',
      dayId: 'd',
      stopId: 'b',
      deficitMin: 680, // 09:30 + 690 = 21:00 computed vs 09:40 anchor
    });
    expect(formatClock(days[0]!.stops[1]!.arrival)).toBe('09:40');
  });
});
