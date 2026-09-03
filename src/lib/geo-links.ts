/**
 * Deep links out to a map/navigation app for the phone companion (WORK
 * 10.1 / BUILD §6: "tap out to Google Maps or Komoot"). Pure string
 * builders — no SDK, no key.
 */

/** Google Maps turn-by-turn to a coordinate. `api=1` is the documented,
 * app-and-web stable form. */
export function mapsDirectionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

/**
 * A full A → B route for one leg (WORK 10.4).
 *
 * There is no cross-app way to do this on Android: the intents that
 * dispatch to whatever routing app the user has set as default
 * (`geo:`, `google.navigation:`) are **destination-only** — they assume
 * you are standing at the origin. Passing both endpoints needs an
 * app-specific URL. Google Maps' `?api=1` directions URL is the one that
 * degrades sensibly everywhere: desktop opens maps.google.com with the
 * route, Android opens the Google Maps app (or the browser) with both
 * points, iOS/macOS the same. So one link, no platform sniffing.
 */
export function legDirectionsUrl(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  mode?: string,
): string {
  const travelmode =
    mode === 'walk'
      ? 'walking'
      : mode === 'bike'
        ? 'bicycling'
        : mode === 'flight' || mode === 'ferry'
          ? 'transit'
          : 'driving';
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${from.lat},${from.lon}` +
    `&destination=${to.lat},${to.lon}` +
    `&travelmode=${travelmode}`
  );
}

/** Google Maps "what's here" for a coordinate — used where directions
 * aren't the point (a viewpoint, a photo spot). */
export function mapsPlaceUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/** Komoot's route planner, centred on the point. Komoot has no documented
 * deep link to an arbitrary coordinate, so this drops the planner there at
 * a sensible zoom and lets the user route from it — best effort, called
 * out as approximate in WORK 10.1. */
export function komootUrl(lat: number, lon: number): string {
  return `https://www.komoot.com/plan/@${lat},${lon},14z`;
}
