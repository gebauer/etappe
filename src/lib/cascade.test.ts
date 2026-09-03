import { describe, it, expect } from 'vitest';
import {
  cascade,
  formatClock,
  type CascadeTrip,
  type CascadeDay,
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
    car_buffer_pct: 5,
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
    expect(formatClock(gullfoss!.arrival)).toBe('13:15'); // + 105 (100 + 5%)
    expect(formatClock(gullfoss!.departure)).toBe('15:15'); // + 120
    expect(formatClock(skalholt!.arrival)).toBe('15:57'); // + 42 (40 + 5%)
    expect(days[0]!.legs.map((l) => l.effectiveDuration)).toEqual([105, 42]);
    expect(days[0]!.legs.map((l) => l.baseDuration)).toEqual([100, 40]);
    expect(days[0]!.legs.map((l) => l.bufferMin)).toEqual([5, 2]);
    expect(days[0]!.elapsedMin).toBe(332);
  });

  it('emits no warnings (sunset ~20:15)', () => {
    expect(cascade(t, sunsetAt(AT('20:15'))).warnings).toEqual([]);
  });

  it('emits exactly one AFTER_DARK of 1 min with a 15:56 sunset', () => {
    const { warnings } = cascade(t, sunsetAt(AT('15:56')));
    expect(warnings).toEqual([
      { code: 'AFTER_DARK', dayId: 'd1', stopId: 'skalholt', deficitMin: 1 },
    ]);
  });
});

// --- rounding --------------------------------------------------------------

describe('effective duration', () => {
  function oneLeg(l: Partial<CascadeLeg>, over: Partial<CascadeTrip> = {}) {
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
          legs: [leg(l)],
        },
      ],
      ...over,
    });
    return cascade(t, noDaylight).days[0]!.legs[0]!;
  }

  it('leaves the routed time alone whatever the surface (WORK 19.5)', () => {
    // The engine already slowed down for the gravel; multiplying again was
    // counting the same fact twice.
    const paved = oneLeg({ surface: 'paved', duration_min: 40 });
    const gravel = oneLeg({ surface: 'gravel', duration_min: 40 });
    expect(gravel.baseDuration).toBe(paved.baseDuration);
    expect(gravel.effectiveDuration).toBe(paved.effectiveDuration);
  });

  it('splits the total into the routed time and the buffer', () => {
    const l = oneLeg({ duration_min: 100 });
    expect(l).toMatchObject({
      baseDuration: 100,
      bufferMin: 5,
      effectiveDuration: 105,
      overridden: false,
    });
  });

  it('rounds the buffer to whole minutes before adding it', () => {
    // 5 % of 45 is 2.25 -> 2, and 45 + 2 is exactly what the row prints.
    const l = oneLeg({ duration_min: 45 });
    expect(l.bufferMin).toBe(2);
    expect(l.baseDuration + l.bufferMin).toBe(l.effectiveDuration);
  });

  it('takes a per-leg buffer as a percentage', () => {
    expect(oneLeg({ duration_min: 100, buffer_pct: 20 }).bufferMin).toBe(20);
  });

  it('takes a per-leg buffer as flat minutes', () => {
    // Minutes win over the trip percentage; 5 % of 8 would round to nothing.
    expect(oneLeg({ duration_min: 8, buffer_min: 10 })).toMatchObject({
      bufferMin: 10,
      effectiveDuration: 18,
    });
  });

  it('honours a zero-minute buffer instead of falling back', () => {
    expect(oneLeg({ duration_min: 100, buffer_min: 0 }).effectiveDuration).toBe(
      100,
    );
  });

  it('replaces the routed time with an override, buffer still on top', () => {
    expect(
      oneLeg({ duration_min: 100, duration_override_min: 180 }),
    ).toMatchObject({
      baseDuration: 180,
      bufferMin: 9,
      effectiveDuration: 189,
      overridden: true,
    });
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
        // 09:00 +60 dwell +126 (120 + 5%) = 12:06 computed at b, anchor 10:00.
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
      { code: 'MISSED_ANCHOR', dayId: 'd', stopId: 'b', deficitMin: 126 },
    ]);
    // c is computed from b's anchor (10:00 + 30 + 63), not the delayed arrival.
    expect(formatClock(days[0]!.stops[2]!.arrival)).toBe('11:33');
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
      [leg({ surface: 'paved', duration_min: 700 })], // 735 min -> elapsed 750
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
      deficitMin: 620, // 09:30 + 630 = 20:00 computed vs 09:40 anchor
    });
    expect(formatClock(days[0]!.stops[1]!.arrival)).toBe('09:40');
  });
});

// --- routing waypoints: force a leg through a point with no dwell (WORK 16.9)

describe('routing waypoints', () => {
  it('forces dwell to zero however the stop would otherwise be timed', () => {
    const t = trip({
      default_dwell: { viewpoint: 30 },
      days: [
        {
          id: 'd1',
          order_index: 0,
          kind: 'travel',
          stops: [
            stop('a', { anchor_time: '09:00', anchor_type: 'arrival' }),
            // Would be 30 min from the taxonomy default, or more from an
            // override or activities — none of that should survive being
            // marked a waypoint.
            stop('b', {
              kind: 'viewpoint',
              dwell_override: 45,
              activities: [{ duration_min: 20, kind: 'activity' }],
              routing_kind: 'waypoint',
            }),
            stop('c'),
          ],
          legs: [leg({ duration_min: 30 }), leg({ duration_min: 30 })],
        },
      ],
    });
    const { days } = cascade(t, noDaylight);
    const b = days[0]!.stops[1]!;
    expect(b.dwell).toBe(0);
    // Arrival and departure at a waypoint coincide — nothing is spent there.
    expect(b.arrival).toBe(b.departure);
    // The next stop's arrival reflects the zero dwell, not the 45/50 min it
    // would have taken on: 09:00 + 32 (30 min leg + 5% buffer) + 0
    // (waypoint) + 32 = 10:04.
    expect(formatClock(days[0]!.stops[2]!.arrival)).toBe('10:04');
  });

  it('is the ordinary case when routing_kind is absent — no behaviour change', () => {
    const t = trip({
      default_dwell: { viewpoint: 30 },
      days: [
        {
          id: 'd1',
          order_index: 0,
          kind: 'travel',
          stops: [stop('a', { kind: 'viewpoint' })],
          legs: [],
        },
      ],
    });
    const { days } = cascade(t, noDaylight);
    expect(days[0]!.stops[0]!.dwell).toBe(30);
  });
});

