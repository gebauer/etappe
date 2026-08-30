/**
 * Stop mutations for the editor (WORK 4.2). Creating a stop wires its leg via
 * the phase 3.2 lifecycle; deleting one relies on the legs' cascadeDelete to
 * drop its legs, then re-merges the neighbours. Field edits are plain updates.
 */

import type { TypedPocketBase, StopsResponse, LegsResponse } from '../types/pb';
import {
  planInsertBetween,
  applyLegPlan,
  buildLegRecord,
  type LegLike,
} from './pb-legs';
import type { LatLon, RoutingProvider } from './routing';

function coordsOf(stops: StopsResponse[]): Map<string, LatLon | null> {
  const map = new Map<string, LatLon | null>();
  for (const s of stops) {
    map.set(s.id, s.lat && s.lon ? { lat: s.lat, lon: s.lon } : null);
  }
  return map;
}

/** Append a new stop to a day and connect it from the previous stop. */
export async function addStopAtEnd(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  dayId: string,
  dayStops: StopsResponse[],
): Promise<string> {
  const created = await pb.collection('stops').create({
    day: dayId,
    order_index: dayStops.length,
    title: 'New stop',
    kind: 'uncategorized',
  });
  const prev = dayStops[dayStops.length - 1] ?? null;
  const plan = planInsertBetween(null, prev?.id ?? null, created.id, null);
  const coords = coordsOf([...dayStops, created]);
  await applyLegPlan(pb, provider, plan, coords);
  return created.id;
}

/** Delete a stop; its legs cascade-delete, and the two neighbours (if any) are
 * re-merged into a single re-routed leg. */
export async function deleteStop(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  dayStops: StopsResponse[],
  legs: LegsResponse[],
  stopId: string,
): Promise<void> {
  const ordered = [...dayStops].sort((a, b) => a.order_index - b.order_index);
  const index = ordered.findIndex((s) => s.id === stopId);
  const prev = index > 0 ? ordered[index - 1]! : null;
  const next = index < ordered.length - 1 ? ordered[index + 1]! : null;

  await pb.collection('stops').delete(stopId); // legs cascade away

  if (prev && next) {
    const template = legs.find(
      (l) => l.from_stop === prev.id && l.to_stop === stopId,
    ) as LegLike | undefined;
    const coords = coordsOf(ordered);
    const record = await buildLegRecord(
      provider,
      {
        from_stop: prev.id,
        to_stop: next.id,
        mode: template?.mode ?? 'car',
        surface: template?.surface ?? null,
      },
      coords,
    );
    await pb.collection('legs').create(record);
  }
}

export type StopPatch = Partial<
  Pick<
    StopsResponse,
    | 'title'
    | 'kind'
    | 'dwell_override'
    | 'anchor_time'
    | 'anchor_type'
    | 'is_accommodation'
  >
>;

export async function updateStop(
  pb: TypedPocketBase,
  stopId: string,
  patch: StopPatch,
): Promise<void> {
  await pb.collection('stops').update(stopId, patch);
}

export type LegPatch = Partial<
  Pick<LegsResponse, 'surface' | 'buffer_override_pct' | 'duration_min'>
>;

export async function updateLeg(
  pb: TypedPocketBase,
  legId: string,
  patch: LegPatch,
): Promise<void> {
  await pb.collection('legs').update(legId, patch);
}
