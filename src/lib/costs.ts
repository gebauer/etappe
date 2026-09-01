/**
 * Cost totals (WORK 16.7, phase 11.1's entry surface).
 *
 * The `costs` collection has existed since migration `1788000000` — trip,
 * parent_type, parent_id, label, amount, currency, category, is_estimate —
 * and until now nothing in the app read or wrote a single row of it.
 *
 * Costs are **members-only** (author, 2026-09-01): the collection has no
 * `visibility` field and is not getting one, and the share payload never
 * reads it. Keeping the rule at "the hook doesn't touch the collection" is
 * cheaper to be sure of than filtering.
 *
 * Pure. Amounts are summed as given — no currency conversion, which is out
 * of scope for v1; a trip has one currency.
 */

import type { CostsResponse } from '../types/pb';

export interface CostTotal {
  /** Sum of every cost, estimates included. */
  total: number;
  /** The part of it that is flagged as an estimate. */
  estimated: number;
  count: number;
}

export function sumCosts(costs: CostsResponse[]): CostTotal {
  let total = 0;
  let estimated = 0;
  for (const cost of costs) {
    total += cost.amount;
    if (cost.is_estimate) estimated += cost.amount;
  }
  return { total, estimated, count: costs.length };
}

/** The costs attached to one stop, day, leg or the trip itself. */
export function costsFor(
  costs: CostsResponse[],
  parentType: 'trip' | 'day' | 'stop' | 'leg' | 'poi',
  parentId: string,
): CostsResponse[] {
  return costs.filter(
    (c) => c.parent_type === parentType && c.parent_id === parentId,
  );
}

/**
 * What a day costs: its own costs plus those of the stops on it. A leg's
 * cost (a ferry, a toll) counts towards the day its stops sit in, which is
 * why the caller passes the leg ids that belong to the day.
 */
export function dayTotal(
  costs: CostsResponse[],
  dayId: string,
  stopIds: string[],
  legIds: string[] = [],
): CostTotal {
  const ids = new Set([dayId, ...stopIds, ...legIds]);
  return sumCosts(costs.filter((c) => c.parent_id && ids.has(c.parent_id)));
}

/** Everything in the trip, whatever it hangs off. */
export function tripTotal(costs: CostsResponse[]): CostTotal {
  return sumCosts(costs);
}

/** Per-category breakdown, biggest first. Phase 11.1 reports on this; the
 * card only needs the totals above. */
export function byCategory(
  costs: CostsResponse[],
): { category: string; total: number }[] {
  const sums = new Map<string, number>();
  for (const cost of costs) {
    const key = cost.category?.trim() || 'uncategorized';
    sums.set(key, (sums.get(key) ?? 0) + cost.amount);
  }
  return [...sums.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** `1.234,50 €`-style is a locale question the app doesn't take a position
 * on; this is the plain, unambiguous form the rest of the UI uses. */
export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text} ${currency}`;
}
