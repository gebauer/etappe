/**
 * Wishlist CRUD (WORK 6.4, BUILD §2/§6; unified with stops in WORK 14): a
 * `pois` record is "a stop without a day" — a trip-level idea with no day/
 * order_index, otherwise sharing title/kind/lat/lon/address/access point/star
 * and the whole block system. There's no `status` any more: a poi is always
 * a live idea. Promotion to a stop (`pb-promote.ts`) re-parents its blocks
 * and deletes the poi outright rather than leaving a tombstone behind.
 */

import type { TypedPocketBase, PoisResponse } from '../types/pb';

export interface NewWishlistItem {
  title: string;
  kind?: string;
  lat?: number;
  lon?: number;
  address?: string;
  access_lat?: number;
  access_lon?: number;
}

/** The whole wishlist for a trip. */
export async function listWishlist(
  pb: TypedPocketBase,
  tripId: string,
): Promise<PoisResponse[]> {
  return pb.collection('pois').getFullList({
    filter: pb.filter('trip = {:trip}', { trip: tripId }),
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
    address: data.address ?? '',
    access_lat: data.access_lat ?? 0,
    access_lon: data.access_lon ?? 0,
  });
  return created.id;
}

export async function deleteWishlistItem(
  pb: TypedPocketBase,
  poiId: string,
): Promise<void> {
  await pb.collection('pois').delete(poiId);
}

/** Toggles a wishlist idea's `★ Top choices` flag (WORK 12.10). Persistent,
 * not UI state — the gold star badge on the map pin and the carousel filter
 * both read it, and it must survive a reload. */
export async function setPoiStarred(
  pb: TypedPocketBase,
  poiId: string,
  starred: boolean,
): Promise<void> {
  await pb.collection('pois').update(poiId, { starred });
}
