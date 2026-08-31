/**
 * Commits a parsed Highlights document (WORK 8.1) into the wishlist: one
 * `pois` row per highlight (status "idea", same shape as any hand-added
 * wishlist item) plus its note/link/photo blocks. Coordinates are geocoded
 * from `place_hint` via Photon when the highlight didn't include lat/lon —
 * mirrors BUILD §8's "place_hint... geocoded on import" for the full trip
 * wizard, at the flat-list scale Highlights needs.
 */

import type { TypedPocketBase } from '../types/pb';
import type { Highlight, HighlightsDoc } from './import-highlights';
import { addWishlistItem } from './pb-pois';
import { photonSearch } from './photon';

export interface HighlightImportResult {
  title: string;
  poiId: string;
  geocoded: boolean;
  geocodeFailed: boolean;
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
): Promise<void> {
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
  for (const link of h.links) {
    await pb.collection('blocks').create({
      ...base,
      kind: 'link',
      title: link.title ?? '',
      url: link.url,
    });
  }
  for (const photo of h.photos) {
    await pb.collection('blocks').create({
      ...base,
      kind: 'photo',
      title: photo.title ?? '',
      url: photo.url,
      attribution_author: photo.author ?? '',
      attribution_licence: photo.licence ?? '',
      attribution_url: photo.source_url ?? '',
    });
  }
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
      notes: h.notes,
    });
    await createHighlightBlocks(pb, tripId, poiId, user.id, h);
    results.push({
      title: h.title,
      poiId,
      geocoded: coords.geocoded,
      geocodeFailed: coords.geocodeFailed,
    });
  }
  return results;
}
