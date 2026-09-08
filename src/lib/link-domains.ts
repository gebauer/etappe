/**
 * Friendly labels for the handful of domains that turn up constantly as
 * link blocks — a booking confirmation, a listing, a map link — pasted
 * with no title of their own (author request 2026-09-04). Without this, an
 * untitled Booking.com reservation read as generic "Official site" or the
 * raw URL, which is actively wrong for a link that isn't the destination's
 * own site at all.
 *
 * Host + path rules, evaluated in order (first match wins), the same shape
 * as `osm-tags.ts`'s tag rules — a plain host check isn't enough for
 * `google.com`, which is also search, Drive, Photos, etc.; only a `/maps`
 * path (or the dedicated `maps.` subdomain) means Google Maps.
 */

export interface LinkDomainInfo {
  label: string;
  icon: string;
}

interface Rule extends LinkDomainInfo {
  test: (host: string, path: string) => boolean;
}

const RULES: readonly Rule[] = [
  {
    test: (h, p) =>
      h === 'maps.google.com' ||
      h === 'maps.app.goo.gl' ||
      ((h === 'google.com' || h === 'goo.gl') && p.startsWith('/maps')),
    label: 'Google Maps',
    icon: '📍',
  },
  { test: (h) => h === 'maps.apple.com', label: 'Apple Maps', icon: '📍' },
  {
    test: (h) => h === 'openstreetmap.org',
    label: 'OpenStreetMap',
    icon: '📍',
  },
  {
    test: (h) => h === 'airbnb.com' || h.endsWith('.airbnb.com'),
    label: 'Airbnb',
    icon: '🏠',
  },
  {
    test: (h) => h === 'booking.com' || h.endsWith('.booking.com'),
    label: 'Booking.com',
    icon: '🛏️',
  },
  { test: (h) => h === 'vrbo.com', label: 'Vrbo', icon: '🏠' },
  {
    test: (h) => h === 'expedia.com' || h.endsWith('.expedia.com'),
    label: 'Expedia',
    icon: '✈️',
  },
  { test: (h) => h === 'hotels.com', label: 'Hotels.com', icon: '🛏️' },
  { test: (h) => h === 'agoda.com', label: 'Agoda', icon: '🛏️' },
  {
    test: (h) => h === 'tripadvisor.com' || /^tripadvisor\.[a-z.]+$/.test(h),
    label: 'Tripadvisor',
    icon: '⭐',
  },
  {
    test: (h) => h === 'komoot.com' || h === 'komoot.de',
    label: 'Komoot',
    icon: '🥾',
  },
  { test: (h) => h === 'alltrails.com', label: 'AllTrails', icon: '🥾' },
  { test: (h) => h === 'opentable.com', label: 'OpenTable', icon: '🍽️' },
  { test: (h) => h === 'viator.com', label: 'Viator', icon: '🎫' },
  { test: (h) => h === 'getyourguide.com', label: 'GetYourGuide', icon: '🎫' },
  { test: (h) => h === 'yelp.com', label: 'Yelp', icon: '⭐' },
  {
    test: (h) => h === 'wikipedia.org' || h.endsWith('.wikipedia.org'),
    label: 'Wikipedia',
    icon: '📖',
  },
  { test: (h) => h === 'instagram.com', label: 'Instagram', icon: '📷' },
];

/** A friendly `{ label, icon }` for a recognised domain, or `null` for
 * anything else — the caller's own fallback (a generic label, the raw
 * host, or the URL itself) takes over from there. */
export function linkDomainLabel(
  url: string | undefined | null,
): LinkDomainInfo | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.host.replace(/^www\./, '').toLowerCase();
  const path = parsed.pathname;
  for (const rule of RULES) {
    if (rule.test(host, path)) return { label: rule.label, icon: rule.icon };
  }
  return null;
}
