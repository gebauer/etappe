import { describe, it, expect } from 'vitest';
import {
  planLeadingLegs,
  type LeadingLegDay,
  type LeadingLegStop,
  type LeadingLegPair,
} from './leading-leg';

// day1: A, H(accom)   day2: D, E   day3: F, G
const stops: LeadingLegStop[] = [
  { id: 'A', day: 'd1', order_index: 0 },
  { id: 'H', day: 'd1', order_index: 1 },
  { id: 'D', day: 'd2', order_index: 0 },
  { id: 'E', day: 'd2', order_index: 1 },
  { id: 'F', day: 'd3', order_index: 0 },
  { id: 'G', day: 'd3', order_index: 1 },
];
const day = (id: string, start_stop = ''): LeadingLegDay => ({
  id,
  start_stop,
});
const leg = (
  id: string,
  from_stop: string,
  to_stop: string,
): LeadingLegPair => ({
  id,
  from_stop,
  to_stop,
});

describe('planLeadingLegs', () => {
  it('creates the leading leg for a day that points at an earlier stop', () => {
    const plan = planLeadingLegs([day('d1'), day('d2', 'H')], stops, [
      leg('DE', 'D', 'E'),
    ]);
    expect(plan).toEqual({
      create: [{ from_stop: 'H', to_stop: 'D' }],
      deleteLegIds: [],
      rerouteLegIds: [],
    });
  });

  it('is a no-op when the leading leg already matches', () => {
    const plan = planLeadingLegs([day('d1'), day('d2', 'H')], stops, [
      leg('HD', 'H', 'D'),
      leg('DE', 'D', 'E'),
    ]);
    expect(plan).toEqual({ create: [], deleteLegIds: [], rerouteLegIds: [] });
  });

  it('leaves within-day legs alone', () => {
    const plan = planLeadingLegs([day('d1'), day('d2')], stops, [
      leg('AH', 'A', 'H'),
      leg('DE', 'D', 'E'),
    ]);
    expect(plan.deleteLegIds).toEqual([]);
  });

  it('drops a stale leading leg when the pointer is cleared', () => {
    const plan = planLeadingLegs(
      [day('d1'), day('d2')], // d2.start_stop removed
      stops,
      [leg('HD', 'H', 'D')],
    );
    expect(plan.deleteLegIds).toEqual(['HD']);
    expect(plan.create).toEqual([]);
  });

  it('replaces a stale leading leg when the first stop changed', () => {
    // d2 reordered to E, D — leading leg should now land on E.
    const reordered: LeadingLegStop[] = stops.map((s) =>
      s.id === 'D'
        ? { ...s, order_index: 1 }
        : s.id === 'E'
          ? { ...s, order_index: 0 }
          : s,
    );
    const plan = planLeadingLegs([day('d1'), day('d2', 'H')], reordered, [
      leg('HD', 'H', 'D'),
      leg('ED', 'E', 'D'),
    ]);
    expect(plan.deleteLegIds).toEqual(['HD']);
    expect(plan.create).toEqual([{ from_stop: 'H', to_stop: 'E' }]);
  });

  it('replaces a stale leading leg when the pointer moves to another stop', () => {
    const plan = planLeadingLegs(
      [day('d1'), day('d2', 'A')], // was H, now A (still day 1)
      stops,
      [leg('HD', 'H', 'D')],
    );
    expect(plan.deleteLegIds).toEqual(['HD']);
    expect(plan.create).toEqual([{ from_stop: 'A', to_stop: 'D' }]);
  });

  it('ignores a pointer at the day’s own first stop', () => {
    const plan = planLeadingLegs([day('d2', 'D')], stops, []);
    expect(plan).toEqual({ create: [], deleteLegIds: [], rerouteLegIds: [] });
  });

  it('ignores a dangling pointer and clears any leg it left behind', () => {
    const plan = planLeadingLegs([day('d2', 'ghost')], stops, [
      leg('gD', 'ghost', 'D'),
    ]);
    // 'ghost' isn't a real stop -> not desired; the orphan leg isn't a
    // recognised leading leg (its from_stop resolves to no day) -> left alone.
    expect(plan).toEqual({ create: [], deleteLegIds: [], rerouteLegIds: [] });
  });

  it('re-routes a matching leading leg when an endpoint stop moved', () => {
    const plan = planLeadingLegs(
      [day('d2', 'H')],
      stops,
      [leg('HD', 'H', 'D')],
      new Set(['H']),
    );
    expect(plan.rerouteLegIds).toEqual(['HD']);
    expect(plan.create).toEqual([]);
    expect(plan.deleteLegIds).toEqual([]);
  });

  it('handles a chain of days each leaving from the one before', () => {
    const plan = planLeadingLegs(
      [day('d1'), day('d2', 'H'), day('d3', 'E')],
      stops,
      [leg('DE', 'D', 'E'), leg('FG', 'F', 'G')],
    );
    expect(plan.create).toEqual([
      { from_stop: 'H', to_stop: 'D' },
      { from_stop: 'E', to_stop: 'F' },
    ]);
  });

  it('desires no leading leg for a day with no stops', () => {
    const plan = planLeadingLegs(
      [day('d2', 'H')],
      stops.filter((s) => s.day !== 'd2'),
      [],
    );
    expect(plan.create).toEqual([]);
  });
});
