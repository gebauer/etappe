/**
 * Leg lifecycle (WORK 3.2). Legs are never created by hand: inserting a stop
 * splits the leg it lands in and re-routes both halves; deleting a stop merges
 * its two legs into one and re-routes. The split/merge decision is pure and
 * tested; the async apply routes car legs (others keep their manual duration)
 * and commits the deletes/creates in one batch.
 */

import type { TypedPocketBase } from '../types/pb';
import { isRoutable, type LatLon, type RoutingProvider } from './routing';

export type LegMode = 'car' | 'walk' | 'flight' | 'ferry' | 'bike' | 'other';
export type Surface = 'paved' | 'gravel' | 'froad';

const DEFAULT_MODE: LegMode = 'car';
const DEFAULT_SURFACE: Surface | null = null;

export interface LegLike {
  id: string;
  from_stop: string;
  to_stop: string;
  mode: LegMode;
  surface?: Surface | null;
}

export interface NewLeg {
  from_stop: string;
  to_stop: string;
  mode: LegMode;
  surface: Surface | null;
}

export interface LegPlan {
  deleteLegIds: string[];
  create: NewLeg[];
}

function templateOf(leg: LegLike | null): {
  mode: LegMode;
  surface: Surface | null;
} {
  return leg
    ? { mode: leg.mode, surface: leg.surface ?? null }
    : { mode: DEFAULT_MODE, surface: DEFAULT_SURFACE };
}

/**
 * Insert `newId` between `prevId` and `nextId`. When both neighbours exist the
 * existing leg between them is split into two that inherit its mode/surface;
 * inserting at the start or end just adds the one new leg.
 */
export function planInsertBetween(
  existing: LegLike | null,
  prevId: string | null,
  newId: string,
  nextId: string | null,
): LegPlan {
  const deleteLegIds = existing ? [existing.id] : [];
  const t = templateOf(existing);
  const create: NewLeg[] = [];
  if (prevId !== null) {
    create.push({
      from_stop: prevId,
      to_stop: newId,
      mode: t.mode,
      surface: t.surface,
    });
  }
  if (nextId !== null) {
    create.push({
      from_stop: newId,
      to_stop: nextId,
      mode: t.mode,
      surface: t.surface,
    });
  }
  return { deleteLegIds, create };
}

/**
 * Delete the stop between `prevId` and `nextId`, removing its incoming and
 * outgoing legs and, when both neighbours remain, merging them into one leg
 * that inherits the incoming leg's mode/surface.
 */
export function planDeleteStop(
  incoming: LegLike | null,
  outgoing: LegLike | null,
  prevId: string | null,
  nextId: string | null,
): LegPlan {
  const deleteLegIds: string[] = [];
  if (incoming) deleteLegIds.push(incoming.id);
  if (outgoing) deleteLegIds.push(outgoing.id);
  const create: NewLeg[] = [];
  if (prevId !== null && nextId !== null) {
    const t = templateOf(incoming ?? outgoing);
    create.push({
      from_stop: prevId,
      to_stop: nextId,
      mode: t.mode,
      surface: t.surface,
    });
  }
  return { deleteLegIds, create };
}

// --- async apply -----------------------------------------------------------

/** Fields written to a legs record, with routing filled in for car legs. */
async function buildLegRecord(
  provider: RoutingProvider,
  leg: NewLeg,
  coords: Map<string, LatLon | null>,
): Promise<Record<string, unknown>> {
  const base = {
    from_stop: leg.from_stop,
    to_stop: leg.to_stop,
    mode: leg.mode,
    surface: leg.surface,
    seasonal_warning: leg.surface === 'froad',
  };
  const from = coords.get(leg.from_stop);
  const to = coords.get(leg.to_stop);
  if (!isRoutable(leg.mode) || !from || !to) {
    // Non-car legs (and legs missing coordinates) keep a manual duration.
    return {
      ...base,
      duration_min: 0,
      distance_m: 0,
      routing_source: 'manual',
    };
  }
  const r = await provider.route(from, to);
  return {
    ...base,
    duration_min: r.duration_min,
    distance_m: r.distance_m,
    geometry: r.geometry,
    routing_source: 'ors',
  };
}

/** Apply a leg plan: route the new car legs, then commit deletes and creates
 * in a single batch. Returns the created leg ids. */
export async function applyLegPlan(
  pb: TypedPocketBase,
  provider: RoutingProvider,
  plan: LegPlan,
  coords: Map<string, LatLon | null>,
): Promise<string[]> {
  const records = await Promise.all(
    plan.create.map((leg) => buildLegRecord(provider, leg, coords)),
  );
  const batch = pb.createBatch();
  for (const id of plan.deleteLegIds) batch.collection('legs').delete(id);
  for (const record of records) batch.collection('legs').create(record);
  const results = await batch.send();
  return results
    .slice(plan.deleteLegIds.length)
    .map((r) => (r.body?.id as string | undefined) ?? '')
    .filter((id) => id !== '');
}
