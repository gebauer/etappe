/**
 * Wikimedia Commons lookup by Wikidata id: P18 (the "image" claim) resolved
 * via Special:FilePath, plus (BUILD §5/§7.2) the Commons extmetadata API for
 * author/licence/source attribution. Both endpoints are public/keyless
 * (like Photon, Overpass), so this runs directly in the browser.
 *
 * Two call shapes for two different needs: `loadThumbnailUrl` (WORK 6.4
 * follow-up) is a lightweight, cached, non-persisted preview for nearby
 * ghost pins — no attribution fetched or stored. `lookupWikimediaPhoto`
 * (WORK 7.2) fetches attribution too and is meant to be persisted onto a
 * real photo block, so it isn't cached — it runs once per capture, not on
 * every re-render the way a map preview would.
 */

const COMMONS_FILEPATH = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
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

function commonsFilePageUrl(filename: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename)}`;
}

async function fetchP18Filename(wikidataId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${WIKIDATA_API}?action=wbgetclaims&entity=${encodeURIComponent(wikidataId)}&property=P18&format=json&origin=*`,
    );
    if (!res.ok) return null;
    return extractP18Filename(await res.json());
  } catch {
    return null;
  }
}

async function fetchThumbnailUrl(
  wikidataId: string,
  widthPx: number,
): Promise<string | null> {
  const filename = await fetchP18Filename(wikidataId);
  return filename ? commonsThumbnailUrl(filename, widthPx) : null;
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

interface CommonsImageInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        missing?: string;
        imageinfo?: Array<{
          extmetadata?: Record<string, { value?: string } | undefined>;
        }>;
      }
    >;
  };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

/** Extracts author/licence from a Commons `prop=imageinfo&iiprop=extmetadata`
 * response — `Artist` comes back as an HTML fragment (often a linked
 * username), stripped to plain text. Pure; unit-tested against a real
 * response shape. Returns null when the file wasn't found or carries
 * neither field. */
export function extractCommonsAttribution(
  json: unknown,
  filename: string,
): { author: string; licence: string; sourceUrl: string } | null {
  if (!json || typeof json !== 'object') return null;
  const data = json as CommonsImageInfoResponse;
  const page = Object.values(data.query?.pages ?? {})[0];
  const meta = page?.imageinfo?.[0]?.extmetadata;
  if (!meta) return null;
  const author = meta.Artist?.value ? stripHtml(meta.Artist.value) : '';
  const licence = meta.LicenseShortName?.value ?? '';
  if (!author && !licence) return null;
  return { author, licence, sourceUrl: commonsFilePageUrl(filename) };
}

async function fetchCommonsAttribution(
  filename: string,
): Promise<{ author: string; licence: string; sourceUrl: string } | null> {
  try {
    const res = await fetch(
      `${COMMONS_API}?action=query&titles=${encodeURIComponent(`File:${filename}`)}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`,
    );
    if (!res.ok) return null;
    return extractCommonsAttribution(await res.json(), filename);
  } catch {
    return null;
  }
}

export interface WikimediaPhoto {
  url: string;
  author: string;
  licence: string;
  sourceUrl: string;
}

/** Full lookup for the photo pipeline (BUILD §5: "where [a capture] returns
 * an OSM wikidata tag, resolve it through the Wikidata API to a Commons
 * image... author, licence and source URL are stored on the block"): P18
 * filename, a display-size URL, and attribution in one call. Null if the
 * entity has no image claim; a missing/unparseable attribution still
 * returns the photo with empty author/licence rather than dropping it. */
export async function lookupWikimediaPhoto(
  wikidataId: string,
): Promise<WikimediaPhoto | null> {
  const filename = await fetchP18Filename(wikidataId);
  if (!filename) return null;
  const attribution = await fetchCommonsAttribution(filename);
  return {
    url: commonsThumbnailUrl(filename, 1200),
    author: attribution?.author ?? '',
    licence: attribution?.licence ?? '',
    sourceUrl: attribution?.sourceUrl ?? commonsFilePageUrl(filename),
  };
}
