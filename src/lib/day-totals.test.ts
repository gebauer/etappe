import { describe, it, expect } from 'vitest';
import { dayTotals } from './day-totals';
import type { DayResult, LegTiming, StopTiming } from './cascade';

const stop = (id: string, dwell: number): StopTiming => ({
  stopId: id,
  arrival: 0,
  departure: dwell,
  dwell,
});

const leg = (effectiveDuration: number): LegTiming => ({
  effectiveDuration,
  baseDuration: effectiveDuration,
  bufferMin: 0,
  overridden: false,
});

const day = (partial: Partial<DayResult>): DayResult => ({
  dayId: 'd1',
  date: '2026-06-01',
  stops: [],
  legs: [],
  leadingLeg: null,
  trailingLeg: null,
  endArrival: null,
  daylight: null,
  elapsedMin: 0,
  ...partial,
});

describe('dayTotals', () => {
  it('sums leg time and dwell separately', () => {
    const totals = dayTotals(
      day({
        stops: [stop('a', 45), stop('b', 20)],
        legs: [leg(35)],
      }),
    );
    expect(totals.roadMin).toBe(35);
    expect(totals.stopMin).toBe(65);
    expect(totals.legCount).toBe(1);
    expect(totals.stopCount).toBe(2);
    expect(totals.hasLeadingLeg).toBe(false);
  });

  it('counts the morning drive as road time', () => {
    const totals = dayTotals(
      day({
        stops: [stop('a', 45)],
        legs: [],
        leadingLeg: leg(80),
      }),
    );
    expect(totals.roadMin).toBe(80);
    expect(totals.legCount).toBe(1);
    expect(totals.hasLeadingLeg).toBe(true);
  });

  it('ignores legs and stops that carry no time', () => {
    // An unrouted leg and a waypoint / accommodation both come through as
    // zero; neither should inflate the counts the hover quotes.
    const totals = dayTotals(
      day({
        stops: [stop('a', 45), stop('waypoint', 0), stop('hotel', 0)],
        legs: [leg(35), leg(0)],
        leadingLeg: leg(0),
        trailingLeg: leg(0),
      }),
    );
    expect(totals).toEqual({
      roadMin: 35,
      stopMin: 45,
      legCount: 1,
      stopCount: 1,
      hasLeadingLeg: false,
      hasTrailingLeg: false,
    });
  });

  it('counts the evening drive back to a base camp (WORK 29)', () => {
    const totals = dayTotals(
      day({
        stops: [stop('a', 45)],
        legs: [],
        leadingLeg: leg(40),
        trailingLeg: leg(50),
      }),
    );
    expect(totals.roadMin).toBe(90);
    expect(totals.legCount).toBe(2);
    expect(totals.hasTrailingLeg).toBe(true);
  });

  it('is all zeroes for a day the cascade has nothing for', () => {
    expect(dayTotals(null).roadMin).toBe(0);
    expect(dayTotals(undefined).stopCount).toBe(0);
  });
});
