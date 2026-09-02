/**
 * Cost totals (WORK 16.7, phase 11.1's entry surface) and budget bucketing
 * (WORK 16.10, reworked 2026-09-02).
 *
 * The `costs` collection has existed since migration `1788000000` — trip,
 * parent_type, parent_id, label, amount, currency, category, is_estimate —
 * and for a while nothing in the app read or wrote a row of it (16.7), then
 * exposed the full multi-item shape on the card (a label, an amount, an
 * estimate flag). WORK 16.10 narrows the *GUI* back down to one estimated
 * cost per stop with a currency picker — but the backend keeps every field:
 * "we can keep multiple cost items in the back if we later decide we want
 * them" (author, 2026-09-02). `sumCosts`/`costsFor`/`dayTotal`/`byCategory`
 * below still work over however many rows a stop actually has; the card
 * just only ever writes one.
 *
 * Costs are **members-only** (author, 2026-09-01): the collection has no
 * `visibility` field and is not getting one, and the share payload never
 * reads it. Keeping the rule at "the hook doesn't touch the collection" is
 * cheaper to be sure of than filtering.
 *
 * Pure. `sumCosts` et al. sum amounts as given, no conversion — a
 * same-currency view. `budgetByKind` is the converting, kind-bucketed view
 * the popover actually shows; conversion needs a rates object from outside
 * (`exchange-rates.ts`), so it stays a parameter here rather than an import,
 * keeping this module network-free like every other `lib/` file.
 */

import type { CostsResponse, StopsResponse, PoisResponse } from '../types/pb';
import { isAccommodationKind, isKind } from './taxonomy';
import { convert, isCurrencyCode, type ExchangeRates } from './currency';

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

export type BudgetBucketKey =
  'accommodation' | 'flights' | 'rental' | 'sightseeing';

export interface BudgetBucket {
  key: BudgetBucketKey;
  /** "Rental car" normally, "Rental car + fuel" once any fuel-kind cost
   * exists in the trip — a label change, not a second bucket (author,
   * 2026-09-02): a fuel receipt has nowhere more specific to go than the
   * rental it belongs to. */
  label: string;
  /** In the trip's own currency, already converted. */
  total: number;
  count: number;
}

export interface Budget {
  buckets: BudgetBucket[];
  /** Sum of every convertible bucket, in the trip currency. */
  total: number;
  /** Anything without a resolvable parent (a deleted stop/poi) or a
   * currency the cached rates don't cover — excluded from `total` rather
   * than guessed at, and surfaced so the popover can say "N not counted"
   * instead of quietly under-reporting. */
  unconverted: number;
}

function bucketFor(kind: string | undefined): BudgetBucketKey | null {
  if (!kind || !isKind(kind)) return null;
  if (isAccommodationKind(kind)) return 'accommodation';
  if (kind === 'airport') return 'flights';
  if (kind === 'rental' || kind === 'fuel') return 'rental';
  return 'sightseeing';
}

/**
 * The four-line bill the budget popover shows (WORK 16.10), converted into
 * the trip's own currency. Bucketing reads each cost's **parent's current
 * kind** — not a category stored on the cost itself — so re-kinding a stop
 * later moves its cost to the right line without an edit to the cost.
 *
 * `rates` is optional: without it (still loading, or the free rate server
 * is unreachable and there's no cache yet), same-currency costs still add
 * up correctly and everything else counts as unconverted rather than
 * blocking the whole popover on a network call.
 */
export function budgetByKind(
  costs: CostsResponse[],
  stops: StopsResponse[],
  pois: PoisResponse[],
  tripCurrency: string,
  rates: ExchangeRates | null,
): Budget {
  const kindByStop = new Map(stops.map((s) => [s.id, s.kind]));
  const kindByPoi = new Map(pois.map((p) => [p.id, p.kind]));
  const to = isCurrencyCode(tripCurrency) ? tripCurrency : 'EUR';

  const sums = new Map<BudgetBucketKey, { total: number; count: number }>();
  let hasFuel = false;
  let unconverted = 0;

  for (const cost of costs) {
    const kind =
      cost.parent_type === 'stop'
        ? kindByStop.get(cost.parent_id)
        : cost.parent_type === 'poi'
          ? kindByPoi.get(cost.parent_id)
          : undefined;
    const bucket = bucketFor(kind);
    if (!bucket) {
      unconverted += 1;
      continue;
    }
    if (kind === 'fuel') hasFuel = true;

    const from = isCurrencyCode(cost.currency) ? cost.currency : to;
    const converted =
      from === to
        ? cost.amount
        : rates
          ? convert(cost.amount, from, to, rates)
          : null;
    if (converted == null) {
      unconverted += 1;
      continue;
    }
    const prev = sums.get(bucket) ?? { total: 0, count: 0 };
    sums.set(bucket, { total: prev.total + converted, count: prev.count + 1 });
  }

  const labels: Record<BudgetBucketKey, string> = {
    accommodation: 'Accommodation',
    flights: 'Flights',
    rental: hasFuel ? 'Rental car + fuel' : 'Rental car',
    sightseeing: 'Sightseeing',
  };
  const order: BudgetBucketKey[] = [
    'accommodation',
    'flights',
    'rental',
    'sightseeing',
  ];
  const buckets = order.map((key) => {
    const s = sums.get(key);
    return {
      key,
      label: labels[key],
      total: s?.total ?? 0,
      count: s?.count ?? 0,
    };
  });

  return {
    buckets,
    total: buckets.reduce((n, b) => n + b.total, 0),
    unconverted,
  };
}

/** `1.234,50 €`-style is a locale question the app doesn't take a position
 * on; this is the plain, unambiguous form the rest of the UI uses. */
export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text} ${currency}`;
}
