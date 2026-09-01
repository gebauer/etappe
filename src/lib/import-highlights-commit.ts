/**
 * Commits a parsed Highlights document (WORK 8.1) into the wishlist: one
 * `pois` row per highlight (same shape as any hand-added wishlist item)
 * plus its note/link/photo blocks. Coordinates are geocoded
 * from `place_hint` via Photon when the highlight didn't include lat/lon —
 * mirrors BUILD §8's "place_hint... geocoded on import" for the full trip
 * wizard, at the flat-list scale Highlights needs.
 */

import type { TypedPocketBase } from '../types/pb';
import type { Highlight, HighlightsDoc } from './import-highlights';
import { addWishlistItem } from './pb-pois';
import { photonSearch } from './photon';
import { fetchPhotoFile } from './pb-photo-fetch';

export interface HighlightImportResult {
  title: string;
  poiId: string;
  geocoded: boolean;
  geocodeFailed: boolean;
  /** Photos whose bytes the server couldn't pull down (dead link, hotlink
   * protection, not an image). They keep their URL, so they still display —
   * they just can't become a map-pin thumbnail. */
  photosFailed: number;
}

async function resolveCoords(h: Highlight): Promise<{
  lat?: number;
  lon?: number;
  geocoded: boolean;
  geocodeFailed: boolean;
}> {
  if (h.lat !== undefined && h.lon !== undefined) {
    return { lat: h.lat, lon: h.lon, geocoded: false, geocodeFailed: false };
  }
  if (!h.place_hint) {
    return { geocoded: false, geocodeFailed: false };
  }
  try {
    const [match] = await photonSearch(h.place_hint, { limit: 1 });
    if (!match) return { geocoded: false, geocodeFailed: true };
    return {
      lat: match.lat,
      lon: match.lon,
      geocoded: true,
      geocodeFailed: false,
    };
  } catch {
    return { geocoded: false, geocodeFailed: true };
  }
}

async function createHighlightBlocks(
  pb: TypedPocketBase,
  tripId: string,
  poiId: string,
  creatorId: string,
  h: Highlight,
): Promise<string[]> {
  const base = {
    trip: tripId,
    parent_type: 'poi' as const,
    parent_id: poiId,
    visibility: 'trip' as const,
    creator: creatorId,
  };
  if (h.description) {
    await pb.collection('blocks').create({
      ...base,
      kind: 'note',
      title: 'Description',
      body: h.description,
    });
  }
  // `notes` (personal, "why it's on the list") is a separate field from
  // `description` (about the place) — its own note block, not merged in.
  // WORK 14: pois have no notes field of their own any more, blocks only.
  if (h.notes) {
    await pb.collection('blocks').create({
      ...base,
      kind: 'note',
      title: 'Notes',
      body: h.notes,
    });
  }
  for (const link of h.links) {
    await pb.collection('blocks').create({
      ...base,
      kind: 'link',
      title: link.title ?? '',
      url: link.url,
    });
  }
  const photoBlockIds: string[] = [];
  for (const photo of h.photos) {
    const created = await pb.collection('blocks').create({
      ...base,
      kind: 'photo',
      title: photo.title ?? '',
      url: photo.url,
      attribution_author: photo.author ?? '',
      attribution_licence: photo.licence ?? '',
      attribution_url: photo.source_url ?? '',
    });
    photoBlockIds.push(created.id);
  }
  return photoBlockIds;
}

/** Imports every highlight in `doc` as a wishlist idea, sequentially (so a
 * slow/rate-limited geocode of one doesn't race the next). Never touches the
 * trip's days/stops/legs — Highlights only ever land in the wishlist; moving
 * one onto the itinerary is the existing promote-to-stop flow. */
export async function importHighlights(
  pb: TypedPocketBase,
  tripId: string,
  doc: HighlightsDoc,
  onProgress?: (done: number, total: number, title: string) => void,
): Promise<HighlightImportResult[]> {
  const user = pb.authStore.record;
  if (!user) throw new Error('Not signed in.');

  const results: HighlightImportResult[] = [];
  for (const h of doc.highlights) {
    onProgress?.(results.length, doc.highlights.length, h.title);
    const coords = await resolveCoords(h);
    const poiId = await addWishlistItem(pb, tripId, {
      title: h.title,
      kind: h.kind,
      lat: coords.lat,
      lon: coords.lon,
    });
    const photoBlockIds = await createHighlightBlocks(
      pb,
      tripId,
      poiId,
      user.id,
      h,
    );
    // Pull each photo onto the server (WORK 12.8). A highlight's photos are
    // third-party URLs; storing the bytes is what makes map-pin thumbnails
    // possible at all, and stops the trip depending on someone else's
    // webserver. Failures are reported, never thrown — one dead link
    // shouldn't fail an import of thirty.
    let photosFailed = 0;
    for (const blockId of photoBlockIds) {
      const outcome = await fetchPhotoFile(pb, blockId);
      if (!outcome.fetched && outcome.reason) photosFailed += 1;
    }
    results.push({
      title: h.title,
      poiId,
      geocoded: coords.geocoded,
      geocodeFailed: coords.geocodeFailed,
      photosFailed,
    });
  }
  return results;
}
