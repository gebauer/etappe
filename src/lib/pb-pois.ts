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
  // Contributor attribution (WORK 15): every wishlist-create path funnels
  // through here, so this is the one place the creator is stamped. The
  // name and colour are snapshotted from the current account rather than
  // resolved from `users` at render time — see the migration's note.
  const me = pb.authStore.record as {
    id: string;
    name?: string;
    email?: string;
    color?: string;
  } | null;
  const created = await pb.collection('pois').create({
    trip: tripId,
    title: data.title,
    kind: data.kind ?? 'uncategorized',
    lat: data.lat ?? 0,
    lon: data.lon ?? 0,
    address: data.address ?? '',
    access_lat: data.access_lat ?? 0,
    access_lon: data.access_lon ?? 0,
    creator: me?.id ?? undefined,
    creator_name: contributorName(me),
    creator_color: me?.color ?? '',
  });
  return created.id;
}

/** A short display name for the contributor mark: the account's `name` if
 * it set one, else the local part of its email, else nothing. */
function contributorName(
  record: { name?: string; email?: string } | null,
): string {
  const name = record?.name?.trim();
  if (name) return name;
  const email = record?.email ?? '';
  return email.includes('@') ? email.slice(0, email.indexOf('@')) : email;
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

/**
 * Gives a wishlist idea coordinates it never had.
 *
 * The Highlights importer geocodes `place_hint` (WORK 8.1) and keeps the
 * idea even when that comes back empty — a hotel with a description, a
 * booking link and no dot on the map is still worth having. But a
 * coordinate-less idea can't be ranked into a gap, so it can never reach
 * the itinerary until someone says where it is. This is that repair.
 */
export async function setPoiLocation(
  pb: TypedPocketBase,
  poiId: string,
  lat: number,
  lon: number,
): Promise<void> {
  await pb.collection('pois').update(poiId, { lat, lon });
}

/** Field updates for a wishlist idea — the poi half of `updateStop`, needed
 * now that the card edits an idea the same way it edits a stop (WORK 16.5). */
export async function updatePoi(
  pb: TypedPocketBase,
  poiId: string,
  patch: {
    title?: string;
    kind?: string;
    lat?: number;
    lon?: number;
    access_lat?: number;
    access_lon?: number;
    address?: string;
  },
): Promise<void> {
  await pb.collection('pois').update(poiId, patch);
}
