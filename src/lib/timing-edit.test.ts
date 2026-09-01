import { describe, it, expect } from 'vitest';
import {
  planTimingEdit,
  parseClock,
  formatClock,
  type TimingStop,
} from './timing-edit';

/** Three stops, 09:00 anchored at the first, an hour each, an hour apart. */
function day(): TimingStop[] {
  return [
    {
      id: 'a',
      title: 'Airport',
      anchorTime: '09:00',
      dwell: 60,
      arrival: 540,
      departure: 600,
    },
    {
      id: 'b',
      title: 'Gullfoss',
      anchorTime: null,
      dwell: 60,
      arrival: 660,
      departure: 720,
    },
    {
      id: 'c',
      title: 'Geysir',
      anchorTime: null,
      dwell: 45,
      arrival: 780,
      departure: 825,
    },
  ];
}

describe('parseClock / formatClock', () => {
  it('round-trips a clock', () => {
    expect(parseClock('09:05')).toBe(545);
    expect(formatClock(545)).toBe('09:05');
  });

  it('rejects nonsense rather than guessing', () => {
    expect(parseClock('')).toBeNull();
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('09:99')).toBeNull();
    expect(parseClock('lunchtime')).toBeNull();
  });

  it('wraps past midnight', () => {
    expect(formatClock(24 * 60 + 30)).toBe('00:30');
    expect(formatClock(-30)).toBe('23:30');
  });
});

describe('planTimingEdit — dwell', () => {
  it('writes an override', () => {
    const plan = planTimingEdit({
      stops: day(),
      index: 1,
      cell: 'dwell',
      value: '90',
    });
    expect(plan).toMatchObject({
      kind: 'apply',
      changes: [{ stopId: 'b', patch: { dwell_override: 90 } }],
    });
  });

  it('clears back to the taxonomy default when emptied', () => {
    const plan = planTimingEdit({
      stops: day(),
      index: 1,
      cell: 'dwell',
      value: '',
    });
    expect(plan).toMatchObject({
      kind: 'apply',
      changes: [{ patch: { dwell_override: 0 }, to: 'the default' }],
    });
  });

  it('never conflicts — dwell is not an anchor', () => {
    const plan = planTimingEdit({
      stops: day(),
      index: 2,
      cell: 'dwell',
      value: '120',
    });
    expect(plan.kind).toBe('apply');
  });

  it('ignores a value that changes nothing, or is nonsense', () => {
    const stops = day();
    expect(
      planTimingEdit({ stops, index: 1, cell: 'dwell', value: '60' }).kind,
    ).toBe('noop');
    expect(
      planTimingEdit({ stops, index: 1, cell: 'dwell', value: '-5' }).kind,
    ).toBe('noop');
  });
});

describe('planTimingEdit — clocks', () => {
  it('anchors arrival on the cell that was typed into', () => {
    const stops = day();
    stops[0]!.anchorTime = null; // nothing upstream governs anything
    const plan = planTimingEdit({
      stops,
      index: 1,
      cell: 'arrival',
      value: '11:30',
    });
    expect(plan).toMatchObject({
      kind: 'apply',
      changes: [
        {
          stopId: 'b',
          patch: { anchor_time: '11:30', anchor_type: 'arrival' },
        },
      ],
    });
  });

  it('anchors departure, leaving dwell alone so arrival is what moves', () => {
    const stops = day();
    stops[0]!.anchorTime = null;
    const plan = planTimingEdit({
      stops,
      index: 1,
      cell: 'departure',
      value: '13:00',
    });
    expect(plan).toMatchObject({
      kind: 'apply',
      changes: [
        {
          patch: { anchor_time: '13:00', anchor_type: 'departure' },
        },
      ],
    });
    if (plan.kind === 'apply') {
      expect(plan.changes[0]!.patch.dwell_override).toBeUndefined();
    }
  });

  it('releases the anchor when the cell is cleared', () => {
    const plan = planTimingEdit({
      stops: day(),
      index: 0,
      cell: 'arrival',
      value: '',
    });
    expect(plan).toMatchObject({
      kind: 'apply',
      changes: [{ stopId: 'a', patch: { anchor_time: '' }, to: 'not pinned' }],
    });
  });

  it('does nothing when clearing a stop that was never anchored', () => {
    expect(
      planTimingEdit({ stops: day(), index: 1, cell: 'arrival', value: '' })
        .kind,
    ).toBe('noop');
  });

  it('pins without conflict when the time is what it already computed to', () => {
    const plan = planTimingEdit({
      stops: day(),
      index: 1,
      cell: 'arrival',
      value: '11:00',
    });
    expect(plan.kind).toBe('apply');
  });
});