// --- leading leg: the morning drive from the day's start point (WORK 13.1) --

describe('leading leg', () => {
  function oneDay(over: Partial<CascadeDay> = {}) {
    const day: CascadeDay = {
      id: 'd',
      order_index: 0,
      kind: 'travel',
      stops: [
        stop('a', { dwell_override: 30 }),
        stop('b', { is_accommodation: true }),
      ],
      legs: [leg({ surface: 'paved', duration_min: 60 })], // 63 within-day
      ...over,
    };
    return trip({ days: [day] });
  }

  it('an anchorless day starts stop 0 at 09:00 + the leading leg', () => {
    const t = oneDay({
      leadingLeg: leg({ surface: 'paved', duration_min: 60 }), // 60 + 5% = 63
    });
    const { days } = cascade(t, noDaylight);
    expect(formatClock(days[0]!.stops[0]!.arrival)).toBe('10:03'); // 09:00 + 63
    expect(days[0]!.leadingLeg).toMatchObject({ effectiveDuration: 63 });
  });

  it('surfaces the leading leg with its id and effective duration', () => {
    const t = oneDay({
      leadingLeg: leg({ id: 'lead1', surface: 'paved', duration_min: 30 }),
    });
    expect(cascade(t, noDaylight).days[0]!.leadingLeg).toEqual({
      legId: 'lead1',
      baseDuration: 30,
      bufferMin: 2, // 5 % of 30 = 1.5 -> 2
      effectiveDuration: 32,
      overridden: false,
    });
  });

  it('an anchor on stop 0 wins; the leading leg only lengthens elapsed', () => {
    const t = oneDay({
      stops: [
        stop('a', {
          anchor_time: '10:00',
          anchor_type: 'arrival',
          dwell_override: 30,
        }),
        stop('b', { is_accommodation: true }),
      ],
      leadingLeg: leg({ surface: 'paved', duration_min: 120 }), // 126
    });
    const { days } = cascade(t, noDaylight);
    expect(formatClock(days[0]!.stops[0]!.arrival)).toBe('10:00'); // anchor wins
    expect(formatClock(days[0]!.stops[1]!.arrival)).toBe('11:33'); // 10:00+30+63
    expect(days[0]!.elapsedMin).toBe(93 + 126); // stop span + morning drive
  });

  it('a downstream anchor back-derives the same with or without a leading leg', () => {
    const base = {
      stops: [
        stop('a', { dwell_override: 30 }),
        stop('b', {
          anchor_time: '12:00',
          anchor_type: 'arrival',
          is_accommodation: true,
        }),
      ],
      legs: [leg({ surface: 'paved', duration_min: 60 })],
    };
    const island = cascade(oneDay(base), noDaylight).days[0]!;
    const withLead = cascade(
      oneDay({
        ...base,
        leadingLeg: leg({ surface: 'paved', duration_min: 90 }),
      }),
      noDaylight,
    ).days[0]!;
    expect(withLead.stops.map((s) => s.arrival)).toEqual(
      island.stops.map((s) => s.arrival),
    );
    expect(formatClock(withLead.stops[1]!.arrival)).toBe('12:00');
  });

  it('a start point with no routed leg behaves like an island', () => {
    const t = oneDay({
      startPoint: { id: 'prev-hotel', lat: 64, lon: -18 },
      // leadingLeg omitted: pointer set, not routed yet
    });
    const { days } = cascade(t, noDaylight);
    expect(formatClock(days[0]!.stops[0]!.arrival)).toBe('09:00');
    expect(days[0]!.leadingLeg).toBeNull();
  });

  it('a long morning transfer tips an otherwise short day into LONG_DAY', () => {
    const stops = [
      stop('a', {
        anchor_time: '08:00',
        anchor_type: 'arrival',
        dwell_override: 60,
      }),
      stop('b', { is_accommodation: true }),
    ];
    const legs = [leg({ surface: 'paved', duration_min: 300 })]; // 315 -> span 375
    const short = cascade(oneDay({ stops, legs }), noDaylight);
    expect(short.warnings.some((w) => w.code === 'LONG_DAY')).toBe(false);

    const long = cascade(
      oneDay({
        stops,
        legs,
        leadingLeg: leg({ surface: 'paved', duration_min: 360 }), // 378
      }),
      noDaylight,
    );
    expect(long.warnings).toContainEqual({ code: 'LONG_DAY', dayId: 'd' });
    expect(long.days[0]!.elapsedMin).toBe(375 + 378);
  });

  it('carries leadingLeg: null on an empty day', () => {
    const t = trip({
      days: [{ id: 'd', order_index: 0, kind: 'travel', stops: [], legs: [] }],
    });
    expect(cascade(t, noDaylight).days[0]!.leadingLeg).toBeNull();
  });
});
