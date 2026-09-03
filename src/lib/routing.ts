/**
 * Client routing seam (WORK 3.2). A single `route()` method behind an
 * interface, so a self-hosted OSRM/Valhalla can replace ORS without touching
 * app code. The PocketBase implementation calls the /api/route hook (phase
 * 3.1), which owns the ORS key and the cache.
 */

import type { TypedPocketBase } from '../types/pb';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RouteResult {
  routable: boolean;
  duration_min: number;
  distance_m: number;
  geometry: unknown; // GeoJSON LineString
  cached: boolean;
}

export interface RoutingProvider {
  route(from: LatLon, to: LatLon, profile?: string): Promise<RouteResult>;
}

/** Modes routed automatically. Every other mode carries a manually entered
 * duration and is never sent to the router (BUILD §4). */
export const ROUTABLE_MODES = ['car'] as const;

export function isRoutable(mode: string): boolean {
  return (ROUTABLE_MODES as readonly string[]).includes(mode);
}

/**
 * `tripId` tells the hook whose routing engine and key to use: the **trip
 * owner's**, so every member of a shared trip sees the same durations and
 * the owner pays the quota (WORK 19.1). Omit it and the hook falls back to
 * the server's own env configuration — that is the import path, which
 * creates the trip as it goes and has no id to name yet.
 */
export function createPocketBaseRouting(
  pb: TypedPocketBase,
  tripId?: string,
): RoutingProvider {
  return {
    route(from, to, profile = 'driving-car') {
      return pb.send<RouteResult>('/api/route', {
        method: 'POST',
        body: tripId
          ? { from, to, profile, trip: tripId }
          : { from, to, profile },
      });
    },
  };
}
