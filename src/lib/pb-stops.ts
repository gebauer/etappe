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
  type LegMode,
  type Surface,
} from './pb-legs';
import type { LatLon, RoutingProvider } from './routing';
import { planStopMove } from './stop-move';
import type { TripRecords } from './pb-trip-doc';
import { reparentBlocks } from './pb-blocks';
import { addWishlistItem, setPoiStarred } from './pb-pois';

/** Coordinates to route to/from for each stop: the stop's own location, or
 * its `access_lat`/`access_lon` when set — a nearby road or car park for a
 * POI that isn't itself reachable by car. The stop's map marker always shows
 * the real location; only routing uses the access point. */
export function coordsOf(stops: StopsResponse[]): Map<string, LatLon | null> {
  const map = new Map<string, LatLon | null>();
  for (const s of stops) {
    const [lat, lon] =
      s.access_lat && s.access_lon
        ? [s.access_lat, s.access_lon]
        : [s.lat, s.lon];
    map.set(s.id, lat && lon ? { lat, lon } : null);
  }
  return map;
}

export interface NewStopData {
  title?: string;
  kind?: string;
  lat?: number;
  lon?: number;
  kind_confirmed?: boolean;
}

/** Append a new stop to a day and connect it from the previous stop. With
 * coordinates the new car leg auto-routes; without, it stays manual. */
export async function addStopAtEnd(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  dayId: string,
  dayStops: StopsResponse[],
  data: NewStopData = {},
): Promise<string> {
  const created = await pb.collection('stops').create({
    day: dayId,
    order_index: dayStops.length,
    title: data.title ?? 'New stop',
    kind: data.kind ?? 'uncategorized',
    kind_confirmed: data.kind_confirmed ?? false,
    lat: data.lat ?? 0,
    lon: data.lon ?? 0,
  });
  const prev = dayStops[dayStops.length - 1] ?? null;
  const plan = planInsertBetween(null, prev?.id ?? null, created.id, null);
  const coords = coordsOf([...dayStops, created]);
  await applyLegPlan(pb, provider, plan, coords);
  return created.id;
}

/** Create a new stop and insert it at `targetIndex` within `targetDayId`
 * (WORK 6.3 — the placement picker's commit step). The stop is created first
 * at the day's current end, then "moved" into its real position via the same
 * planStopMove drag-and-drop already uses, so there's no separate
 * insert-at-arbitrary-index reindex logic to keep in sync with it. */
