/**
 * Async apply for cross-day leg reconciliation (WORK 13.2, extended in
 * WORK 29) — the counterpart to `pb-legs`'s `applyLegPlan`. Fetches fresh
 * trip state so it always sees the post-mutation shape, diffs it with the
 * pure `planCrossDayLegs`, routes the new/changed legs through the same
 * hook + cache every other leg uses, and commits deletes/creates/updates in
 * one batch.
 *
 * Call it after any structural edit once a trip actually has a start or end
 * point: add/remove/reorder/move a stop, set or clear either pointer, or move
 * a referenced stop's coordinates (pass `rerouteStopIds` for the last).
 */

import type { TypedPocketBase } from '../types/pb';
import type { RoutingProvider } from './routing';
import { buildLegRecord } from './pb-legs';
import { coordsOf } from './pb-stops';
import { loadTripRecords } from './pb-trip-doc';
import { planCrossDayLegs } from './cross-day-legs';

/** Write a day's start-point pointer. `null` clears it (PocketBase stores ""
 * for an unset relation). The caller reconciles afterwards. */
export async function setDayStartStop(
  pb: TypedPocketBase,
  dayId: string,
  startStopId: string | null,
): Promise<void> {
  await pb.collection('days').update(dayId, { start_stop: startStopId ?? '' });
}

/** Write a day's end-point pointer — where you sleep when the day's own last
 * stop is a day trip out and back (WORK 29). `null` clears it. */
export async function setDayEndStop(
  pb: TypedPocketBase,
  dayId: string,
  endStopId: string | null,
): Promise<void> {
  await pb.collection('days').update(dayId, { end_stop: endStopId ?? '' });
}

export async function reconcileCrossDayLegs(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  tripId: string,
  rerouteStopIds: ReadonlySet<string> = new Set(),
): Promise<void> {
  const { days, stops, legs } = await loadTripRecords(pb, tripId);
  const plan = planCrossDayLegs(days, stops, legs, rerouteStopIds);
  if (
    plan.create.length === 0 &&
    plan.deleteLegIds.length === 0 &&
    plan.rerouteLegIds.length === 0
  ) {
    return;
  }

  const coords = coordsOf(stops);
  const legById = new Map(legs.map((l) => [l.id, l]));

  // Cross-day legs are always car legs with no surface — a hotel-to-first-stop
  // transfer (or the drive back), nothing off-road about it by default. A
  // later per-leg edit (surface/buffer) still applies via the normal LegPatch
  // path.
  const created = await Promise.all(
    plan.create.map((c) =>
      buildLegRecord(
        provider,
        {
          from_stop: c.from_stop,
          to_stop: c.to_stop,
          mode: 'car',
          surface: null,
        },
        coords,
      ),
    ),
  );
  const rerouted = await Promise.all(
    plan.rerouteLegIds.map((id) => {
      const l = legById.get(id)!;
      return buildLegRecord(
        provider,
        {
          from_stop: l.from_stop,
          to_stop: l.to_stop,
          mode: l.mode,
          surface: l.surface || null,
        },
        coords,
      );
    }),
  );

  const batch = pb.createBatch();
  for (const id of plan.deleteLegIds) batch.collection('legs').delete(id);
  for (const record of created) batch.collection('legs').create(record);
  plan.rerouteLegIds.forEach((id, i) =>
    batch.collection('legs').update(id, rerouted[i]!),
  );
  await batch.send();
}