describe('planTimingEdit — anchoring under an upstream anchor', () => {
  it('offers both branches when the new time is later', () => {
    const plan = planTimingEdit({
      stops: day(),
      index: 1,
      cell: 'arrival',
      value: '11:45',
    });
    expect(plan.kind).toBe('conflict');
    if (plan.kind !== 'conflict') return;
    expect(plan.deltaMin).toBe(45);
    expect(plan.upstreamTitle).toBe('Airport');
    // Move the whole trip: the upstream anchor slides by the same delta.
    expect(plan.shift).toMatchObject({
      stopId: 'a',
      patch: { anchor_time: '09:45' },
      from: '09:00',
      to: '09:45',
    });
    // Or spend it on the stop immediately above — 1 h becomes 1 h 45.
    expect(plan.absorb).toMatchObject({
      stopId: 'a',
      title: 'Airport',
      patch: { dwell_override: 105 },
      from: '1 h',
      to: '1 h 45 min',
    });
    expect(plan.anchor).toMatchObject({
      stopId: 'b',
      patch: { anchor_time: '11:45', anchor_type: 'arrival' },
    });
  });

  it('offers no absorb branch when the new time is earlier — there is no slack', () => {
    const plan = planTimingEdit({
      stops: day(),
      index: 1,
      cell: 'arrival',
      value: '10:30',
    });
    expect(plan.kind).toBe('conflict');
    if (plan.kind !== 'conflict') return;
    expect(plan.deltaMin).toBe(-30);
    expect(plan.absorb).toBeNull();
    expect(plan.shift.patch.anchor_time).toBe('08:30');
  });

  it('absorbs onto the immediately preceding stop, not the anchored one', () => {
    const plan = planTimingEdit({
      stops: day(),
      index: 2,
      cell: 'arrival',
      value: '13:30',
    });
    expect(plan.kind).toBe('conflict');
    if (plan.kind !== 'conflict') return;
    // Gullfoss is the stop before Geysir; the Airport is what's anchored.
    expect(plan.absorb?.stopId).toBe('b');
    expect(plan.absorb?.patch.dwell_override).toBe(90);
    expect(plan.shift.stopId).toBe('a');
  });

  it('takes the nearest anchor above, not the first one', () => {
    const stops = day();
    stops[1]!.anchorTime = '11:00';
    const plan = planTimingEdit({
      stops,
      index: 2,
      cell: 'departure',
      value: '14:00',
    });
    expect(plan.kind).toBe('conflict');
    if (plan.kind !== 'conflict') return;
    expect(plan.shift.stopId).toBe('b');
    expect(plan.upstreamTitle).toBe('Gullfoss');
  });

  it('reads a wrap past midnight as a small shift, not a day-long one', () => {
    const stops: TimingStop[] = [
      {
        id: 'a',
        title: 'Dinner',
        anchorTime: '22:00',
        dwell: 60,
        arrival: 1320,
        departure: 1380,
      },
      {
        id: 'b',
        title: 'Hotel',
        anchorTime: null,
        dwell: 30,
        arrival: 1430, // 23:50
        departure: 1460,
      },
    ];
    const plan = planTimingEdit({
      stops,
      index: 1,
      cell: 'arrival',
      value: '00:10',
    });
    expect(plan.kind).toBe('conflict');
    if (plan.kind !== 'conflict') return;
    expect(plan.deltaMin).toBe(20);
    expect(plan.shift.patch.anchor_time).toBe('22:20');
  });
});
