/**
 * Builds the GeoJSON the map's leg layers consume (BUILD §5): one LineString
 * per leg, carrying its flat day colour, alternating shade and an after-dusk
 * flag (leg arrival later than civil dusk). A leg with no route geometry
 * (manual, or routing failed) falls back to a straight line between its two
 * stops, flagged `manual: true`, so the map still shows the connection
 * without implying a real route was computed. Pure and testable.
 */

import type { CascadeResult } from './cascade';
import type { TripRecords } from './pb-trip-doc';
import { dayHue, flatColor, legColor } from './map-colors';

export interface LegFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    legId: string;
    /** Which day's route this leg belongs to — the hover highlight filters
     * on it (a leading leg counts as the day it drives *into*). */
    dayId: string;
    flat: string;
    shade: string;
    afterDusk: boolean;
    manual: boolean;
  };
}

export interface LegFeatureCollection {
  type: 'FeatureCollection';
  features: LegFeature[];
}

function asLineString(
  g: unknown,
): { type: 'LineString'; coordinates: number[][] } | null {
  if (
    g &&
    typeof g === 'object' &&
    'type' in g &&
    (g as { type: unknown }).type === 'LineString' &&
    'coordinates' in g
  ) {
    const coords = (g as { coordinates: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { type: 'LineString', coordinates: coords as number[][] };
    }
  }
  return null;
}

export function buildLegFeatures(
  records: TripRecords,
  result: CascadeResult | null,
): LegFeatureCollection {
  const features: LegFeature[] = [];
  const days = [...records.days].sort((a, b) => a.order_index - b.order_index);
  const stopById = new Map(records.stops.map((s) => [s.id, s]));

  days.forEach((day, dayIndex) => {
    const hue = dayHue(dayIndex);
    const flat = flatColor(hue);
    const dayStops = records.stops
      .filter((s) => s.day === day.id)
      .sort((a, b) => a.order_index - b.order_index);
    const dayResult = result?.days.find((d) => d.dayId === day.id);
    const dusk = dayResult?.daylight?.dusk ?? null;
    const arrivalByStop = new Map(
      dayResult?.stops.map((s) => [s.stopId, s.arrival]) ?? [],
    );

    // Leading leg (WORK 13.3): the morning drive from the day's start point
    // (`start_stop`, normally the previous day's accommodation) to its first
    // stop. Drawn in this day's hue like any other leg — the "from
    // yesterday" cue lives in the itinerary's ghost row, not the map line.
    const firstStop = dayStops[0];
    const startStop = day.start_stop
      ? (stopById.get(day.start_stop) ?? null)
      : null;
    if (
      firstStop &&
      startStop &&
      startStop.id !== firstStop.id &&
      startStop.lat &&
      startStop.lon &&
      firstStop.lat &&
      firstStop.lon
    ) {
      const leadLeg = records.legs.find(
        (l) => l.from_stop === startStop.id && l.to_stop === firstStop.id,
      );
      const arrival = arrivalByStop.get(firstStop.id);
      const afterDusk = dusk != null && arrival != null && arrival > dusk;
      const geometry = asLineString(leadLeg?.geometry);
      features.push({
        type: 'Feature',
        geometry: geometry ?? {
          type: 'LineString',
          coordinates: [
            [startStop.lon, startStop.lat],
            [firstStop.lon, firstStop.lat],
          ],
        },
        properties: {
          legId: leadLeg?.id ?? `lead:${day.id}`,
          dayId: day.id,
          flat,
          shade: legColor(hue, 0),
          afterDusk,
          manual: !geometry,
        },
      });
    }

    for (let i = 0; i < dayStops.length - 1; i++) {
      const from = dayStops[i]!;
      const to = dayStops[i + 1]!;
      const leg = records.legs.find(
        (l) => l.from_stop === from.id && l.to_stop === to.id,
      );
      if (!leg) continue;

      const arrival = arrivalByStop.get(to.id);
      const afterDusk = dusk != null && arrival != null && arrival > dusk;
      const shade = legColor(hue, i);

      const geometry = asLineString(leg.geometry);
      if (geometry) {
        features.push({
          type: 'Feature',
          geometry,
          properties: {
            legId: leg.id,
            dayId: day.id,
            flat,
            shade,
            afterDusk,
            manual: false,
          },
        });
        continue;
      }

      // No route geometry: connect the two stops with a straight line rather
      // than drawing nothing, but flag it so the map styles it as a manual
      // connector, not a computed route.
      if (from.lat && from.lon && to.lat && to.lon) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [from.lon, from.lat],
              [to.lon, to.lat],
            ],
          },
          properties: {
            legId: leg.id,
            dayId: day.id,
            flat,
            shade,
            afterDusk,
            manual: true,
          },
        });
      }
    }
  });

  return { type: 'FeatureCollection', features };
}

