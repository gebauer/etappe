/**
 * Paste sniffer (BUILD §6.3). One input, many shapes: decimal or DMS
 * coordinates, a Google Maps URL (coords extracted where present, short links
 * flagged for server resolution), a Komoot URL, or a plain address. Pure and
 * unit-tested; the caller turns the result into a stop (+ keeps the URL).
 */

export type Sniffed =
  | { kind: 'coords'; lat: number; lon: number }
  | { kind: 'mapUrl'; url: string; lat: number; lon: number }
  | { kind: 'shortlink'; url: string }
  | { kind: 'url'; url: string; provider: 'google' | 'komoot' | 'other' }
  | { kind: 'address'; query: string };

const inRange = (lat: number, lon: number) =>
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

/** "64.1466, -21.9426" or "64.1466 -21.9426". */
function parseDecimal(text: string): { lat: number; lon: number } | null {
  const m =
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return inRange(lat, lon) ? { lat, lon } : null;
}

/** e.g. 64°08'48.0"N 21°56'32.0"W */
function parseDMS(text: string): { lat: number; lon: number } | null {
  const re =
    /(\d+)[°\s]+(\d+)['′\s]+([\d.]+)["″]?\s*([NSns])[\s,]+(\d+)[°\s]+(\d+)['′\s]+([\d.]+)["″]?\s*([EWew])/;
  const m = re.exec(text);
  if (!m) return null;
  const dms = (d: string, min: string, s: string, hemi: string) => {
    const val = Number(d) + Number(min) / 60 + Number(s) / 3600;
    return /[SsWw]/.test(hemi) ? -val : val;
  };
  const lat = dms(m[1]!, m[2]!, m[3]!, m[4]!);
  const lon = dms(m[5]!, m[6]!, m[7]!, m[8]!);
  return inRange(lat, lon) ? { lat, lon } : null;
}

function extractGoogleCoords(url: string): { lat: number; lon: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // .../@64.14,-21.94,15z
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // place data
    /[?&](?:q|query|ll|center|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/, // q=lat,lon
  ];
  for (const re of patterns) {
    const m = re.exec(url);
    if (m) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (inRange(lat, lon)) return { lat, lon };
    }
  }
  return null;
}

export function sniffPaste(text: string): Sniffed {
  const trimmed = text.trim();

  const dec = parseDecimal(trimmed);
  if (dec) return { kind: 'coords', ...dec };
  const dms = parseDMS(trimmed);
  if (dms) return { kind: 'coords', ...dms };

  if (/^https?:\/\//i.test(trimmed)) {
    const url = trimmed;
    if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) {
      return { kind: 'shortlink', url };
    }
    if (/(google\.[a-z.]+\/maps|maps\.google\.)/i.test(url)) {
      const coords = extractGoogleCoords(url);
      return coords
        ? { kind: 'mapUrl', url, ...coords }
        : { kind: 'url', url, provider: 'google' };
    }
    if (/komoot\./i.test(url)) return { kind: 'url', url, provider: 'komoot' };
    return { kind: 'url', url, provider: 'other' };
  }

  return { kind: 'address', query: trimmed };
}
