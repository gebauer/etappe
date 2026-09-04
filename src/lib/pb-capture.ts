/**
 * Capture helpers: resolve a short link server-side (WORK 6.2, CORS-blocked
 * in the browser) and attach extra blocks to a freshly-created stop or
 * wishlist idea — a pasted URL as a link block, free text as a note block
 * (WORK 14: pois carry these as blocks now, same as stops, not scalar
 * `url`/`notes` fields), or (WORK 7.2) a Wikimedia Commons photo when the
 * capture carried a wikidata id (Nearby/Overpass is the source of these
 * today — see wikimedia.ts's doc comment on why not Photon).
 */

import type { TypedPocketBase } from '../types/pb';
import { lookupWikimediaPhoto } from './wikimedia';

/** Either kind of place a capture block can attach to. */
export interface BlockParent {
  type: 'stop' | 'poi';
  id: string;
}

export async function resolveLink(
  pb: TypedPocketBase,
  url: string,
): Promise<{ lat: number | null; lon: number | null }> {
  return pb.send('/api/resolve-link', { method: 'POST', body: { url } });
}

export async function addLinkBlock(
  pb: TypedPocketBase,
  tripId: string,
  parent: BlockParent,
  url: string,
  title = '',
): Promise<void> {
  const user = pb.authStore.record;
  if (!user) return;
  await pb.collection('blocks').create({
    trip: tripId,
    parent_type: parent.type,
    parent_id: parent.id,
    kind: 'link',
    visibility: 'trip',
    url,
    title,
    creator: user.id,
  });
}

/** Looks up a Wikidata id's Commons image and, if it has one, adds it as an
 * attributed photo block on the new stop (BUILD §2's attribution_author/
 * attribution_licence/attribution_url). Silent no-op on any lookup miss —
 * "no cover photo" is the ordinary outcome, not an error to surface. Returns
 * whether a block was created, for callers that want to know. */
export async function createWikimediaPhotoBlock(
  pb: TypedPocketBase,
  tripId: string,
  stopId: string,
  wikidataId: string,
): Promise<boolean> {
  const user = pb.authStore.record;
  if (!user) return false;
  const photo = await lookupWikimediaPhoto(wikidataId);
  if (!photo) return false;
  await pb.collection('blocks').create({
    trip: tripId,
    parent_type: 'stop',
    parent_id: stopId,
    kind: 'photo',
    visibility: 'trip',
    url: photo.url,
    attribution_author: photo.author,
    attribution_licence: photo.licence,
    attribution_url: photo.sourceUrl,
    creator: user.id,
  });
  return true;
}
