/**
 * Moving a stop (WORK 4.3): within a day or across day headers. Pure planning —
 * returns the stop day/order_index rewrites and a leg plan. Legs are
 * reconciled over the affected stops: pairs that still exist are kept (so their
 * mode/surface survive), vanished pairs are deleted, and new pairs are created
 * (car/no-surface by default) for re-routing. The caller applies it.
 */

import type { LegPlan, NewLeg } from './pb-legs';

export interface StopPos {
  id: string;
  day: string;
  order_index: number;
}

export interface LegPair {
  id: string;
  from_stop: string;
  to_stop: string;
}

export interface StopUpdate {
  id: string;
  day: string;
  order_index: number;
}

export interface StopMovePlan {
  stopUpdates: StopUpdate[];
  legPlan: LegPlan;
}

const EMPTY: StopMovePlan = {
  stopUpdates: [],
  legPlan: { deleteLegIds: [], create: [] },
};

function orderedIds(stops: StopPos[], dayId: string): string[] {
  return stops
    .filter((s) => s.day === dayId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => s.id);
}

function reconcile(
  desired: Array<[string, string]>,
  existing: LegPair[],
): LegPlan {
  const key = (a: string, b: string) => `${a}->${b}`;
  const desiredSet = new Set(desired.map(([a, b]) => key(a, b)));
  const existingSet = new Set(existing.map((l) => key(l.from_stop, l.to_stop)));
  const deleteLegIds = existing
    .filter((l) => !desiredSet.has(key(l.from_stop, l.to_stop)))
    .map((l) => l.id);
  const create: NewLeg[] = desired
    .filter(([a, b]) => !existingSet.has(key(a, b)))
    .map(([a, b]) => ({
      from_stop: a,
      to_stop: b,
      mode: 'car',
      surface: null,
    }));
  return { deleteLegIds, create };
}

/**
 * Move `stopId` to `targetIndex` within `targetDayId`. `targetIndex` is the
 * position among the target day's stops with the moved stop already removed
 * (i.e. "insert before the stop currently at that index").
 */
export function planStopMove(
  stops: StopPos[],
  legs: LegPair[],
  stopId: string,
  targetDayId: string,
  targetIndex: number,
): StopMovePlan {
  const moved = stops.find((s) => s.id === stopId);
  if (!moved) return EMPTY;
  const sourceDayId = moved.day;

  const source = orderedIds(stops, sourceDayId).filter((id) => id !== stopId);
  const targetBase =
    sourceDayId === targetDayId
      ? source
      : orderedIds(stops, targetDayId).filter((id) => id !== stopId);
  const idx = Math.max(0, Math.min(targetIndex, targetBase.length));
  const target = [
    ...targetBase.slice(0, idx),
    stopId,
    ...targetBase.slice(idx),
  ];

  const lists: Array<[string, string[]]> =
    sourceDayId === targetDayId
      ? [[targetDayId, target]]
      : [
          [sourceDayId, source],
          [targetDayId, target],
        ];

  const newPos = new Map<string, { day: string; order_index: number }>();
  for (const [dayId, list] of lists) {
    list.forEach((id, i) => newPos.set(id, { day: dayId, order_index: i }));
  }

  const stopUpdates: StopUpdate[] = [];
  for (const s of stops) {
    const np = newPos.get(s.id);
    if (np && (np.day !== s.day || np.order_index !== s.order_index)) {
      stopUpdates.push({ id: s.id, day: np.day, order_index: np.order_index });
    }
  }

  const affected = new Set(newPos.keys());
  const existing = legs.filter(
    (l) => affected.has(l.from_stop) && affected.has(l.to_stop),
  );
  const desired: Array<[string, string]> = [];
  for (const [, list] of lists) {
    for (let i = 0; i < list.length - 1; i++)
      desired.push([list[i]!, list[i + 1]!]);
  }

  return { stopUpdates, legPlan: reconcile(desired, existing) };
}
