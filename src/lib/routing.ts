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

export function createPocketBaseRouting(pb: TypedPocketBase): RoutingProvider {
  return {
    route(from, to, profile = 'driving-car') {
      return pb.send<RouteResult>('/api/route', {
        method: 'POST',
        body: { from, to, profile },
      });
    },
  };
}
