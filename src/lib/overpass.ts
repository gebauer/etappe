/**
 * Nearby POIs (WORK 6.4, BUILD §6.5): an Overpass query for tourism POIs
 * within an adjustable corridor of a day's route, returned as ghost pins.
 * The corridor is approximated as "within radius of any of the day's
 * waypoints" — Overpass's `around` filter accepts a coordinate list
 * natively, so this needs no route-polyline buffering.
 *
 * Scoped to `tourism`/`historic`, plus a curated `natural` subset matching
 * the taxonomy's own outdoor kinds (waterfall, volcano, ...) — not the
 * unfiltered tag, which is dominated by trees and water polygons. Results
 * within 100m of an existing stop are dropped (same threshold WORK.md's
 * still-unbuilt 6.5 merge prompt uses) so the corridor doesn't just
 * re-suggest what's already on the itinerary.
 */

import { z } from 'zod';
import { mapOsmTags } from './osm-tags';
import type { Kind } from './taxonomy';
import type { LatLon } from './routing';

const OVERPASS_URL =
  import.meta.env.VITE_OVERPASS_URL ??
  'https://overpass-api.de/api/interpreter';

const NEARBY_TAGS = ['tourism', 'historic'];
const NEARBY_NATURAL = [
  'waterfall',
  'volcano',
  'cave_entrance',
  'beach',
  'peak',
  'hot_spring',
];

export interface NearbyPoi {
  osmId: string;
  name: string;
  kind: Kind;
  lat: number;
  lon: number;
}

/** Meters between two points (haversine, Earth radius 6371km). */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function buildOverpassQuery(
  waypoints: LatLon[],
  radiusM: number,
): string {
  const coordList = waypoints.map((p) => `${p.lat},${p.lon}`).join(',');
  const around = `around:${Math.round(radiusM)},${coordList}`;
  const clauses = [
    ...NEARBY_TAGS.map((t) => `node["${t}"](${around});`),
    `node["natural"~"^(${NEARBY_NATURAL.join('|')})$"](${around});`,
  ];
  return `[out:json][timeout:25];(${clauses.join('')});out body;`;
}

const ElementSchema = z.object({
  type: z.string(),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  tags: z.record(z.string()).optional(),
});
const ResponseSchema = z.object({ elements: z.array(ElementSchema) });

/** Validate and map a raw Overpass response, dropping unnamed nodes and
 * anything within `excludeRadiusM` of an existing stop. Pure; unit-tested. */
export function parseOverpass(
  json: unknown,
  existingStops: LatLon[],
  excludeRadiusM = 100,
): NearbyPoi[] {
  const results: NearbyPoi[] = [];
  for (const el of ResponseSchema.parse(json).elements) {
    if (el.type !== 'node' || el.lat == null || el.lon == null) continue;
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue;
    const point: LatLon = { lat: el.lat, lon: el.lon };
    const tooClose = existingStops.some(
      (s) => haversineMeters(s, point) < excludeRadiusM,
    );
    if (tooClose) continue;
    results.push({
      osmId: `node/${el.id}`,
      name,
      kind: mapOsmTags(tags) ?? 'uncategorized',
      lat: el.lat,
      lon: el.lon,
    });
  }
  return results;
}

/** Queries Overpass for tourism POIs near `waypoints`, excluding anything
 * close to an existing stop. Thin network wrapper; not unit-tested (see
 * parseOverpass/buildOverpassQuery, which are). */
export async function queryNearby(
  waypoints: LatLon[],
  radiusM: number,
  existingStops: LatLon[],
): Promise<NearbyPoi[]> {
  if (waypoints.length === 0) return [];
  const query = buildOverpassQuery(waypoints, radiusM);
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass query failed (${res.status})`);
  return parseOverpass(await res.json(), existingStops);
}
