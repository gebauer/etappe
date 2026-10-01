import type { Map as MapLibreMap } from 'maplibre-gl';

/** The basemap style URL, shared by the live map (`MapPane`) and the
 * offscreen snapshot map the print view builds (`print-map.ts`). Kept in
 * one place so a self-hosted `VITE_TILE_URL` reaches both. */
export const TILE_URL =
  import.meta.env.VITE_TILE_URL ??
  'https://tiles.openfreemap.org/styles/liberty';

/**
 * Terrain shading (WORK 35) — a hillshade layer over the basemap, so a
 * mountain pass looks like one.
 *
 * Deliberately not MapLibre's 3D `setTerrain`: pitching the camera floats
 * pins off their coordinates, changes how `fitBounds` frames a day, and
 * costs the map its reading as a flat diagram — which is what the day
 * colours and the route lines are drawn as. Shading gives the landscape
 * without giving any of that up.
 *
 * The DEM is the AWS Terrain Tiles open dataset: no key, `terrarium`
 * encoding, CORS open. Capped at z13 — hillshade overzooms gracefully, and
 * beyond that the screen holds a road rather than a landscape, so the extra
 * tiles would be fetched to show nothing.
 */
const DEM_TILES =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const DEM_SOURCE = 'etappe-dem';
const HILLSHADE_LAYER = 'etappe-hillshade';

/** Hillshade over the basemap's labels greys out place names, so it goes
 * under the style's first symbol layer. Etappe's own layers need no such
 * care — they are added without a `beforeId` and sit on top of everything. */
function firstLabelLayer(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
}

/**
 * Brings the hillshade in or takes it out, to match the preference. Source
 * and layer exist only while it is on: switching off should cost no DEM
 * requests on a phone's mobile data, and should take the elevation credit
 * out of the attribution control rather than crediting data nothing is
 * drawing. Safe to call repeatedly — it compares against what is there.
 *
 * Call it only once the style has loaded; before that there is no layer
 * list to insert into.
 */
export function applyHillshade(map: MapLibreMap, on: boolean): void {
  if (on === !!map.getLayer(HILLSHADE_LAYER)) return;
  if (!on) {
    map.removeLayer(HILLSHADE_LAYER);
    map.removeSource(DEM_SOURCE);
    return;
  }
  map.addSource(DEM_SOURCE, {
    type: 'raster-dem',
    tiles: [DEM_TILES],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 13,
    attribution:
      '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Terrain Tiles</a>',
  });
  map.addLayer(
    {
      id: HILLSHADE_LAYER,
      type: 'hillshade',
      source: DEM_SOURCE,
      paint: {
        // Restrained on purpose: the basemap is light and the routes are
        // saturated, so shading loud enough to read on its own would be
        // competing with the thing the map is for.
        'hillshade-exaggeration': 0.3,
        'hillshade-shadow-color': '#5b4b3c',
        'hillshade-highlight-color': '#ffffff',
        // The ridge accent fights the road casings of a vector basemap.
        'hillshade-accent-color': 'rgba(0, 0, 0, 0)',
      },
    },
    firstLabelLayer(map),
  );
}

/**
 * Whether to shade, per browser rather than per account — the same class of
 * thing as `etappe.wishlistPinMode`, a viewer's display choice and not trip
 * data. Per browser also means the desktop can plan in relief while the
 * phone stays plain and spends no mobile data on DEM tiles mid-trip.
 *
 * On by default (author, 2026-10-01).
 */
const HILLSHADE_KEY = 'etappe.hillshade';

const listeners = new Set<() => void>();

export function readHillshade(): boolean {
  try {
    return localStorage.getItem(HILLSHADE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Persists, then wakes every mounted reader — the Account panel opens both
 * over the trip list and over the editor, and in the second case the map
 * behind it has to follow without a prop threaded through `TripEditor`. */
export function setHillshade(on: boolean): void {
  try {
    localStorage.setItem(HILLSHADE_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode — the toggle still holds for this session */
  }
  listeners.forEach((fn) => fn());
}

export function subscribeHillshade(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
