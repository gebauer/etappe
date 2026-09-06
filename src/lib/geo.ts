/**
 * Shared geo utility. Split out once a second feature needed it (WORK 6.5's
 * merge prompt, alongside 6.4's nearby-corridor dedup) rather than each
 * reimplementing haversine.
 */

import type { LatLon } from './routing';

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

/**
 * Is this pair a coordinate the map can draw?
 *
 * Everything that draws a point used to guard with `lat && lon`, which
 * accepts any non-zero number at all. A latitude of 1000 — what you get
 * from pasting an address into the field — reached MapLibre and threw
 * `Invalid LngLat latitude value`, unmounting the whole app.
 *
 * The zero check stays: an unplaced stop or idea is stored as 0/0, so
 * that pair means "no coordinates yet", not Null Island.
 *
 * A record that fails this is simply not drawn. It stays in the itinerary
 * and stays editable, which is the only way to correct it.
 */
export function isValidLatLon(
  lat: number | null | undefined,
  lon: number | null | undefined,
): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 || lon === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}
