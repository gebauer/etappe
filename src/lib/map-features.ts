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
import { TAXONOMY, type Kind } from './taxonomy';

export interface LegFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    legId: string;
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
          properties: { legId: leg.id, flat, shade, afterDusk, manual: false },
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
          properties: { legId: leg.id, flat, shade, afterDusk, manual: true },
        });
      }
    }
  });

  return { type: 'FeatureCollection', features };
}

// --- stop markers (BUILD §5) -----------------------------------------------

export interface StopFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    stopId: string;
    title: string;
    icon: string;
    hue: string;
    iconImage: string;
    isAccommodation: boolean;
    anchored: boolean;
    sortKey: number;
  };
}

export interface StopFeatureCollection {
  type: 'FeatureCollection';
  features: StopFeature[];
}

/** One Point per stop with coordinates, carrying its kind icon, day-hue ring
 * colour and a collision sort key (accommodation first, then anchored). The
 * iconImage key names the composited circle+icon the map builds on demand. */
export function buildStopFeatures(records: TripRecords): StopFeatureCollection {
  const features: StopFeature[] = [];
  const days = [...records.days].sort((a, b) => a.order_index - b.order_index);

  days.forEach((day, dayIndex) => {
    const hue = flatColor(dayHue(dayIndex));
    for (const s of records.stops.filter((x) => x.day === day.id)) {
      if (!s.lat || !s.lon) continue;
      const icon = TAXONOMY[s.kind as Kind]?.icon ?? 'marker';
      const isAccommodation = !!s.is_accommodation;
      const anchored = !!s.anchor_time;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          stopId: s.id,
          title: s.title,
          icon,
          hue,
          iconImage: `m:${icon}:${hue}`,
          isAccommodation,
          anchored,
          sortKey: isAccommodation ? 0 : anchored ? 1 : 2,
        },
      });
    }
  });

  return { type: 'FeatureCollection', features };
}
