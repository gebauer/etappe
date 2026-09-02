/**
 * Shared geocode-on-import step (WORK 8.1/8.2, 16.4): given a place that may
 * already carry coordinates, or only a `place_hint`, resolve it to a point.
 *
 * Used by both importers — the Highlights flat-list wishlist import and the
 * full multi-day trip import — so the "what does resolving a place mean"
 * question has one answer, not two that could drift.
 *
 * Deliberately silent-first-match, not "geocode with map confirmation and
 * ambiguity flags": Photon's top result for a hint like "Gullfoss waterfall,
 * Iceland" is right often enough, and a wrong result is caught the same way
 * a failed one is — the caller reports it and the place lands with no (or
 * a wrong) location, fixable by hand afterward (a stop's Latitude/Longitude
 * fields in the expanded card, a wishlist idea's "Set location on the map").
 * Building real ambiguity UI is real work with its own map/UI surface; this
 * is the cheap 90% that ships.
 */

import { photonSearch } from './photon';

export interface GeocodeResult {
  lat?: number;
  lon?: number;
  /** A geocode was attempted and returned a match. */
  geocoded: boolean;
  /** A geocode was attempted (there was a `place_hint`) and found nothing. */
  geocodeFailed: boolean;
}

export async function resolvePlaceHint(place: {
  lat?: number;
  lon?: number;
  place_hint?: string;
}): Promise<GeocodeResult> {
  if (place.lat !== undefined && place.lon !== undefined) {
    return {
      lat: place.lat,
      lon: place.lon,
      geocoded: false,
      geocodeFailed: false,
    };
  }
  if (!place.place_hint) {
    return { geocoded: false, geocodeFailed: false };
  }
  try {
    const [match] = await photonSearch(place.place_hint, { limit: 1 });
    if (!match) return { geocoded: false, geocodeFailed: true };
    return {
      lat: match.lat,
      lon: match.lon,
      geocoded: true,
      geocodeFailed: false,
    };
  } catch {
    return { geocoded: false, geocodeFailed: true };
  }
}
