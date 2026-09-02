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
import {
  planFor,
  type DuplicateDecision,
  type ExistingPlace,
} from './import-dedupe';
import type { BlocksResponse } from '../types/pb';
import { photonSearch } from './photon';
import { fetchPhotoFile } from './pb-photo-fetch';

/** What the importer was told to do with a highlight that already exists. */
export interface HighlightDecision {
  decision: DuplicateDecision;
  existing: ExistingPlace;
  /** The blocks already on that record, so nothing is duplicated. */
  existingBlocks: BlocksResponse[];
}

export interface HighlightImportResult {
  title: string;
  poiId: string;
  /** Created fresh, or folded into a record that was already there. */
  outcome: 'created' | 'merged' | 'replaced';
  /** Did it end up with coordinates at all? Wider than `!geocodeFailed`: a
   * highlight with neither lat/lon nor a `place_hint` never attempts a
   * geocode, so it fails nothing and still lands on no map. Without
   * coordinates an idea can't be ranked into a gap, so it can't reach the
   * itinerary until someone places it by hand. */
  located: boolean;
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
  parentId: string,
  creatorId: string,
  h: Highlight,
  parentKind: 'poi' | 'stop' = 'poi',
  /** Note bodies to write instead of the highlight's own — the merge path
   * has already dropped the ones the record carries. */
  noteBodies?: string[],
): Promise<string[]> {
  const base = {
    trip: tripId,
    parent_type: parentKind,
    parent_id: parentId,
    visibility: 'trip' as const,
    creator: creatorId,
  };
  if (noteBodies) {
    for (const body of noteBodies) {
      await pb.collection('blocks').create({ ...base, kind: 'note', body });
    }
  } else {
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
  /** Per-highlight instructions for the ones that already exist (WORK 16.4),
   * keyed by index into `doc.highlights`. Anything absent is created. */
  decisions?: Map<number, HighlightDecision>,
): Promise<HighlightImportResult[]> {
  const user = pb.authStore.record;
  if (!user) throw new Error('Not signed in.');

  const results: HighlightImportResult[] = [];
  for (const [index, h] of doc.highlights.entries()) {
    // `index`, not `results.length` — a skipped highlight advances the loop
    // without adding a result, and progress must still reach 100%.
    onProgress?.(index, doc.highlights.length, h.title);

    const instruction = decisions?.get(index);
    if (instruction?.decision === 'skip') {
      // Not imported at all — the existing record is untouched, and this
      // highlight leaves no trace (no poi, no blocks, not even a result
      // row saying "created": there is nothing to report on).
      continue;
    }
    if (instruction && instruction.decision !== 'add') {
      // Folding into a record that is already here: write only the fields
      // the plan allows, then append the blocks it doesn't already carry.
      const { existing, existingBlocks, decision } = instruction;
      const plan = planFor(decision, existing, existingBlocks, h);
      if (Object.keys(plan.fields).length > 0) {
        await pb
          .collection(existing.kind === 'stop' ? 'stops' : 'pois')
          .update(existing.id, plan.fields);
      }
      const photoBlockIds = await createHighlightBlocks(
        pb,
        tripId,
        existing.id,
        user.id,
        {
          ...h,
          description: undefined,
          notes: undefined,
          links: plan.blocks.links,
          photos: plan.blocks.photos,
        },
        existing.kind,
        plan.blocks.notes,
      );
      let merged = 0;
      for (const blockId of photoBlockIds) {
        const outcome = await fetchPhotoFile(pb, blockId);
        if (!outcome.fetched && outcome.reason) merged += 1;
      }
      results.push({
        title: h.title,
        poiId: existing.id,
        outcome: decision === 'replace' ? 'replaced' : 'merged',
        located: true,
        geocoded: false,
        geocodeFailed: false,
        photosFailed: merged,
      });
      continue;
    }

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
      outcome: 'created',
      located: coords.lat !== undefined && coords.lon !== undefined,
      geocoded: coords.geocoded,
      geocodeFailed: coords.geocodeFailed,
      photosFailed,
    });
  }
  return results;
}
