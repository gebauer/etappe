/**
 * Cross-day leg planning (WORK 13.2, extended in WORK 29). A cross-day leg
 * joins two stops that live in different days:
 *
 *   **leading**  `days.start_stop` -> that day's first stop — the morning
 *                drive out of the previous night's hotel (WORK 13.1).
 *   **trailing** that day's last stop -> `days.end_stop` — the evening drive
 *                back to it, which is what makes a base camp possible
 *                (WORK 29).
 *
 * **Why one planner for both.** A day's trailing leg lands *in* another day,
 * which is exactly the shape a leading-leg detector looks for. Planned
 * separately, each direction would see the other's legs as its own stale ones
 * and delete them, forever. So this diffs the whole cross-day set at once: a
 * leg is cross-day iff both ends resolve to stops in different days, and every
 * desired leg is constructed to satisfy that.
 *
 * The within-day leg lifecycle in `pb-legs`/`stop-move` deliberately ignores
 * cross-day legs, so this is their sole owner. Pure and tested; the async
 * apply (`reconcileCrossDayLegs` in `pb-cross-day-legs.ts`) routes the
 * new/changed legs and commits the batch.
 */

export interface CrossDayLegDay {
  id: string;
  /** `days.start_stop`; "" when unset (PocketBase has no null for relations). */
  start_stop: string;
  /** `days.end_stop`; "" when unset. */
  end_stop: string;
}

export interface CrossDayLegStop {
  id: string;
  day: string;
  order_index: number;
}

export interface CrossDayLegPair {
  id: string;
  from_stop: string;
  to_stop: string;
}

export interface CrossDayLegPlan {
  /** New cross-day legs to route and create. */
  create: Array<{ from_stop: string; to_stop: string }>;
  /** Stale cross-day legs to drop (a pointer changed or was cleared, or the
   * day's first/last stop changed or was removed). */
  deleteLegIds: string[];
  /** Correct cross-day legs whose endpoint coordinates moved and so need a
   * fresh route (endpoints unchanged). */
  rerouteLegIds: string[];
}

/**
 * Diff every day's current cross-day legs against what its `start_stop` /
 * `end_stop` pointers and its own first/last stop now imply. Idempotent — a
 * trip already in the right shape contributes nothing.
 *
 * `rerouteStopIds` are stops whose coordinates just changed; a surviving leg
 * touching one of them is re-routed in place.
 */
export function planCrossDayLegs(
  days: CrossDayLegDay[],
  stops: CrossDayLegStop[],
  legs: CrossDayLegPair[],
  rerouteStopIds: ReadonlySet<string> = new Set(),
): CrossDayLegPlan {
  const dayOf = new Map(stops.map((s) => [s.id, s.day]));
  const firstStopByDay = new Map<string, string>();
  const lastStopByDay = new Map<string, string>();
  for (const day of days) {
    const ordered = stops
      .filter((s) => s.day === day.id)
      .sort((a, b) => a.order_index - b.order_index);
    const first = ordered[0];
    if (first) {
      firstStopByDay.set(day.id, first.id);
      lastStopByDay.set(day.id, ordered[ordered.length - 1]!.id);
    }
  }

  /** A pointer only earns a leg when it resolves to a stop in another day —
   * a same-day pointer would produce a leg indistinguishable from an ordinary
   * within-day one, which `pb-legs` owns. */
  const inAnotherDay = (stopId: string | null, dayId: string): boolean =>
    stopId != null && dayOf.has(stopId) && dayOf.get(stopId) !== dayId;

  const desired: Array<{ from_stop: string; to_stop: string }> = [];
  for (const day of days) {
    const firstStopId = firstStopByDay.get(day.id) ?? null;
    const lastStopId = lastStopByDay.get(day.id) ?? null;

    const startStopId = day.start_stop || null;
    if (firstStopId && inAnotherDay(startStopId, day.id)) {
      desired.push({ from_stop: startStopId!, to_stop: firstStopId });
    }

    const endStopId = day.end_stop || null;
    if (lastStopId && inAnotherDay(endStopId, day.id)) {
      desired.push({ from_stop: lastStopId, to_stop: endStopId! });
    }
  }

  const existing = legs.filter(
    (l) =>
      dayOf.has(l.from_stop) &&
      dayOf.has(l.to_stop) &&
      dayOf.get(l.from_stop) !== dayOf.get(l.to_stop),
  );

  const key = (l: { from_stop: string; to_stop: string }) =>
    `${l.from_stop}->${l.to_stop}`;
  const existingByKey = new Map(existing.map((l) => [key(l), l]));
  const desiredKeys = new Set(desired.map(key));

  const create: CrossDayLegPlan['create'] = [];
  const deleteLegIds: string[] = [];
  const rerouteLegIds: string[] = [];

  for (const want of desired) {
    const match = existingByKey.get(key(want));
    if (!match) {
      create.push(want);
    } else if (
      rerouteStopIds.has(match.from_stop) ||
      rerouteStopIds.has(match.to_stop)
    ) {
      rerouteLegIds.push(match.id);
    }
  }
  for (const l of existing) {
    if (!desiredKeys.has(key(l))) deleteLegIds.push(l.id);
  }

  return { create, deleteLegIds, rerouteLegIds };
}
