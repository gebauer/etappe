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
import { isValidLatLon } from './geo';

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

export function asLineString(
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
      if (isValidLatLon(from.lat, from.lon) && isValidLatLon(to.lat, to.lon)) {
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

    // Trailing leg (WORK 29): the evening drive back to the day's end point,
    // the mirror of the leading leg above. Same hue — a base camp's two
    // transfers belong to the day that drives them, not to the day the hotel
    // row happens to live on.
    const lastStop = dayStops[dayStops.length - 1];
    const endStop = day.end_stop ? (stopById.get(day.end_stop) ?? null) : null;
    if (
      lastStop &&
      endStop &&
      endStop.id !== lastStop.id &&
      lastStop.lat &&
      lastStop.lon &&
      endStop.lat &&
      endStop.lon
    ) {
      const trailLeg = records.legs.find(
        (l) => l.from_stop === lastStop.id && l.to_stop === endStop.id,
      );
      const afterDusk =
        dusk != null &&
        dayResult?.endArrival != null &&
        dayResult.endArrival > dusk;
      const geometry = asLineString(trailLeg?.geometry);
      features.push({
        type: 'Feature',
        geometry: geometry ?? {
          type: 'LineString',
          coordinates: [
            [lastStop.lon, lastStop.lat],
            [endStop.lon, endStop.lat],
          ],
        },
        properties: {
          legId: trailLeg?.id ?? `trail:${day.id}`,
          dayId: day.id,
          flat,
          shade: legColor(hue, dayStops.length),
          afterDusk,
          manual: !geometry,
        },
      });
    }
  });

  return { type: 'FeatureCollection', features };
}

/** Bounding box `[west, south, east, north]` that frames one day: its own
 * stops plus every leg tagged to it. The leg pass is what pulls in the
 * leading leg from the previous day's stay — so a day whose only stop is the
 * accommodation still frames the whole drive into it, routed geometry or the
 * straight fallback alike. Null when nothing on the day has coordinates. */
export function boundsForDay(
  records: TripRecords,
  legFeatures: LegFeatureCollection,
  dayId: string,
): [number, number, number, number] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const add = (lon: number | undefined, lat: number | undefined) => {
    if (typeof lon !== 'number' || typeof lat !== 'number') return;
    if (!isValidLatLon(lat, lon)) return;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  };
  for (const stop of records.stops) {
    if (stop.day === dayId && isValidLatLon(stop.lat, stop.lon))
      add(stop.lon, stop.lat);
  }
  for (const f of legFeatures.features) {
    if (f.properties.dayId !== dayId) continue;
    for (const [lon, lat] of f.geometry.coordinates) add(lon, lat);
  }
  return east === -Infinity ? null : [west, south, east, north];
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
    /** The image key the `stops-dim` layer uses for this stop when its day
     * isn't focused (WORK 25): "s:<id>:dim" for a photo stop (a greyed,
     * number-less thumbnail), otherwise the same numbered-circle key as
     * `iconImage` — the layer's own opacity dims that one. */
    iconImageDim: string;
    /** WORK 25 — the stop carries a resolvable photo block (a cover photo
     * of its own, or one that came across when a wishlist idea was
     * promoted). The pin is a photo tile rather than a numbered circle;
     * `MapPane` resolves the URL and composites it. */
    hasPhoto: boolean;
    /** WORK 14.3 — baked into `iconImage` (a starred stop gets its own
     * "n:<seq>:star" image), kept as its own property too since `StopRow`
     * needs it without decoding the image key. */
    starred: boolean;
    /** WORK 16.9 — a waypoint forces the route through here without being a
     * destination; kept alongside `iconImage` (which already encodes it into
     * a distinct "n:wp:<seq>" key) for the same reason `starred` is. */
    routingKind: 'stop' | 'waypoint';
    /** WORK 30 — this is the extra "0" pin for a stop another day carries in
     * as its start point, not the stop's own pin. Its `dayId` is the day that
     * carries it, so it renders in that day's focused layer. */
    carried: boolean;
    /** WORK 30 — on a stop's *own* pin: the days that carry it in as their
     * start point, as `|d2|d3|`. `MapPane` hides the dimmed own-pin while one
     * of those days is focused, so the "0" doesn't sit on a duplicate.
     *
     * A delimited **string**, not an array, on purpose: MapLibre serialises
     * non-primitive feature properties through its tile pipeline, so an array
     * can come back out of `['get', …]` as JSON text and quietly change what
     * `['in', …]` means. The leading and trailing `|` make the substring test
     * an exact-id test. `''` when nothing carries it. */
    carriedInto: string;
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
 * The pin carries no day hue, and identity mostly lives in the card, not
 * painted on the map (BUILD §5's kind-icon pins are superseded here, not
 * merely restyled) — except a photo-less stop's kind icon (author request
 * 2026-09-04), which reads as its kind on the tile itself rather than a
 * blank fallback square; a stop with a photo still shows that instead.
 * iconImage names the composited badge/tile the map builds on demand. */
