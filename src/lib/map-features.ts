/**
 * Builds the GeoJSON the map's leg layers consume (BUILD §5): one LineString
 * per routed leg, carrying its flat day colour, alternating shade and an
 * after-dusk flag (leg arrival later than civil dusk). Pure and testable; legs
 * without geometry (unrouted) are skipped.
 */

import type { CascadeResult } from './cascade';
import type { TripRecords } from './pb-trip-doc';
import { dayHue, flatColor, legColor } from './map-colors';

export interface LegFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    legId: string;
    flat: string;
    shade: string;
    afterDusk: boolean;
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
      const geometry = asLineString(leg.geometry);
      if (!geometry) continue;

      const arrival = arrivalByStop.get(to.id);
      const afterDusk = dusk != null && arrival != null && arrival > dusk;
      features.push({
        type: 'Feature',
        geometry,
        properties: { legId: leg.id, flat, shade: legColor(hue, i), afterDusk },
      });
    }
  });

  return { type: 'FeatureCollection', features };
}
