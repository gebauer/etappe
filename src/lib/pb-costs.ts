/**
 * Cost CRUD (WORK 16.7). One row per price, hung off a stop, a day, a leg
 * or the trip. Currency is the trip's — no per-cost currency and no
 * conversion, which is out of scope for v1.
 *
 * Members-only by rule: the share payload never reads this collection.
 *
 * **Intentionally unused right now** (audit, 2026-09-04): WORK 16.10 replaced
 * the list-of-costs UI with one estimated cost per stop, but kept the
 * multi-item backend shape. These four are the door back to a real
 * breakdown — keep them; nothing calling them is not a bug.
 */

import type { CostsResponse, TypedPocketBase } from '../types/pb';

export interface NewCost {
  label: string;
  amount: number;
  category?: string;
  is_estimate?: boolean;
}

export async function listCosts(
  pb: TypedPocketBase,
  tripId: string,
): Promise<CostsResponse[]> {
  return pb.collection('costs').getFullList({
    filter: pb.filter('trip = {:t}', { t: tripId }),
    requestKey: null,
  });
}

export async function addCost(
  pb: TypedPocketBase,
  tripId: string,
  parent: { type: 'trip' | 'day' | 'stop' | 'leg' | 'poi'; id: string },
  cost: NewCost,
  currency: string,
): Promise<void> {
  await pb.collection('costs').create({
    trip: tripId,
    parent_type: parent.type,
    parent_id: parent.id,
    label: cost.label,
    amount: cost.amount,
    currency,
    category: cost.category ?? '',
    is_estimate: cost.is_estimate ?? false,
  });
}

export async function updateCost(
  pb: TypedPocketBase,
  costId: string,
  patch: Partial<NewCost>,
): Promise<void> {
  await pb.collection('costs').update(costId, patch);
}

export async function deleteCost(
  pb: TypedPocketBase,
  costId: string,
): Promise<void> {
  await pb.collection('costs').delete(costId);
}

/**
 * Write-through for the simplified single-cost field (WORK 16.10): create,
 * update or delete the *one* row the card's `CostField` edits, identified by
 * `existingId` (the first cost row already on this parent, or null). A
 * blank/zero amount deletes it rather than writing a meaningless 0 — the
 * card's own "+ add a price" affordance is how a cleared field comes back.
 */
export async function setSingleCost(
  pb: TypedPocketBase,
  tripId: string,
  parent: { type: 'trip' | 'day' | 'stop' | 'leg' | 'poi'; id: string },
  existingId: string | null,
  amount: number | null,
  currency: string,
): Promise<void> {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    if (existingId) await pb.collection('costs').delete(existingId);
    return;
  }
  if (existingId) {
    await pb.collection('costs').update(existingId, { amount, currency });
    return;
  }
  await pb.collection('costs').create({
    trip: tripId,
    parent_type: parent.type,
    parent_id: parent.id,
    label: '',
    amount,
    currency,
    is_estimate: true,
  });
}
