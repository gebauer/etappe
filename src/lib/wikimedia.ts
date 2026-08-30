/**
 * Wikimedia Commons thumbnail lookup by Wikidata id (WORK 6.4 follow-up):
 * P18 (the "image" claim) resolved via Special:FilePath to a thumbnail URL.
 * A lightweight, non-persisted preview for nearby ghost pins only — this is
 * not BUILD §7.2's photo pipeline. No attribution is stored or shown; if a
 * ghost pin gets promoted to a stop, the photo doesn't come with it. Both
 * endpoints are public/keyless (like Photon, Overpass), so this runs
 * directly in the browser.
 */

const COMMONS_FILEPATH = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

interface WikidataClaimsResponse {
  claims?: {
    P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }>;
  };
}

/** Extracts the Commons filename from a wbgetclaims?property=P18 response,
 * or null if the entity has no image claim. Pure; unit-tested. */
export function extractP18Filename(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const data = json as WikidataClaimsResponse;
  return data.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
}

/** Special:FilePath redirects to the actual file, resized, with CORS
 * enabled — verified against the live endpoint before relying on it for
 * canvas compositing (a tainted canvas would throw on getImageData). */
export function commonsThumbnailUrl(filename: string, widthPx: number): string {
  return `${COMMONS_FILEPATH}${encodeURIComponent(filename)}?width=${widthPx}`;
}

async function fetchThumbnailUrl(
  wikidataId: string,
  widthPx: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${WIKIDATA_API}?action=wbgetclaims&entity=${encodeURIComponent(wikidataId)}&property=P18&format=json&origin=*`,
    );
    if (!res.ok) return null;
    const filename = extractP18Filename(await res.json());
    return filename ? commonsThumbnailUrl(filename, widthPx) : null;
  } catch {
    return null;
  }
}

const cache = new Map<string, Promise<string | null>>();

/** Thumbnail URL for a Wikidata id's P18 image, or null if it has none or
 * the lookup fails. In-memory cache keyed by id+width — the same POI can be
 * requested again across re-renders or a radius change, and a miss is
 * cached too so it isn't retried every time. */
export function loadThumbnailUrl(
  wikidataId: string,
  widthPx = 96,
): Promise<string | null> {
  const key = `${wikidataId}:${widthPx}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchThumbnailUrl(wikidataId, widthPx);
    cache.set(key, p);
  }
  return p;
}
