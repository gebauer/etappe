/**
 * Writes a trip back out in the import format (WORK 16.3, BUILD §8).
 *
 * Phase 8.1 promised "Export writes the same format — round-trip test" and
 * never built the export half. This is it, plus the versioning discipline
 * the format needs if the model is ever going to change:
 *
 * - An exported document always carries the **current** version.
 * - Import keeps a parser per version (`parseTripDoc`), and upgrades an
 *   older document forward at the boundary. A retired version's parser is
 *   never deleted — it is the only thing that keeps a two-year-old export
 *   openable.
 *
 * JSON only. Uploaded files — photos, booking PDFs — are deliberately left
 * behind rather than inlined as base64 or referenced by a URL that stops
 * resolving the moment the instance moves; the export says so in
 * `omitted_files` so the reader knows what is missing rather than assuming
 * the trip never had any.
 *
 * Pure: takes records, returns a document. No PocketBase, no network.
 */

import type {
  ActivitiesResponse,
  BlocksResponse,
  DaysResponse,
  LegsResponse,
  PoisResponse,
  StopsResponse,
  TripsResponse,
} from '../types/pb';
import type {
  ImportDoc,
  ImportDay,
  ImportStop,
  ImportLeg,
  ImportActivity,
  ImportLink,
} from './import-cascade';
import type { HighlightsDoc, Highlight } from './import-highlights';

/** The version every export is written at. Bump when the shape changes, and
 * add a parser for the old one rather than editing the existing parser. */
export const CURRENT_TRIP_VERSION = 1;

export interface ExportableRecords {
  trip: TripsResponse;
  days: DaysResponse[];
  stops: StopsResponse[];
  legs: LegsResponse[];
  activities: ActivitiesResponse[];
  blocks: BlocksResponse[];
}

/** An exported document plus what it had to leave behind. */
export interface TripExport extends ImportDoc {
  /** Count of file-bearing blocks the JSON couldn't carry. Absent when none. */
  omitted_files?: number;
}

function byOrder<T extends { order_index: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.order_index - b.order_index);
}

function blocksOf(
  blocks: BlocksResponse[],
  parentType: string,
  parentId: string,
): BlocksResponse[] {
  return byOrder(
    blocks.filter(
      (b) => b.parent_type === parentType && b.parent_id === parentId,
    ),
  );
}

function linksFrom(blocks: BlocksResponse[]): ImportLink[] {
  return blocks
    .filter((b) => b.kind === 'link' && b.url)
    .map((b) => ({
      url: b.url!,
      ...(b.title ? { title: b.title } : {}),
      ...(b.visibility ? { visibility: b.visibility } : {}),
    }));
}

/** Note blocks joined into the format's single `notes` string. Keeping each
 * block separate would need a shape the import format doesn't have. */
function notesFrom(blocks: BlocksResponse[]): string | undefined {
  const text = blocks
    .filter((b) => b.kind === 'note' && b.body?.trim())
    .map((b) => b.body!.trim())
    .join('\n\n');
  return text || undefined;
}

function exportStop(
  stop: StopsResponse,
  activities: ActivitiesResponse[],
  blocks: BlocksResponse[],
): ImportStop {
  const own = blocksOf(blocks, 'stop', stop.id);
  const acts: ImportActivity[] = byOrder(
    activities.filter((a) => a.stop === stop.id),
  ).map((a) => ({
    title: a.title,
    duration_min: a.duration_min,
    ...(a.kind ? { kind: a.kind } : {}),
  }));
  const links = linksFrom(own);
  const notes = notesFrom(own);
  return {
    title: stop.title,
    kind: stop.kind,
    ...(stop.lat ? { lat: stop.lat } : {}),
    ...(stop.lon ? { lon: stop.lon } : {}),
    ...(stop.is_accommodation ? { is_accommodation: true } : {}),
    ...(stop.routing_kind === 'waypoint'
      ? { routing_kind: 'waypoint' as const }
      : {}),
    ...(stop.anchor_time?.trim() ? { anchor_time: stop.anchor_time } : {}),
    ...(stop.anchor_time?.trim() && stop.anchor_type
      ? { anchor_type: stop.anchor_type }
      : {}),
    ...(stop.dwell_override ? { dwell_min: stop.dwell_override } : {}),
    ...(notes ? { notes } : {}),
    ...(acts.length ? { activities: acts } : {}),
    ...(links.length ? { links } : {}),
  };
}

/**
 * The whole trip: days, stops, legs, activities and the text blocks that
 * belong to them. Leg *durations* are not written — they come from routing,
 * which is the same reason the import format has never carried them.
 */
export function exportTrip(records: ExportableRecords): TripExport {
  const { trip, stops, legs, activities, blocks } = records;
  const legByPair = new Map(
    legs.map((l) => [`${l.from_stop}->${l.to_stop}`, l]),
  );

  const days: ImportDay[] = byOrder(records.days).map((day, dayIndex) => {
    const dayStops = byOrder(stops.filter((s) => s.day === day.id));
    const exportedLegs: ImportLeg[] = [];
    for (let i = 0; i < dayStops.length - 1; i++) {
      const leg = legByPair.get(`${dayStops[i]!.id}->${dayStops[i + 1]!.id}`);
      if (!leg) continue;
      exportedLegs.push({
        from: i,
        to: i + 1,
        mode: leg.mode,
        ...(leg.surface ? { surface: leg.surface } : {}),
      });
    }
    return {
      index: dayIndex + 1,
      title: day.title ?? '',
      kind: day.kind,
      stops: dayStops.map((s) => exportStop(s, activities, blocks)),
      legs: exportedLegs,
    };
  });

  const omitted = blocks.filter((b) => !!b.file).length;
  return {
    version: CURRENT_TRIP_VERSION,
    title: trip.title,
    // The format's dates are plain days; PocketBase stores a timestamp.
    start_date: trip.start_date.slice(0, 10),
    timezone: trip.timezone,
    days,
    ...(omitted ? { omitted_files: omitted } : {}),
  };
}

/**
 * The wishlist on its own, in the Highlights format the importer already
 * reads — so an exported wishlist can be handed to someone else and pasted
 * straight back in. This is the half people actually pass around.
 */
export function exportWishlist(
  pois: PoisResponse[],
  blocks: BlocksResponse[],
): HighlightsDoc {
  const highlights: Highlight[] = pois.map((poi) => {
    const own = blocksOf(blocks, 'poi', poi.id);
    const photos = own
      .filter((b) => b.kind === 'photo' && b.url)
      .map((b) => ({
        url: b.url!,
        ...(b.title ? { title: b.title } : {}),
        ...(b.attribution_author ? { author: b.attribution_author } : {}),
        ...(b.attribution_licence ? { licence: b.attribution_licence } : {}),
        ...(b.attribution_url ? { source_url: b.attribution_url } : {}),
      }));
    const description = notesFrom(own);
    return {
      title: poi.title,
      kind: poi.kind ?? 'uncategorized',
      ...(poi.lat ? { lat: poi.lat } : {}),
      ...(poi.lon ? { lon: poi.lon } : {}),
      ...(description ? { description } : {}),
      links: linksFrom(own),
      photos,
    } as Highlight;
  });
  return { version: 1, highlights };
}

/** A filename that sorts by trip and says what it is. */
export function exportFilename(
  title: string,
  what: 'trip' | 'wishlist',
): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'trip';
  return `${slug}-${what}.json`;
}
