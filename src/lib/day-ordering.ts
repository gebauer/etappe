/**
 * Pure day-ordering logic (BUILD §2, WORK 1.2).
 *
 * A trip's days are kept in a contiguous, 0-based `order_index` sequence. The
 * first day has index 0, so its derived date is `trip.start_date + 0`. These
 * helpers compute the minimal set of `order_index` rewrites for inserting,
 * deleting and moving a day, plus which existing days' derived date shifts as a
 * result — never any absolute date. The caller applies the plan atomically.
 */

export interface DayOrder {
  id: string;
  order_index: number;
}

export interface OrderUpdate {
  id: string;
  order_index: number;
}

export interface ReindexPlan {
  /** Existing days whose `order_index` must be rewritten (minimal set). */
  updates: OrderUpdate[];
  /** Ids of existing days whose derived date shifts (same set as `updates`). */
  changedDayIds: string[];
}

export interface InsertPlan extends ReindexPlan {
  /** `order_index` the newly created day should take. */
  newOrderIndex: number;
}

function sortByOrder(days: DayOrder[]): DayOrder[] {
  return [...days].sort((a, b) => a.order_index - b.order_index);
}

/** Build a plan from the desired final ordering of ids against current state. */
function planFromOrder(sorted: DayOrder[], finalIds: string[]): ReindexPlan {
  const current = new Map(sorted.map((d) => [d.id, d.order_index]));
  const updates: OrderUpdate[] = [];
  finalIds.forEach((id, index) => {
    if (current.get(id) !== index) updates.push({ id, order_index: index });
  });
  return { updates, changedDayIds: updates.map((u) => u.id) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Insert a new day at `atIndex`. Existing days at or after that position shift
 * down by one. Returns the shifts plus the `order_index` for the new record.
 */
export function planInsertDay(days: DayOrder[], atIndex: number): InsertPlan {
  const sorted = sortByOrder(days);
  const pos = clamp(atIndex, 0, sorted.length);
  const updates: OrderUpdate[] = [];
  sorted.forEach((day, index) => {
    const target = index >= pos ? index + 1 : index;
    if (day.order_index !== target) {
      updates.push({ id: day.id, order_index: target });
    }
  });
  return {
    updates,
    changedDayIds: updates.map((u) => u.id),
    newOrderIndex: pos,
  };
}

/**
 * Remove `dayId`. Days after it shift up by one to keep the sequence
 * contiguous. The deleted record itself is removed by the caller.
 */
export function planDeleteDay(days: DayOrder[], dayId: string): ReindexPlan {
  const sorted = sortByOrder(days);
  const finalIds = sorted.map((d) => d.id).filter((id) => id !== dayId);
  return planFromOrder(sorted, finalIds);
}

/**
 * Move `dayId` to `toIndex` (its position in the resulting sequence), shifting
 * the days it passes over. A move to its current position yields no updates.
 */
export function planMoveDay(
  days: DayOrder[],
  dayId: string,
  toIndex: number,
): ReindexPlan {
  const sorted = sortByOrder(days);
  const without = sorted.map((d) => d.id).filter((id) => id !== dayId);
  if (without.length === sorted.length) {
    return { updates: [], changedDayIds: [] }; // dayId not present
  }
  const dest = clamp(toIndex, 0, without.length);
  const finalIds = [...without.slice(0, dest), dayId, ...without.slice(dest)];
  return planFromOrder(sorted, finalIds);
}

/**
 * The blocks whose parent day is among `changedDayIds` — i.e. those now falling
 * on a different derived date. Used to warn before committing a day insert.
 */
export function blocksOnDays<
  T extends { parent_type: string; parent_id: string },
>(changedDayIds: string[], blocks: T[]): T[] {
  const ids = new Set(changedDayIds);
  return blocks.filter((b) => b.parent_type === 'day' && ids.has(b.parent_id));
}