// --- stop markers (design_handoff_map_first_planner, WORK 12.4) -----------

export interface StopFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    stopId: string;
    title: string;
    dayId: string;
    /** 1-indexed position within its day — the number painted on the pin,
     * matching the itinerary column's sequence badge (WORK 12.6). */
    seq: number;
    iconImage: string;
    /** WORK 14.3 — baked into `iconImage` (a starred stop gets its own
     * "n:<seq>:star" image), kept as its own property too since `StopRow`
     * needs it without decoding the image key. */
    starred: boolean;
    /** WORK 16.9 — a waypoint forces the route through here without being a
     * destination; kept alongside `iconImage` (which already encodes it into
     * a distinct "n:wp:<seq>" key) for the same reason `starred` is. */
    routingKind: 'stop' | 'waypoint';
  };
}

export interface StopFeatureCollection {
  type: 'FeatureCollection';
  features: StopFeature[];
}

/** One Point per stop with coordinates. All days are built into one
 * collection (seq is stable per day regardless of which day is focused);
 * `MapPane` filters the rendered layer to the focused day (design handoff:
 * "clicking a day pill swaps ... the map's numbered pins to that day").
 * The pin no longer carries a kind icon or a day hue — the redesign's pins
 * are plain numbered circles, identical across days and kinds; identity
 * lives in the card, not painted on the map (BUILD §5's kind-icon pins are
 * superseded here, not merely restyled). iconImage names the composited
 * numbered badge the map builds on demand. */
