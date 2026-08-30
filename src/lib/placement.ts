/**
 * Placement ranking (WORK 6.3, BUILD §6): "rather than asking which slot,
 * route the candidate into every gap in the day[s] and rank by added time."
 *
 * enumerateGaps is pure — every gap across every day, before the first stop,
 * between each pair, after the last, or the sole gap in an empty day.
 * rankPlacements is not: it calls the router once or twice per gap (a between-
 * pair gap needs both new legs; the existing leg it would replace is already
 * cached) and sorts by the net minutes added. A gap the router can't solve
 * for is kept, ranked last, with addedMin null — "can't tell you the cost"
 * is more honest than silently dropping the option.
 */

import type { TripRecords } from './pb-trip-doc';
import type { LatLon, RoutingProvider } from './routing';

export interface PlacementGap {
  dayId: string;
  dayIndex: number;
  prevStopId: string | null;
  prevTitle: string | null;
  nextStopId: string | null;
  nextTitle: string | null;
}

export interface PlacementOption extends PlacementGap {
  /** Net minutes the day grows by, or null if the router couldn't solve it. */
  addedMin: number | null;
}

/** Every insertion point across every day, in day order. */
export function enumerateGaps(records: TripRecords): PlacementGap[] {
  const days = [...records.days].sort((a, b) => a.order_index - b.order_index);
  const gaps: PlacementGap[] = [];

  days.forEach((day, dayIndex) => {
    const dayStops = records.stops
      .filter((s) => s.day === day.id)
      .sort((a, b) => a.order_index - b.order_index);

    if (dayStops.length === 0) {
      gaps.push({
        dayId: day.id,
        dayIndex,
        prevStopId: null,
        prevTitle: null,
        nextStopId: null,
        nextTitle: null,
      });
      return;
    }

    const first = dayStops[0]!;
    gaps.push({
      dayId: day.id,
      dayIndex,
      prevStopId: null,
      prevTitle: null,
      nextStopId: first.id,
      nextTitle: first.title,
    });

    for (let i = 0; i < dayStops.length - 1; i++) {
      const a = dayStops[i]!;
      const b = dayStops[i + 1]!;
      gaps.push({
        dayId: day.id,
        dayIndex,
        prevStopId: a.id,
        prevTitle: a.title,
        nextStopId: b.id,
        nextTitle: b.title,
      });
    }

    const last = dayStops[dayStops.length - 1]!;
    gaps.push({
      dayId: day.id,
      dayIndex,
      prevStopId: last.id,
      prevTitle: last.title,
      nextStopId: null,
      nextTitle: null,
    });
  });

  return gaps;
}

function coordsOf(records: TripRecords, stopId: string | null): LatLon | null {
  if (!stopId) return null;
  const s = records.stops.find((x) => x.id === stopId);
  if (!s) return null;
  const lat = s.access_lat && s.access_lon ? s.access_lat : s.lat;
  const lon = s.access_lat && s.access_lon ? s.access_lon : s.lon;
  return lat && lon ? { lat, lon } : null;
}

function existingLegMinutes(
  records: TripRecords,
  prevStopId: string,
  nextStopId: string,
): number {
  const leg = records.legs.find(
    (l) => l.from_stop === prevStopId && l.to_stop === nextStopId,
  );
  return leg?.duration_min ?? 0;
}

/** Net minutes added by inserting `candidate` into `gap`, or null if the
 * router can't place it there (no coordinates, or no route found). */
async function addedMinutesFor(
  records: TripRecords,
  gap: PlacementGap,
  candidate: LatLon,
  provider: RoutingProvider,
): Promise<number | null> {
  const prev = coordsOf(records, gap.prevStopId);
  const next = coordsOf(records, gap.nextStopId);

  if (!gap.prevStopId && !gap.nextStopId) return 0; // empty day

  try {
    if (gap.prevStopId && gap.nextStopId) {
      if (!prev || !next) return null;
      const [toCandidate, fromCandidate] = await Promise.all([
        provider.route(prev, candidate),
        provider.route(candidate, next),
      ]);
      if (!toCandidate.routable || !fromCandidate.routable) return null;
      const existing = existingLegMinutes(
        records,
        gap.prevStopId,
        gap.nextStopId,
      );
      return toCandidate.duration_min + fromCandidate.duration_min - existing;
    }
    if (gap.nextStopId) {
      // Before the day's first stop: one new leg, nothing removed.
      if (!next) return null;
      const r = await provider.route(candidate, next);
      return r.routable ? r.duration_min : null;
    }
    // After the day's last stop.
    if (!prev) return null;
    const r = await provider.route(prev, candidate);
    return r.routable ? r.duration_min : null;
  } catch {
    return null;
  }
}

/** Human-readable description of a gap, day number excluded (the caller
 * usually already shows "Day N ·" alongside it). */
export function describeGap(gap: PlacementGap): string {
  if (!gap.prevTitle && !gap.nextTitle) return 'first stop of the day';
  if (!gap.prevTitle) return `before ${gap.nextTitle}`;
  if (!gap.nextTitle) return `after ${gap.prevTitle}`;
  return `between ${gap.prevTitle} and ${gap.nextTitle}`;
}

/** Ranks every gap by net added minutes, ascending; unsolvable gaps sort
 * last. One placement list, spanning the whole trip (BUILD §6's example
 * mixes gaps from different days), not just the currently open day. */
export async function rankPlacements(
  records: TripRecords,
  candidate: LatLon,
  provider: RoutingProvider,
): Promise<PlacementOption[]> {
  const gaps = enumerateGaps(records);
  const options = await Promise.all(
    gaps.map(async (gap) => ({
      ...gap,
      addedMin: await addedMinutesFor(records, gap, candidate, provider),
    })),
  );
  return options.sort((a, b) => {
    if (a.addedMin == null) return b.addedMin == null ? 0 : 1;
    if (b.addedMin == null) return -1;
    return a.addedMin - b.addedMin;
  });
}
