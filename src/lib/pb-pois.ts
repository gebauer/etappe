/**
 * Wishlist CRUD and promotion (WORK 6.4, BUILD §2/§6): a `pois` record is
 * "captured without a slot" — a trip-level idea with no day/order_index.
 * Promotion doesn't get its own bespoke insert path: it reuses the phase 6.3
 * placement flow (PlacementPicker + addStopAt) exactly like any other
 * capture, then marks the source poi `scheduled` rather than deleting it, so
 * the wishlist keeps a history instead of silently losing the idea.
 */

import type { TypedPocketBase, PoisResponse } from '../types/pb';

export interface NewWishlistItem {
  title: string;
  kind?: string;
  lat?: number;
  lon?: number;
  notes?: string;
  url?: string;
}

/** Active wishlist for a trip — ideas only; scheduled/rejected are history,
 * not shown in the default list. */
export async function listWishlist(
  pb: TypedPocketBase,
  tripId: string,
): Promise<PoisResponse[]> {
  return pb.collection('pois').getFullList({
    filter: pb.filter('trip = {:trip} && status = "idea"', { trip: tripId }),
    sort: '-created',
  });
}

export async function addWishlistItem(
  pb: TypedPocketBase,
  tripId: string,
  data: NewWishlistItem,
): Promise<string> {
  const created = await pb.collection('pois').create({
    trip: tripId,
    title: data.title,
    kind: data.kind ?? 'uncategorized',
    lat: data.lat ?? 0,
    lon: data.lon ?? 0,
    notes: data.notes ?? '',
    url: data.url ?? '',
    status: 'idea',
  });
  return created.id;
}

/** Dismiss a wishlist idea without deleting it (status: rejected, per the
 * BUILD §2 enum) — an accidental reject is a one-field undo, not a re-add. */
export async function rejectWishlistItem(
  pb: TypedPocketBase,
  poiId: string,
): Promise<void> {
  await pb.collection('pois').update(poiId, { status: 'rejected' });
}

export async function deleteWishlistItem(
  pb: TypedPocketBase,
  poiId: string,
): Promise<void> {
  await pb.collection('pois').delete(poiId);
}

/** Marks a wishlist item as placed once its promotion (addStopAt) commits. */
export async function markWishlistScheduled(
  pb: TypedPocketBase,
  poiId: string,
): Promise<void> {
  await pb.collection('pois').update(poiId, { status: 'scheduled' });
}