export async function addStopAt(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  records: TripRecords,
  targetDayId: string,
  targetIndex: number,
  data: NewStopData = {},
): Promise<string> {
  const dayStops = records.stops.filter((s) => s.day === targetDayId);
  const created = await pb.collection('stops').create({
    day: targetDayId,
    order_index: dayStops.length,
    title: data.title ?? 'New stop',
    kind: data.kind ?? 'uncategorized',
    kind_confirmed: data.kind_confirmed ?? false,
    lat: data.lat ?? 0,
    lon: data.lon ?? 0,
  });

  const positions = [
    ...records.stops.map((s) => ({
      id: s.id,
      day: s.day,
      order_index: s.order_index,
    })),
    { id: created.id, day: targetDayId, order_index: dayStops.length },
  ];
  const pairs = records.legs.map((l) => ({
    id: l.id,
    from_stop: l.from_stop,
    to_stop: l.to_stop,
  }));
  const { stopUpdates, legPlan } = planStopMove(
    positions,
    pairs,
    created.id,
    targetDayId,
    targetIndex,
  );

  if (stopUpdates.length > 0) {
    const batch = pb.createBatch();
    for (const u of stopUpdates) {
      batch.collection('stops').update(u.id, {
        day: u.day,
        order_index: u.order_index,
      });
    }
    await batch.send();
  }
  await applyLegPlan(
    pb,
    provider,
    legPlan,
    coordsOf([...records.stops, created]),
  );
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

/** The mirror of promotion (WORK 14.2): move a stop back to the wishlist.
 * Creates a poi carrying the stop's shared fields, re-parents its blocks,
 * then deletes the stop via the normal path above (leg re-merge). If the
 * stop was some day's `start_stop` or another day's first stop, that
 * pointer/leading-leg is the caller's `reconcileLeadingLegs`' problem, same
 * as any other structural stop change. */
export async function downgradeStopToWishlist(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  records: TripRecords,
  stopId: string,
): Promise<void> {
  const stop = records.stops.find((s) => s.id === stopId);
  if (!stop) return;
  const dayStops = records.stops.filter((s) => s.day === stop.day);

  const poiId = await addWishlistItem(pb, records.trip.id, {
    title: stop.title,
    kind: stop.kind,
    lat: stop.lat || undefined,
    lon: stop.lon || undefined,
    address: stop.address || undefined,
    access_lat: stop.access_lat || undefined,
    access_lon: stop.access_lon || undefined,
  });
  if (stop.starred) await setPoiStarred(pb, poiId, true);
  await reparentBlocks(
    pb,
    records.blocks,
    { type: 'stop', id: stopId },
    { type: 'poi', id: poiId },
  );
  await deleteStop(pb, provider, dayStops, records.legs, stopId);
}

/** Move a stop within a day or to another day, reindexing and re-routing the
 * affected legs (WORK 4.3). */
export async function moveStop(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  records: TripRecords,
  stopId: string,
  targetDayId: string,
  targetIndex: number,
): Promise<void> {
  const positions = records.stops.map((s) => ({
    id: s.id,
    day: s.day,
    order_index: s.order_index,
  }));
  const pairs = records.legs.map((l) => ({
    id: l.id,
    from_stop: l.from_stop,
    to_stop: l.to_stop,
  }));
  const { stopUpdates, legPlan } = planStopMove(
    positions,
    pairs,
    stopId,
    targetDayId,
    targetIndex,
  );
  if (
    stopUpdates.length === 0 &&
    legPlan.deleteLegIds.length === 0 &&
    legPlan.create.length === 0
  ) {
    return;
  }
  if (stopUpdates.length > 0) {
    const batch = pb.createBatch();
    for (const u of stopUpdates) {
      batch.collection('stops').update(u.id, {
        day: u.day,
        order_index: u.order_index,
      });
    }
    await batch.send();
  }
  await applyLegPlan(pb, provider, legPlan, coordsOf(records.stops));
}

export type StopPatch = Partial<
  Pick<
    StopsResponse,
    | 'title'
    | 'kind'
    | 'kind_confirmed'
    | 'lat'
    | 'lon'
    | 'access_lat'
    | 'access_lon'
    | 'address'
    | 'dwell_override'
    | 'anchor_time'
    | 'anchor_type'
    | 'is_accommodation'
    | 'starred'
  >
>;

export async function updateStop(
  pb: TypedPocketBase,
  stopId: string,
  patch: StopPatch,
): Promise<void> {
  await pb.collection('stops').update(stopId, patch);
}

/** Update a stop and, when its coordinates or access point changed, re-route
 * the legs on either side so a stop that gains coordinates (e.g. via the
 * inspector) or an access point (e.g. a car park for an off-road POI) gets
 * real drive times. */
export async function updateStopAndReroute(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  records: TripRecords,
  stopId: string,
  patch: StopPatch,
): Promise<void> {
  await pb.collection('stops').update(stopId, patch);
  const touchesRouting =
    patch.lat !== undefined ||
    patch.lon !== undefined ||
    patch.access_lat !== undefined ||
    patch.access_lon !== undefined;
  if (!touchesRouting) return;

  const stop = records.stops.find((s) => s.id === stopId);
  if (!stop) return;
  const dayStops = records.stops
    .filter((s) => s.day === stop.day)
    .sort((a, b) => a.order_index - b.order_index);

  const coords = coordsOf(dayStops);
  const accessLat = patch.access_lat ?? stop.access_lat;
  const accessLon = patch.access_lon ?? stop.access_lon;
  const lat = patch.lat ?? stop.lat;
  const lon = patch.lon ?? stop.lon;
  const [routeLat, routeLon] =
    accessLat && accessLon ? [accessLat, accessLon] : [lat, lon];
  coords.set(
    stopId,
    routeLat && routeLon ? { lat: routeLat, lon: routeLon } : null,
  );

  const i = dayStops.findIndex((s) => s.id === stopId);
  const pairs: Array<[StopsResponse, StopsResponse]> = [];
  if (i > 0) pairs.push([dayStops[i - 1]!, stop]);
  if (i < dayStops.length - 1) pairs.push([stop, dayStops[i + 1]!]);

  for (const [from, to] of pairs) {
    const leg = records.legs.find(
      (l) => l.from_stop === from.id && l.to_stop === to.id,
    );
    if (!leg) continue;
    const record = await buildLegRecord(
      provider,
      {
        from_stop: from.id,
        to_stop: to.id,
        mode: leg.mode,
        surface: leg.surface ?? null,
      },
      coords,
    );
    await pb.collection('legs').update(leg.id, record);
  }
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

/** Explicitly opt a car leg out of routing: keep the current duration (or a
 * user-entered one) as a manual value and drop any ORS geometry, so the map
 * falls back to a straight dashed connector instead of implying a real
 * route. `⟳ route` (rerouteLeg) is the way back to auto. */
export async function setLegManual(
  pb: TypedPocketBase,
  legId: string,
  durationMin: number,
): Promise<void> {
  await pb.collection('legs').update(legId, {
    routing_source: 'manual',
    duration_min: durationMin,
    distance_m: 0,
    geometry: null,
  });
}

/** Re-run routing for a single existing leg from its stops' current
 * coordinates. Heals a leg left manual because routing was down or hadn't run
 * when the stop was added. Returns true if the leg came back routed; a leg
 * whose endpoint has no nearby road (e.g. a trailhead) stays manual. */
export async function rerouteLeg(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  records: TripRecords,
  legId: string,
): Promise<boolean> {
  const leg = records.legs.find((l) => l.id === legId);
  if (!leg) return false;
  const record = await buildLegRecord(
    provider,
    {
      from_stop: leg.from_stop,
      to_stop: leg.to_stop,
      mode: leg.mode as LegMode,
      surface: (leg.surface ?? null) as Surface | null,
    },
    coordsOf(records.stops),
  );
  await pb.collection('legs').update(legId, record);
  return record.routing_source !== 'manual';
}
