import { formatClock, type DayResult } from './cascade';

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
  /** Leg time including buffers, plus the drives to and from the day's start
   * and end points. */
  roadMin: number;
  /** Dwell across the day's stops. Accommodation contributes nothing — an
   * overnight has no dwell (see `defaultDwellSeed`) — and neither does a
   * waypoint, which is a corner the route turns at, not a place. */
  stopMin: number;
  /** Legs that carry time, the leading and trailing legs counted among them. */
  legCount: number;
  /** Stops that carry dwell. */
  stopCount: number;
  /** Whether `roadMin` includes a morning drive, for the hover to say so. */
  hasLeadingLeg: boolean;
  /** Whether `roadMin` includes the evening drive back to a base camp. */
  hasTrailingLeg: boolean;
}

export function dayTotals(day: DayResult | null | undefined): DayTotals {
  const empty: DayTotals = {
    roadMin: 0,
    stopMin: 0,
    legCount: 0,
    stopCount: 0,
    hasLeadingLeg: false,
    hasTrailingLeg: false,
  };
  if (!day) return empty;

  const legs = [...day.legs];
  if (day.leadingLeg) legs.push(day.leadingLeg);
  if (day.trailingLeg) legs.push(day.trailingLeg);
  const timed = legs.filter((l) => l.effectiveDuration > 0);
  const dwelling = day.stops.filter((s) => s.dwell > 0);

  return {
    roadMin: timed.reduce((sum, l) => sum + l.effectiveDuration, 0),
    stopMin: dwelling.reduce((sum, s) => sum + s.dwell, 0),
    legCount: timed.length,
    stopCount: dwelling.length,
    hasLeadingLeg: (day.leadingLeg?.effectiveDuration ?? 0) > 0,
    hasTrailingLeg: (day.trailingLeg?.effectiveDuration ?? 0) > 0,
  };
}

/**
 * The day's clock span, `09:00 – 16:05`, or `''` for a day with no stops.
 *
 * The day starts when you leave, not when you arrive somewhere: with a start
 * point the morning drive is already part of the day, so the span opens at
 * that departure rather than at stop 1. It closes, symmetrically, when you
 * get back to the end point (WORK 29). Shared by the desktop day header and
 * the phone drawer's one header line — two surfaces claiming to show "the
 * day" must not disagree about when it begins.
 */
export function daySpanLabel(day: DayResult | null | undefined): string {
  const first = day?.stops[0];
  const last = day?.stops[day.stops.length - 1];
  if (!day || !first || !last) return '';
  const lead = day.leadingLeg?.effectiveDuration ?? 0;
  const from = day.leadingLeg ? first.arrival - lead : first.arrival;
  return `${formatClock(from)} – ${formatClock(day.endArrival ?? last.departure)}`;
}
