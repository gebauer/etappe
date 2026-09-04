/**
 * Applies day insert / delete / move atomically (WORK 1.2).
 *
 * The order_index math lives in ./day-ordering (pure, unit-tested). This layer
 * reads the current day orders, runs a plan, and commits every write in a
 * single PocketBase batch so the reindex is all-or-nothing. Each operation
 * returns the day-parented blocks whose derived date shifted, for the warning
 * dialog.
 */

import type {
  TypedPocketBase,
  DaysResponse,
  BlocksResponse,
} from '../types/pb';
import {
  planInsertDay,
  planDeleteDay,
  planMoveDay,
  type DayOrder,
  type OrderUpdate,
} from './day-ordering';

export interface NewDayInput {
  kind: DaysResponse['kind'];
  title?: string;
  notes?: string;
}

async function fetchDayOrders(
  pb: TypedPocketBase,
  tripId: string,
): Promise<DayOrder[]> {
  const records = await pb.collection('days').getFullList({
    filter: pb.filter('trip = {:trip}', { trip: tripId }),
    fields: 'id,order_index',
    sort: 'order_index',
  });
  return records.map((r) => ({ id: r.id, order_index: r.order_index }));
}

async function blocksOnChangedDays(
  pb: TypedPocketBase,
  changedDayIds: string[],
): Promise<BlocksResponse[]> {
  if (changedDayIds.length === 0) return [];
  const clause = changedDayIds
    .map((_, i) => `parent_id = {:d${i}}`)
    .join(' || ');
  const params = Object.fromEntries(
    changedDayIds.map((id, i) => [`d${i}`, id]),
  );
  return pb.collection('blocks').getFullList({
    filter: pb.filter(`parent_type = "day" && (${clause})`, params),
  });
}

function queueUpdates(
  batch: ReturnType<TypedPocketBase['createBatch']>,
  updates: OrderUpdate[],
): void {
  for (const u of updates) {
    batch.collection('days').update(u.id, { order_index: u.order_index });
  }
}

export interface InsertDayResult {
  id: string;
  changedBlocks: BlocksResponse[];
}

/** Insert a new day at `atIndex`, reindexing the days below it. */
export async function insertDay(
  pb: TypedPocketBase,
  tripId: string,
  atIndex: number,
  day: NewDayInput,
): Promise<InsertDayResult> {
  const plan = planInsertDay(await fetchDayOrders(pb, tripId), atIndex);
  const batch = pb.createBatch();
  queueUpdates(batch, plan.updates);
  batch.collection('days').create({
    trip: tripId,
    order_index: plan.newOrderIndex,
    kind: day.kind,
    title: day.title ?? '',
    notes: day.notes ?? '',
  });
  const results = await batch.send();
  const created = results.at(-1);
  const id = created?.body?.id as string | undefined;
  if (!id) throw new Error('batch did not return the created day id');
  return {
    id,
    changedBlocks: await blocksOnChangedDays(pb, plan.changedDayIds),
  };
}

/** Delete a day and its stops (cascade), reindexing the days below it. */
export async function deleteDay(
  pb: TypedPocketBase,
  tripId: string,
  dayId: string,
): Promise<BlocksResponse[]> {
  const plan = planDeleteDay(await fetchDayOrders(pb, tripId), dayId);
  const batch = pb.createBatch();
  batch.collection('days').delete(dayId);
  queueUpdates(batch, plan.updates);
  await batch.send();
  return blocksOnChangedDays(pb, plan.changedDayIds);
}

/** Move a day to `toIndex`, reindexing the days it passes over.
 *
 * **Intentionally unused right now** (audit, 2026-09-04): the Phase 12
 * redesign dropped the draggable day rail, so nothing calls this. Kept so
 * day reordering can come back without rewriting the reindex logic. */
export async function moveDay(
  pb: TypedPocketBase,
  tripId: string,
  dayId: string,
  toIndex: number,
): Promise<BlocksResponse[]> {
  const plan = planMoveDay(await fetchDayOrders(pb, tripId), dayId, toIndex);
  if (plan.updates.length === 0) return [];
  const batch = pb.createBatch();
  queueUpdates(batch, plan.updates);
  await batch.send();
  return blocksOnChangedDays(pb, plan.changedDayIds);
}
