/**
 * The trip-selection screen (WORK 21 / handoff "Trip selection"): each trip
 * is a photo card, not a 13px row. Assembling one needs the trip's days,
 * legs, costs and wishlist — a few extra reads per trip, fine for the
 * handful a self-hosted install holds.
 *
 * Photos come from the wishlist, never stock: the hero is the first starred
 * idea with a photo, the strip the next few; ideas without a photo fall back
 * to a kind-tinted plate carrying the place name.
 */
import type { TypedPocketBase, TripsResponse, PoisResponse } from '../types/pb';
import { loadTripRecords } from './pb-trip-doc';
import { listMyTrips } from './pb-trips';
import { blocksFor, firstPhotoUrl } from './pb-blocks';
import { categoryColor } from './map-colors';
import { formatDayDate, relativeTime } from './format';

export type TripStatusKind = 'upcoming' | 'progress' | 'past' | 'draft';

export interface TripStatus {
  kind: TripStatusKind;
  /** `In 41 days` / `Day 3` / `Past` / `Draft`. */
  label: string;
}

export interface TripPhoto {
  /** A photo thumbnail, or null → render the kind-tinted plate. */
  url: string | null;
  place: string;
  /** Plate fill when `url` is null. */
  color: string;
}

export interface TripCard {
  trip: TripsResponse;
  status: TripStatus;
  dateRange: string;
  days: number;
  stops: number;
  km: number;
  costBand: '' | '€' | '€€' | '€€€';
  editedRelative: string;
  contributors: { name: string; color: string }[];
  hero: TripPhoto | null;
  /** Up to three. */
  strip: TripPhoto[];
  action: 'Open' | 'Revisit' | 'Continue';
}

const MS_DAY = 86_400_000;

/** Status from the trip's dates and day count. A trip with no days is a
 * draft; otherwise it is upcoming / in progress / past relative to `now`. */
export function tripStatus(
  startDate: string,
  dayCount: number,
  now: Date = new Date(),
): TripStatus {
  if (dayCount === 0) return { kind: 'draft', label: 'Draft' };
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dayIndex = Math.floor((today - start) / MS_DAY);
  if (dayIndex < 0) {
    const n = -dayIndex;
    return {
      kind: 'upcoming',
      label: n === 1 ? 'Tomorrow' : `In ${n} days`,
    };
  }
  if (dayIndex < dayCount) {
    return { kind: 'progress', label: `Day ${dayIndex + 1}` };
  }
  return { kind: 'past', label: 'Past' };
}

/** A coarse spend tier for the card. Currency-naive on purpose — the exact,
 * converted figure lives in the budget popover; here it is just a hint, and
 * omitted entirely when the trip has no costs. */
export function costBand(total: number): '' | '€' | '€€' | '€€€' {
  if (total <= 0) return '';
  if (total <= 500) return '€';
  if (total <= 2000) return '€€';
  return '€€€';
}

/** Order: in progress, then upcoming by start date, then drafts by most
 * recently edited, then past trips newest first. */
export function compareTripCards(a: TripCard, b: TripCard): number {
  const rank: Record<TripStatusKind, number> = {
    progress: 0,
    upcoming: 1,
    draft: 2,
    past: 3,
  };
  const ra = rank[a.status.kind];
  const rb = rank[b.status.kind];
  if (ra !== rb) return ra - rb;
  const startA = a.trip.start_date;
  const startB = b.trip.start_date;
  switch (a.status.kind) {
    case 'upcoming':
    case 'progress':
      return startA.localeCompare(startB);
    case 'draft':
      return b.trip.updated.localeCompare(a.trip.updated);
    case 'past':
      return startB.localeCompare(startA);
  }
}

export async function loadTripCards(pb: TypedPocketBase): Promise<TripCard[]> {
  const trips = await listMyTrips();
  const cards = await Promise.all(
    trips.map((trip) => buildCard(pb, trip).catch(() => fallbackCard(trip))),
  );
  return cards.sort(compareTripCards);
}

async function buildCard(
  pb: TypedPocketBase,
  trip: TripsResponse,
): Promise<TripCard> {
  // `requestKey: null` on every read — cards load in parallel, and the SDK's
  // auto-cancel keys on collection+method, so two trips' `pois` (or `days`)
  // fetches would otherwise abort each other.
  const [records, pois] = await Promise.all([
    loadTripRecords(pb, trip.id),
    pb.collection('pois').getFullList<PoisResponse>({
      filter: pb.filter('trip = {:trip}', { trip: trip.id }),
      sort: '-created',
      requestKey: null,
    }),
  ]);

  const days = records.days.length;
  const status = tripStatus(trip.start_date, days);
  const km = Math.round(
    records.legs.reduce((s, l) => s + (l.distance_m ?? 0), 0) / 1000,
  );
  const costTotal = records.costs.reduce((s, c) => s + (c.amount ?? 0), 0);

  // Photo priority: a starred idea with a photo, then any idea with a photo,
  // then ideas without one (rendered as a plate). Never a blank slot beyond
  // the number of ideas the trip actually has. The author's own hero pick
  // (`trips.hero_poi`, WORK 23) jumps the queue.
  const heroPoiId = trip.hero_poi || null;
  const ranked = [...pois]
    .sort((a, b) => Number(b.starred) - Number(a.starred))
    .map((poi) => {
      const url = firstPhotoUrl(
        pb,
        blocksFor(records.blocks, 'poi', poi.id),
        '640x0',
      );
      return {
        poiId: poi.id,
        url,
        tile: { url, place: poi.title, color: categoryColor(poi.kind) },
      };
    });
  ranked.sort((a, b) => Number(!!b.url) - Number(!!a.url));
  if (heroPoiId) {
    const i = ranked.findIndex((r) => r.poiId === heroPoiId);
    if (i > 0) ranked.unshift(ranked.splice(i, 1)[0]!);
  }
  const tiles = ranked.slice(0, 4).map((r) => r.tile);

  const contributors: { name: string; color: string }[] = [];
  const seen = new Set<string>();
  for (const poi of pois) {
    const name = poi.creator_name?.trim();
    const color = poi.creator_color?.trim();
    if (name && color && !seen.has(name)) {
      seen.add(name);
      contributors.push({ name, color });
    }
  }

  return {
    trip,
    status,
    dateRange:
      days > 0
        ? `${formatDayDate(trip.start_date, 0)} – ${formatDayDate(trip.start_date, days - 1)}`
        : formatDayDate(trip.start_date, 0),
    days,
    stops: records.stops.length,
    km,
    costBand: costBand(costTotal),
    editedRelative: relativeTime(Date.parse(trip.updated)),
    contributors,
    hero: tiles[0] ?? null,
    strip: tiles.slice(1, 4),
    action:
      status.kind === 'past'
        ? 'Revisit'
        : status.kind === 'draft'
          ? 'Continue'
          : 'Open',
  };
}

/** A trip whose detail failed to load still gets a row. */
function fallbackCard(trip: TripsResponse): TripCard {
  return {
    trip,
    status: tripStatus(trip.start_date, 1),
    dateRange: formatDayDate(trip.start_date, 0),
    days: 0,
    stops: 0,
    km: 0,
    costBand: '',
    editedRelative: relativeTime(Date.parse(trip.updated)),
    contributors: [],
    hero: null,
    strip: [],
    action: 'Open',
  };
}
