import { describe, it, expect } from 'vitest';
import { dayTotals, daySpanLabel } from './day-totals';
import type { DayResult, LegTiming, StopTiming } from './cascade';

const stop = (id: string, dwell: number, arrival = 0): StopTiming => ({
  stopId: id,
  arrival,
  departure: arrival + dwell,
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

describe('daySpanLabel', () => {
  it('runs from the first arrival to the last departure', () => {
    expect(
      daySpanLabel(day({ stops: [stop('a', 45, 540), stop('b', 20, 700)] })),
    ).toBe('09:00 – 12:00');
  });

  it('opens at the morning departure when the day has a start point', () => {
    expect(
      daySpanLabel(day({ stops: [stop('a', 45, 540)], leadingLeg: leg(30) })),
    ).toBe('08:30 – 09:45');
  });

  it('closes on the drive back to an end point', () => {
    expect(
      daySpanLabel(day({ stops: [stop('a', 45, 540)], endArrival: 1000 })),
    ).toBe('09:00 – 16:40');
  });

  it('is empty for a day with no stops', () => {
    expect(daySpanLabel(day({}))).toBe('');
    expect(daySpanLabel(null)).toBe('');
  });
});
