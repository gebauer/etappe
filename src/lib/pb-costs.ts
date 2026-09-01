/**
 * Cost CRUD (WORK 16.7). One row per price, hung off a stop, a day, a leg
 * or the trip. Currency is the trip's — no per-cost currency and no
 * conversion, which is out of scope for v1.
 *
 * Members-only by rule: the share payload never reads this collection.
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
