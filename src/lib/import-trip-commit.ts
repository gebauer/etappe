/**
 * Commits a parsed trip document (BUILD §8, WORK 8.2) as a brand-new trip:
 * the days/stops/legs/activities/notes/links it describes, created for
 * real. This is the counterpart to `exportTrip` (WORK 16.3) — export and
 * import share the same `ImportDoc` shape, and `parseTripDoc` already
 * carries the versioning discipline (a parser per version, dispatched on
 * `doc.version`) that lets an old export stay openable after the format
 * moves on.
 *
 * Sequential, not a single atomic batch: legs need the *created* stop ids
 * of the day they connect, which a single PocketBase batch call can't
 * reference before it resolves. `importHighlights` (WORK 8.1) already
 * chose the same trade — sequential creates, slower but simple — for the
 * same reason; this follows it rather than reaching for batch
 * cross-referencing for the first time here. What atomicity this can offer
 * cheaply: the trip is created first and nothing else references anything
 * outside it, so a failure partway through can be undone by deleting the
 * trip record — every child cascade-deletes with it (`cascade: true` on
 * every `trip` relation, migration `1788000000`) — rather than leaving a
 * half-built trip behind. The caller decides whether to do that; this
 * module only reports what got created versus where it stopped.
 *
 * Not built here — the same "geocode with map confirmation and ambiguity
 * flags" that was never built for Highlights either (WORK 8.1's note):
 * this resolves a `place_hint` to Photon's first match silently, the same
 * simplification, for the same reason (see `resolvePlaceHint`).
 */

import { resolvePlaceHint } from './geocode';
import { createTrip } from './pb-trips';
import { buildLegRecord } from './pb-legs';
import { isKind } from './taxonomy';
import type { ImportDoc } from './import-cascade';
import type { LatLon, RoutingProvider } from './routing';
import type { TypedPocketBase, TripsResponse } from '../types/pb';

export interface TripImportProgress {
  phase: 'day' | 'stop' | 'leg';
  dayIndex: number;
  totalDays: number;
  label: string;
}

export interface UnlocatedStop {
  title: string;
  dayIndex: number; // 0-based
}

export interface TripImportResult {
  trip: TripsResponse;
  daysCreated: number;
  stopsCreated: number;
  legsRouted: number;
  legsManual: number;
  /** Imported with neither coordinates nor a resolvable `place_hint` — the
   * trip is still fully created, but these need a Latitude/Longitude set
   * by hand (All details already has that field) before they mean much on
   * the map or in routing. */
  unlocatedStops: UnlocatedStop[];
}

/**
 * `startDate` is an explicit argument rather than read off the document
 * (WORK 18.7): a trip document carries day *numbers*, not dates, so the
 * date is the importer's question to ask — the document's own
 * `start_date`, when it has one, is only the preset.
 */
export async function commitTripImport(
  pb: TypedPocketBase,
  routing: RoutingProvider,
  doc: ImportDoc,
  startDate: string,
  onProgress?: (progress: TripImportProgress) => void,
): Promise<TripImportResult> {
  const trip = await createTrip({
    title: doc.title,
    start_date: startDate,
    timezone: doc.timezone,
  });

  let stopsCreated = 0;
  let legsRouted = 0;
  let legsManual = 0;
  const unlocatedStops: UnlocatedStop[] = [];
  const totalDays = doc.days.length;

  for (const day of doc.days) {
    const dayIndex = day.index - 1;
    onProgress?.({
      phase: 'day',
      dayIndex,
      totalDays,
      label: day.title || `Day ${day.index}`,
    });

    const dayRecord = await pb.collection('days').create({
      trip: trip.id,
      order_index: dayIndex,
      kind: day.kind,
      title: day.title ?? '',
    });

    const stopIds: string[] = [];
    const coords = new Map<string, LatLon | null>();

    for (const [i, s] of day.stops.entries()) {
      onProgress?.({
        phase: 'stop',
        dayIndex,
        totalDays,
        label: s.title,
      });

      const resolved = await resolvePlaceHint(s);
      if (resolved.lat === undefined) {
        unlocatedStops.push({ title: s.title, dayIndex });
      }

      const kind = isKind(s.kind) ? s.kind : 'uncategorized';
      const stopRecord = await pb.collection('stops').create({
        day: dayRecord.id,
        order_index: i,
        title: s.title,
        kind,
        kind_confirmed: kind !== 'uncategorized',
        lat: resolved.lat,
        lon: resolved.lon,
        is_accommodation: s.is_accommodation ?? false,
        anchor_time: s.anchor_time ?? '',
        anchor_type: s.anchor_type,
        dwell_override: s.dwell_min,
        routing_kind: s.routing_kind ?? 'stop',
      });
      stopIds.push(stopRecord.id);
      coords.set(
        stopRecord.id,
        resolved.lat !== undefined && resolved.lon !== undefined
          ? { lat: resolved.lat, lon: resolved.lon }
          : null,
      );
      stopsCreated += 1;

      for (const [ai, a] of (s.activities ?? []).entries()) {
        await pb.collection('activities').create({
          stop: stopRecord.id,
          order_index: ai,
          title: a.title,
          duration_min: a.duration_min,
          kind: a.kind ?? 'activity',
        });
      }

      let blockOrder = 0;
      if (s.notes?.trim()) {
        await pb.collection('blocks').create({
          trip: trip.id,
          parent_type: 'stop',
          parent_id: stopRecord.id,
          kind: 'note',
          visibility: 'trip',
          order_index: blockOrder++,
          creator: pb.authStore.record?.id,
          body: s.notes,
        });
      }
      for (const link of s.links ?? []) {
        await pb.collection('blocks').create({
          trip: trip.id,
          parent_type: 'stop',
          parent_id: stopRecord.id,
          kind: 'link',
          visibility: link.visibility ?? 'trip',
          order_index: blockOrder++,
          creator: pb.authStore.record?.id,
          url: link.url,
          title: link.title ?? '',
        });
      }
    }

    for (const leg of day.legs) {
      const fromId = stopIds[leg.from];
      const toId = stopIds[leg.to];
      if (!fromId || !toId) continue; // an out-of-range index in the doc
      onProgress?.({
        phase: 'leg',
        dayIndex,
        totalDays,
        label: `${day.stops[leg.from]?.title ?? '?'} → ${day.stops[leg.to]?.title ?? '?'}`,
      });
      const fields = await buildLegRecord(
        routing,
        {
          from_stop: fromId,
          to_stop: toId,
          mode: leg.mode,
          surface: leg.surface ?? null,
        },
        coords,
      );
      await pb.collection('legs').create(fields);
      if (fields.routing_source === 'ors') legsRouted += 1;
      else legsManual += 1;
    }
  }

  return {
    trip,
    daysCreated: doc.days.length,
    stopsCreated,
    legsRouted,
    legsManual,
    unlocatedStops,
  };
}

/** Deletes a trip and, via `cascadeDelete`, everything under it — the
 * cheap approximation of a rollback described above. */
export async function abandonTripImport(
  pb: TypedPocketBase,
  tripId: string,
): Promise<void> {
  await pb.collection('trips').delete(tripId);
}
