/**
 * Deep links out to a map app (WORK 10.1 / 10.4 / 19.4).
 *
 * **Why every link is a plain HTTPS URL to one named app.** There is no
 * cross-app way to hand a routing app both ends of a journey. The Android
 * intents that dispatch to whatever routing app the user set as default
 * (`geo:`, `google.navigation:`) are *destination-only* — they assume you
 * are standing at the origin. Passing an origin, or a multi-stop day,
 * needs an app-specific URL. So the app the links open is a per-user
 * setting (`users.link_out`) rather than something the platform decides.
 *
 * Pure string builders — no SDK, no key.
 */

export type LinkOut = 'google' | 'apple' | 'here' | 'osm';

export interface Point {
  lat: number;
  lon: number;
}

const ll = (p: Point) => `${p.lat},${p.lon}`;

/** Google's URL API takes at most 9 intermediate waypoints. */
const GOOGLE_MAX_WAYPOINTS = 9;

function travelmode(mode?: string): string {
  return mode === 'walk'
    ? 'walking'
    : mode === 'bike'
      ? 'bicycling'
      : mode === 'flight' || mode === 'ferry'
        ? 'transit'
        : 'driving';
}

/** A single point — "show me this place", not a route. */
export function placeUrl(app: LinkOut, p: Point): string {
  switch (app) {
    case 'apple':
      return `https://maps.apple.com/?ll=${ll(p)}&q=${ll(p)}`;
    case 'here':
      return `https://wego.here.com/?map=${p.lat},${p.lon},15`;
    case 'osm':
      return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=15/${p.lat}/${p.lon}`;
    default:
      return `https://www.google.com/maps/search/?api=1&query=${ll(p)}`;
  }
}

/**
 * A route through `points` (at least two: origin … destination).
 *
 * `truncated` says the app could not take every point — Google's cap is
 * the binding one. The caller tells the user rather than silently dropping
 * stops from their day.
 */
export function routeUrl(
  app: LinkOut,
  points: Point[],
  mode?: string,
): { url: string; truncated: number } | null {
  if (points.length < 2) return null;

  if (app === 'google') {
    const origin = points[0]!;
    const destination = points[points.length - 1]!;
    const middle = points.slice(1, -1);
    const kept = middle.slice(0, GOOGLE_MAX_WAYPOINTS);
    const parts = [
      'api=1',
      `origin=${ll(origin)}`,
      `destination=${ll(destination)}`,
      `travelmode=${travelmode(mode)}`,
    ];
    if (kept.length) {
      parts.push(`waypoints=${kept.map(ll).join('|')}`);
    }
    return {
      url: `https://www.google.com/maps/dir/?${parts.join('&')}`,
      truncated: middle.length - kept.length,
    };
  }

  if (app === 'apple') {
    // Apple chains extra stops with `+to:`. Documented loosely and handled
    // inconsistently across platforms, so it is best-effort beyond A→B.
    const [origin, ...rest] = points;
    const daddr = rest.map(ll).join('+to:');
    const flag = mode === 'walk' ? 'w' : mode === 'bike' ? 'b' : 'd';
    return {
      url: `https://maps.apple.com/?saddr=${ll(origin!)}&daddr=${daddr}&dirflg=${flag}`,
      truncated: 0,
    };
  }

  if (app === 'here') {
    const kind = mode === 'walk' ? 'walk' : mode === 'bike' ? 'bicycle' : 'drive';
    return {
      url: `https://wego.here.com/directions/${kind}/${points.map(ll).join('/')}`,
      truncated: 0,
    };
  }

  // OpenStreetMap's own directions page, FOSSGIS-hosted engines.
  const engine =
    mode === 'walk'
      ? 'fossgis_osrm_foot'
      : mode === 'bike'
        ? 'fossgis_osrm_bike'
        : 'fossgis_osrm_car';
  return {
    url: `https://www.openstreetmap.org/directions?engine=${engine}&route=${points
      .map((p) => `${p.lat},${p.lon}`)
      .join(';')}`,
    truncated: 0,
  };
}

/**
 * Directions to a point from wherever the user is standing — the card's
 * "take me there", as opposed to a planned leg between two known stops.
 *
 * Only Google and OSM let you leave the origin open; Apple accepts a bare
 * `daddr`. HERE WeGo has no documented "from my location" URL form, so it
 * gets the place instead of a route rather than a link that half-works.
 */
export function directionsUrl(app: LinkOut, to: Point, mode?: string): string {
  switch (app) {
    case 'apple':
      return `https://maps.apple.com/?daddr=${ll(to)}&dirflg=${
        mode === 'walk' ? 'w' : mode === 'bike' ? 'b' : 'd'
      }`;
    case 'here':
      return placeUrl('here', to);
    case 'osm':
      return `https://www.openstreetmap.org/directions?route=;${ll(to)}`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${ll(to)}&travelmode=${travelmode(mode)}`;
  }
}

/** Convenience for the common two-point case (a leg). */
export function legUrl(
  app: LinkOut,
  from: Point,
  to: Point,
  mode?: string,
): string | null {
  return routeUrl(app, [from, to], mode)?.url ?? null;
}
