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
