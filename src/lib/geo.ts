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
