import type { DayResult } from './cascade';

/**
 * The two numbers a planner actually balances when looking at a day: how
 * much of it is spent driving, and how much of it is spent at the places
 * the driving is for.
 *
 * Both come straight off the cascade result, so they are the same minutes
 * the timeline rows show — no second opinion about durations. Deliberately
 * *not* a partition of the day: an anchored stop can leave the itinerary
 * waiting, so `roadMin + stopMin` is normally a little less than
 * `elapsedMin`.
 */
export interface DayTotals {
  /** Leg time including buffers, plus the morning drive from the start point. */
  roadMin: number;
  /** Dwell across the day's stops. Accommodation contributes nothing — an
   * overnight has no dwell (see `defaultDwellSeed`) — and neither does a
   * waypoint, which is a corner the route turns at, not a place. */
  stopMin: number;
  /** Legs that carry time, the leading leg counted among them. */
  legCount: number;
  /** Stops that carry dwell. */
  stopCount: number;
  /** Whether `roadMin` includes a morning drive, for the hover to say so. */
  hasLeadingLeg: boolean;
}

export function dayTotals(day: DayResult | null | undefined): DayTotals {
  const empty: DayTotals = {
    roadMin: 0,
    stopMin: 0,
    legCount: 0,
    stopCount: 0,
    hasLeadingLeg: false,
  };
  if (!day) return empty;

  const legs = [...day.legs];
  if (day.leadingLeg) legs.push(day.leadingLeg);
  const timed = legs.filter((l) => l.effectiveDuration > 0);
  const dwelling = day.stops.filter((s) => s.dwell > 0);

  return {
    roadMin: timed.reduce((sum, l) => sum + l.effectiveDuration, 0),
    stopMin: dwelling.reduce((sum, s) => sum + s.dwell, 0),
    legCount: timed.length,
    stopCount: dwelling.length,
    hasLeadingLeg: (day.leadingLeg?.effectiveDuration ?? 0) > 0,
  };
}