/** `['d2','d3']` -> `'|d2|d3|'`; nothing -> `''`. See `carriedInto`. */
export function dayTag(dayIds: string[] | undefined): string {
  return dayIds && dayIds.length ? `|${dayIds.join('|')}|` : '';
}

/** The `['in', …]` needle that matches one day inside a `dayTag` string. */
export function dayTagNeedle(dayId: string): string {
  return `|${dayId}|`;
}

export function buildStopFeatures(records: TripRecords): StopFeatureCollection {
  const features: StopFeature[] = [];
  const days = [...records.days].sort((a, b) => a.order_index - b.order_index);

  // WORK 30: which days carry each stop in as their start point. Built first
  // so a stop's own pin can name them and be hidden while one is focused.
  const stopById = new Map(records.stops.map((s) => [s.id, s]));
  const carriedInto = new Map<string, string[]>();
  for (const day of days) {
    const startId = day.start_stop;
    if (!startId) continue;
    const start = stopById.get(startId);
    // A same-day pointer is a no-op, and an unlocated stop has no pin.
    if (!start || start.day === day.id || !isValidLatLon(start.lat, start.lon))
      continue;
    carriedInto.set(startId, [...(carriedInto.get(startId) ?? []), day.id]);
  }

  for (const day of days) {
    const dayStops = records.stops
      .filter((s) => s.day === day.id)
      .sort((a, b) => a.order_index - b.order_index);
    let seq = 0;
    for (const s of dayStops) {
      if (!isValidLatLon(s.lat, s.lon)) continue;
      seq += 1;
      const starred = !!s.starred;
      const isWaypoint = s.routing_kind === 'waypoint';
      // A waypoint stays the neutral diamond — never a photo tile, never a
      // star suffix: the numbered badge and both those affordances are
      // about a place worth remembering, which a pure routing point isn't.
      const hasPhoto =
        !isWaypoint &&
        (records.blocks ?? []).some(
          (b) =>
            b.parent_type === 'stop' &&
            b.parent_id === s.id &&
            b.kind === 'photo' &&
            (b.file || b.url),
        );
      // A waypoint is the only stop still routed to the plain numbered
      // badge — every other stop uses the tile key regardless of hasPhoto:
      // `compositeStopPin` draws the cover photo when there is one and the
      // kind icon (plus the star, same as the badge did) when there isn't,
      // so there's no longer a separate blank-circle fallback to route to.
      const iconImage = isWaypoint ? `n:wp:${seq}` : `s:${s.id}`;
      const iconImageDim = isWaypoint ? `n:wp:${seq}` : `s:${s.id}:dim`;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          stopId: s.id,
          title: s.title,
          dayId: day.id,
          seq,
          iconImage,
          iconImageDim,
          hasPhoto,
          starred,
          routingKind: isWaypoint ? 'waypoint' : 'stop',
          carried: false,
          carriedInto: dayTag(carriedInto.get(s.id)),
        },
      });
    }
  }

  // The "0" pin (WORK 30): the previous night's hotel, drawn in the day that
  // leaves from it so it is numbered, undimmed and hoverable like that day's
  // own stops — before this it was only ever a greyed other-day pin you
  // could not pick out. Always a plain numbered circle: a photo tile or a
  // star would make it compete with the day's real stops, and it is context,
  // not a destination.
  for (const day of days) {
    const startId = day.start_stop;
    if (!startId || !(carriedInto.get(startId) ?? []).includes(day.id))
      continue;
    const start = stopById.get(startId)!;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [start.lon, start.lat] },
      properties: {
        stopId: start.id,
        title: start.title,
        dayId: day.id,
        seq: 0,
        iconImage: 'n:0',
        iconImageDim: 'n:0',
        hasPhoto: false,
        starred: false,
        routingKind: 'stop',
        carried: true,
        carriedInto: '',
      },
    });
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
      .filter((s) => s.day === dayId && isValidLatLon(s.lat, s.lon))
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
    .filter((p) => isValidLatLon(p.lat, p.lon))
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
