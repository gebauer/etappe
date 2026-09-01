/**
 * Merge prompt (WORK 6.5, BUILD §6): "a stop within 100m of an existing one
 * prompts to merge instead of duplicating." Pure detection only — the actual
 * merge (use the existing stop, optionally attach the new capture's link)
 * is a caller concern, since what "merge" means depends on what the
 * candidate carries (a wishlist promotion also re-parents the idea's blocks
 * and deletes it; a plain search pick doesn't).
 */

import { haversineMeters } from './geo';
import type { StopsResponse } from '../types/pb';
import type { LatLon } from './routing';

export const MERGE_RADIUS_M = 100;

/** The closest existing stop within `radiusM` of `point`, or null. Compares
 * against each stop's own location, not its access point — an access point
 * is a routing workaround, not "the same place" as the candidate. */
export function findNearbyStop(
  point: LatLon,
  stops: StopsResponse[],
  radiusM = MERGE_RADIUS_M,
): StopsResponse | null {
  let closest: StopsResponse | null = null;
  let closestDist = Infinity;
  for (const s of stops) {
    if (!s.lat || !s.lon) continue;
    const d = haversineMeters(point, { lat: s.lat, lon: s.lon });
    if (d < radiusM && d < closestDist) {
      closest = s;
      closestDist = d;
    }
  }
  return closest;
}
