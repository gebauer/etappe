import maplibregl from 'maplibre-gl';
import { TILE_URL } from './map-config';

/**
 * Offscreen day maps for the print view (WORK 9.3 / BUILD §10: "each day's
 * map is rendered client-side from the MapLibre canvas to PNG and placed in
 * the print flow" — no headless Chrome on the server).
 *
 * One reused hidden map, days rendered one at a time. Fourteen live WebGL
 * contexts would risk the browser's context cap; a single instance whose
 * two sources are swapped per day does not, and the sequential wait on
 * `idle` is also what guarantees the tiles for that frame have actually
 * drawn before `toDataURL` reads the canvas.
 */

export interface DayMapSpec {
  dayId: string;
  /** [lon, lat] for every point that should be in frame — the day's stops
   * and its start point. */
  points: [number, number][];
  /** Routed leg geometries as `[lon, lat]` arrays; the leading leg included. */
  routes: number[][][];
}

const W = 760;
const H = 420;
const ROUTE = 'print-route';
const PTS = 'print-pts';

function emptyFc() {
  return { type: 'FeatureCollection' as const, features: [] };
}

/**
 * Renders each spec to a PNG data URL, calling `onEach` as it finishes one
 * (so the page can fill in maps progressively). A spec with nothing to
 * frame yields `''` — the caller shows a "no map" placeholder. Resolves
 * once every spec is done or `signal` aborts.
 */
export async function renderDayMaps(
  specs: DayMapSpec[],
  onEach: (dayId: string, pngUrl: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (specs.length === 0) return;

  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;height:${H}px;pointer-events:none;`;
  document.body.appendChild(holder);

  const map = new maplibregl.Map({
    container: holder,
    style: TILE_URL,
    interactive: false,
    attributionControl: false,
    preserveDrawingBuffer: true, // required for getCanvas().toDataURL()
    fadeDuration: 0,
    center: [0, 20],
    zoom: 1,
  });

  const cleanup = () => {
    try {
      map.remove();
    } catch {
      /* already gone */
    }
    holder.remove();
  };

  try {
    await new Promise<void>((resolve, reject) => {
      map.once('load', () => resolve());
      map.once('error', () => reject(new Error('basemap failed to load')));
    });
    if (signal?.aborted) return;

    map.addSource(ROUTE, { type: 'geojson', data: emptyFc() });
    map.addSource(PTS, { type: 'geojson', data: emptyFc() });
    map.addLayer({
      id: ROUTE,
      type: 'line',
      source: ROUTE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#1f6feb', 'line-width': 3 },
    });
    map.addLayer({
      id: PTS,
      type: 'circle',
      source: PTS,
      paint: {
        'circle-radius': 5,
        'circle-color': '#1f6feb',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });

    for (const spec of specs) {
      if (signal?.aborted) return;

      const bounds = new maplibregl.LngLatBounds();
      for (const p of spec.points) bounds.extend(p);
      for (const line of spec.routes) {
        for (const p of line) bounds.extend(p as [number, number]);
      }
      if (bounds.isEmpty()) {
        onEach(spec.dayId, '');
        continue;
      }

      (map.getSource(ROUTE) as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: spec.routes.map((coords) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        })),
      });
      (map.getSource(PTS) as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: spec.points.map((coordinates) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates },
          properties: {},
        })),
      });

      map.fitBounds(bounds, { padding: 44, maxZoom: 13, duration: 0 });
      await new Promise<void>((resolve) => map.once('idle', () => resolve()));
      // A short settle: `idle` fires when queued work is done, but the very
      // last raster upload can still be a frame behind on a cold cache.
      await new Promise((r) => setTimeout(r, 180));
      if (signal?.aborted) return;

      onEach(spec.dayId, map.getCanvas().toDataURL('image/png'));
    }
  } finally {
    cleanup();
  }
}
