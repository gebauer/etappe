/**
 * Duplicate detection for the wishlist import (WORK 16.4).
 *
 * Importing an overlapping list twice used to double every entry silently.
 * The same place arriving a second time is the normal case, not an error —
 * research gets re-run, and someone else's list overlaps yours — so the
 * import preview flags it and asks what to do with each one.
 *
 * Since WORK 14 a poi is "a stop without a day", so a candidate is matched
 * against **both** the wishlist and the itinerary: an idea you already
 * placed on day three is still the same place.
 *
 * The merge rule is the author's (2026-09-01): a scalar field is written
 * only where the existing record is empty and never overwritten, while
 * notes, links and photos **accumulate**, deduplicated on an exact match.
 * A second list of the same place adds what it knows and loses nothing.
 *
 * Pure — matching and planning only. Writing is the importer's job.
 */

import { haversineMeters } from './geo';
import type { Highlight } from './import-highlights';
import type { BlocksResponse } from '../types/pb';

/** Same radius as the capture-time merge prompt (WORK 6.5, BUILD §6). */
export const DUPLICATE_RADIUS_M = 100;

export type DuplicateDecision = 'merge' | 'replace' | 'add';

/** An existing poi or stop, flattened to what matching needs. */
export interface ExistingPlace {
  id: string;
  kind: 'poi' | 'stop';
  title: string;
  placeKind?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** Where it sits, for the preview text: "on day 3", "on the wishlist". */
  where: string;
}

export interface DuplicateMatch {
  existing: ExistingPlace;
  /** Why it matched, for the preview to say so plainly. */
  reason: 'distance' | 'title';
  distanceM?: number;
}

/**
 * PocketBase gives an unset number field back as `0`, not null, so a record
 * that has never been located reads as latitude 0 — a real place in the Gulf
 * of Guinea. The rest of the app already treats `0` as "unset" for
 * coordinates (`buildCascadeTrip` does `s.lat || null`); matching has to do
 * the same or an unlocated idea silently compares as thousands of km away.
 */
function coord(value: number | null | undefined): number | null {
  return value ? value : null;
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The best existing match for an incoming highlight, or null.
 *
 * Distance wins over title: two places can share a name across the country,
 * but a hundred metres apart is the same car park. A title match alone is
 * only trusted when at least one side has no coordinates to compare — an
 * import without coordinates is exactly the case that needs it.
 */
export function findDuplicate(
  candidate: Pick<Highlight, 'title' | 'lat' | 'lon'>,
  existing: ExistingPlace[],
  radiusM = DUPLICATE_RADIUS_M,
): DuplicateMatch | null {
  const wanted = normaliseTitle(candidate.title);
  let nearest: DuplicateMatch | null = null;

  const candLat = coord(candidate.lat);
  const candLon = coord(candidate.lon);

  for (const place of existing) {
    const placeLat = coord(place.lat);
    const placeLon = coord(place.lon);
    if (
      candLat != null &&
      candLon != null &&
      placeLat != null &&
      placeLon != null
    ) {
      const d = haversineMeters(
        { lat: candLat, lon: candLon },
        { lat: placeLat, lon: placeLon },
      );
      if (d <= radiusM && (!nearest || d < (nearest.distanceM ?? Infinity))) {
        nearest = { existing: place, reason: 'distance', distanceM: d };
      }
    }
  }
  if (nearest) return nearest;

  for (const place of existing) {
    if (normaliseTitle(place.title) !== wanted) continue;
    const bothLocated =
      candLat != null && candLon != null && coord(place.lat) != null;
    // Same name, but both know where they are and it isn't here: a different
    // place that happens to share a name.
    if (bothLocated) continue;
    return { existing: place, reason: 'title' };
  }
  return null;
}

/** Fields to write onto an existing record. */
export interface FieldPatch {
  title?: string;
  kind?: string;
  lat?: number;
  lon?: number;
}

/** Blocks the incoming highlight brings that the existing record lacks. */
export interface BlockPlan {
  notes: string[];
  links: Highlight['links'];
  photos: Highlight['photos'];
}

export interface MergePlan {
  fields: FieldPatch;
  blocks: BlockPlan;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Merge: fill only what's missing, add only what's new.
 *
 * `existingBlocks` are the blocks already on the record, so an incoming note
 * whose text is already there, or a link to a URL already saved, is dropped
 * rather than duplicated.
 */
export function planMerge(
  existing: ExistingPlace,
  existingBlocks: BlocksResponse[],
  incoming: Highlight,
): MergePlan {
  const fields: FieldPatch = {};
  if (isBlank(existing.title) && incoming.title) fields.title = incoming.title;
  // "uncategorized" is the taxonomy's own empty — a real kind is an upgrade,
  // but never the other way round.
  if (
    (isBlank(existing.placeKind) || existing.placeKind === 'uncategorized') &&
    incoming.kind &&
    incoming.kind !== 'uncategorized'
  ) {
    fields.kind = incoming.kind;
  }
  if (coord(existing.lat) == null && incoming.lat != null) {
    fields.lat = incoming.lat;
  }
  if (coord(existing.lon) == null && incoming.lon != null) {
    fields.lon = incoming.lon;
  }

  const haveNotes = new Set(
    existingBlocks
      .filter((b) => b.kind === 'note' && b.body)
      .map((b) => b.body!.trim()),
  );
  const haveUrls = new Set(
    existingBlocks.filter((b) => b.url).map((b) => b.url!.trim()),
  );

  const notes = [incoming.description, incoming.notes]
    .map((n) => n?.trim())
    .filter((n): n is string => !!n && !haveNotes.has(n));
  const links = incoming.links.filter((l) => !haveUrls.has(l.url.trim()));
  const photos = incoming.photos.filter((p) => !haveUrls.has(p.url.trim()));

  return { fields, blocks: { notes, links, photos } };
}

/**
 * Replace: the incoming version wins on every field it has, but the record
 * keeps its id — so a placement, a star or a day assignment survives being
 * overwritten. Blocks still accumulate; replacing the text is not a reason
 * to throw away photos.
 */
export function planReplace(
  existing: ExistingPlace,
  existingBlocks: BlocksResponse[],
  incoming: Highlight,
): MergePlan {
  const merged = planMerge(existing, existingBlocks, incoming);
  const fields: FieldPatch = { ...merged.fields, title: incoming.title };
  if (incoming.kind) fields.kind = incoming.kind;
  if (incoming.lat != null) fields.lat = incoming.lat;
  if (incoming.lon != null) fields.lon = incoming.lon;
  return { fields, blocks: merged.blocks };
}

export function planFor(
  decision: Exclude<DuplicateDecision, 'add'>,
  existing: ExistingPlace,
  existingBlocks: BlocksResponse[],
  incoming: Highlight,
): MergePlan {
  return decision === 'replace'
    ? planReplace(existing, existingBlocks, incoming)
    : planMerge(existing, existingBlocks, incoming);
}
