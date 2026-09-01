/**
 * Leading-leg planning (WORK 13.2). The leading leg is the model's one
 * cross-day leg: `from_stop` is a day's start point (`days.start_stop`,
 * normally the previous day's accommodation), `to_stop` is that day's first
 * stop. It carries the morning drive the cascade adds before the day's first
 * arrival (WORK 13.1).
 *
 * The within-day leg lifecycle in `pb-legs`/`stop-move` deliberately ignores
 * cross-day legs, so this is the sole owner of leading-leg create/delete/
 * reroute. Pure and tested; the async apply (`reconcileLeadingLegs` in
 * `pb-leading-leg.ts`) routes the new/changed legs and commits the batch.
 */

export interface LeadingLegDay {
  id: string;
  /** `days.start_stop`; "" when unset (PocketBase has no null for relations). */
  start_stop: string;
}

export interface LeadingLegStop {
  id: string;
  day: string;
  order_index: number;
}

export interface LeadingLegPair {
  id: string;
  from_stop: string;
  to_stop: string;
}

export interface LeadingLegPlan {
  /** New leading legs to route and create. */
  create: Array<{ from_stop: string; to_stop: string }>;
  /** Stale leading legs to drop (pointer changed, first stop changed/removed,
   * or the pointer was cleared). */
  deleteLegIds: string[];
  /** Correct leading legs whose endpoint coordinates moved and so need a
   * fresh route (endpoints unchanged). */
  rerouteLegIds: string[];
}

/**
 * Diff every day's current leading leg against what its `start_stop` pointer
 * and first stop now imply. Idempotent — a day already in the right shape
 * contributes nothing.
 *
 * A leading leg is desired for a day when its `start_stop` resolves to a real
 * stop that isn't the day's own first stop, and the day has a first stop. Any
 * existing leg landing on this day's first (or any) stop whose other end sits
 * in a different day is treated as this day's (possibly stale) leading leg.
 *
 * `rerouteStopIds` are stops whose coordinates just changed; a matching
 * leading leg touching one of them is re-routed in place.
 */
export function planLeadingLegs(
  days: LeadingLegDay[],
  stops: LeadingLegStop[],
  legs: LeadingLegPair[],
  rerouteStopIds: ReadonlySet<string> = new Set(),
): LeadingLegPlan {
  const dayOf = new Map(stops.map((s) => [s.id, s.day]));
  const firstStopByDay = new Map<string, string>();
  for (const day of days) {
    const first = stops
      .filter((s) => s.day === day.id)
      .sort((a, b) => a.order_index - b.order_index)[0];
    if (first) firstStopByDay.set(day.id, first.id);
  }

  const create: LeadingLegPlan['create'] = [];
  const deleteLegIds: string[] = [];
  const rerouteLegIds: string[] = [];

  for (const day of days) {
    const firstStopId = firstStopByDay.get(day.id) ?? null;
    const startStopId = day.start_stop || null;
    const startResolves = startStopId != null && dayOf.has(startStopId);
    const desired =
      firstStopId && startResolves && startStopId !== firstStopId
        ? { from_stop: startStopId, to_stop: firstStopId }
        : null;

    const existing = legs.filter(
      (l) =>
        dayOf.get(l.to_stop) === day.id &&
        dayOf.has(l.from_stop) &&
        dayOf.get(l.from_stop) !== day.id,
    );

    const match = desired
      ? existing.find(
          (l) =>
            l.from_stop === desired.from_stop && l.to_stop === desired.to_stop,
        )
      : undefined;

    for (const l of existing) if (l !== match) deleteLegIds.push(l.id);
    if (desired && !match) create.push(desired);
    if (
      match &&
      (rerouteStopIds.has(match.from_stop) || rerouteStopIds.has(match.to_stop))
    ) {
      rerouteLegIds.push(match.id);
    }
  }

  return { create, deleteLegIds, rerouteLegIds };
}