export function buildStopFeatures(records: TripRecords): StopFeatureCollection {
  const features: StopFeature[] = [];
  const days = [...records.days].sort((a, b) => a.order_index - b.order_index);

  for (const day of days) {
    const dayStops = records.stops
      .filter((s) => s.day === day.id)
      .sort((a, b) => a.order_index - b.order_index);
    let seq = 0;
    for (const s of dayStops) {
      if (!s.lat || !s.lon) continue;
      seq += 1;
      const starred = !!s.starred;
      const isWaypoint = s.routing_kind === 'waypoint';
      // A waypoint's icon key never carries the star suffix — the numbered
      // destination badge and the "starred" affordance are both about a
      // place worth remembering, which a pure routing point isn't.
      const iconImage = isWaypoint
        ? `n:wp:${seq}`
        : starred
          ? `n:${seq}:star`
          : `n:${seq}`;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          stopId: s.id,
          title: s.title,
          dayId: day.id,
          seq,
          iconImage,
          starred,
          routingKind: isWaypoint ? 'waypoint' : 'stop',
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// --- trip-overview day pins (design_handoff (9), WORK 17.6) --------------

export interface DayStartFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    dayId: string;
    /** 1-indexed day number — the digit painted on the badge and shown in
     * the itinerary column's day list. */
    number: number;
    iconImage: string;
    /** The stop the day starts at, for the pin's `title`
     * (`Day 4 · starts at Seljalandsfoss`). Empty when the day has no
     * anchor at all. */
    startLabel: string;
    /** The day has no stops of its own — the badge renders on `control`
     * rather than accent so it still reads as present. */
    unplanned: boolean;
  };
}

export interface DayStartFeatureCollection {
  type: 'FeatureCollection';
  features: DayStartFeature[];
}

/**
 * One Point per day at that day's starting point, for the trip overview
 * (Fit trip / no day selected). A day with stops anchors on its first one;
 * a day with none falls back to where it would leave from — the nearest
 * earlier non-empty day's last accommodation stop, else that day's last
 * stop (the same rule the itinerary column's "start point" uses) — and is
 * flagged `unplanned`. A day with no anchor anywhere gets no pin (its row
 * still shows in the list).
 */
export function buildDayStartFeatures(
  records: TripRecords,
): DayStartFeatureCollection {
  const days = [...records.days].sort((a, b) => a.order_index - b.order_index);
  const stopsOf = (dayId: string) =>
    records.stops
      .filter((s) => s.day === dayId && s.lat && s.lon)
      .sort((a, b) => a.order_index - b.order_index);

  const features: DayStartFeature[] = [];
  days.forEach((day, i) => {
    const number = i + 1;
    const own = stopsOf(day.id);
    let coord: [number, number] | null = null;
    let label = '';
    let unplanned = false;

    if (own.length > 0) {
      coord = [own[0]!.lon, own[0]!.lat];
      label = own[0]!.title;
    } else {
      unplanned = true;
      for (let di = i - 1; di >= 0 && !coord; di--) {
        const earlier = stopsOf(days[di]!.id);
        if (earlier.length === 0) continue;
        const anchor =
          [...earlier].reverse().find((s) => s.is_accommodation) ??
          earlier[earlier.length - 1]!;
        coord = [anchor.lon, anchor.lat];
        label = anchor.title;
      }
    }
    if (!coord) return;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord },
      properties: {
        dayId: day.id,
        number,
        iconImage: unplanned ? `d:${number}:empty` : `d:${number}`,
        startLabel: label,
        unplanned,
      },
    });
  });

  return { type: 'FeatureCollection', features };
}

// --- wishlist pins (design_handoff_map_first_planner, WORK 12.4) ----------

export interface WishlistFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    poiId: string;
    title: string;
    kind: string;
    /** Composited square-thumbnail image key for this item, unselected
     * variant — one image per item (MapPane upgrades it in place from a
     * category-colour fallback to the real cover photo once loaded, via
     * `updateImage`, rather than encoding the photo in the key). */
    iconImage: string;
    /** Selected variant's key (bigger, brighter border, halo baked in) —
     * MapPane swaps to this via a filtered second layer. */
    iconImageSelected: string;
    /** Hover variant's key (WORK 12.10) — a touch bigger than the base pin
     * with an amber halo, driven by the `wishlist-pins-hovered` layer while
     * a carousel card or a compact-list row is hovered. */
    iconImageHovered: string;
  };
}

export interface WishlistFeatureCollection {
  type: 'FeatureCollection';
  features: WishlistFeature[];
}

/** One Point per wishlist idea with real coordinates — a freshly-added item
 * defaults to lat/lon 0,0 until placed or edited, which would otherwise
 * paint a pin in the Gulf of Guinea. Stays a pure function like its stop/leg
 * counterparts even though the actual photo lookup (which needs `blocks`)
 * happens in `MapPane` — this just names the image keys. */
export function buildWishlistFeatures(
  wishlist: Array<{
    id: string;
    title: string;
    kind?: string | null;
    lat?: number | null;
    lon?: number | null;
  }>,
): WishlistFeatureCollection {
  const features: WishlistFeature[] = wishlist
    .filter((p) => p.lat && p.lon)
    .map((p) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lon!, p.lat!] as [number, number],
      },
      properties: {
        poiId: p.id,
        title: p.title,
        kind: p.kind ?? 'uncategorized',
        iconImage: `w:${p.id}`,
        iconImageSelected: `w:${p.id}:sel`,
        iconImageHovered: `w:${p.id}:hover`,
      },
    }));
  return { type: 'FeatureCollection', features };
}
