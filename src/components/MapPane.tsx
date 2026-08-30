import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  buildLegFeatures,
  buildStopFeatures,
  type StopFeatureCollection,
} from '../lib/map-features';
import type { TripRecords } from '../lib/pb-trip-doc';
import type { CascadeResult } from '../lib/cascade';

const TILE_URL =
  import.meta.env.VITE_TILE_URL ??
  'https://tiles.openfreemap.org/styles/liberty';

const STOP_LAYERS = ['stops-accom', 'stops-other'];

// Non-accommodation markers fade in past z6 (the trip-overview zoom).
const TIER_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  0,
  6,
  1,
] as unknown as maplibregl.ExpressionSpecification;

// Line width grows with zoom; shared by every leg layer.
const WIDTH = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  1.5,
  10,
  3,
  14,
  6,
] as unknown as maplibregl.ExpressionSpecification;

// Crossfade: flat day hue when zoomed out, alternating shades when zoomed in.
const FLAT_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  1,
  10,
  0,
] as unknown as maplibregl.ExpressionSpecification;
const SHADE_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  0,
  10,
  1,
] as unknown as maplibregl.ExpressionSpecification;

export type MarkerMode = 'auto' | 'icons' | 'thumbnails';

export function MapPane({
  records,
  result,
  onMapClick,
  onSelectStop,
  onHoverStop,
  hoveredStopId,
  focusDayId,
}: {
  records: TripRecords;
  result: CascadeResult | null;
  onMapClick?: (lat: number, lon: number) => void;
  onSelectStop?: (stopId: string) => void;
  onHoverStop?: (stopId: string | null) => void;
  hoveredStopId?: string | null;
  focusDayId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const selectRef = useRef(onSelectStop);
  selectRef.current = onSelectStop;
  const hoverRef = useRef(onHoverStop);
  hoverRef.current = onHoverStop;
  const [markerMode, setMarkerMode] = useState<MarkerMode>('auto');

  const fc = useMemo(
    () => buildLegFeatures(records, result),
    [records, result],
  );
  const stopFc = useMemo(() => buildStopFeatures(records), [records]);
  const fcRef = useRef(fc);
  fcRef.current = fc;
  const stopFcRef = useRef(stopFc);
  stopFcRef.current = stopFc;
  const fittedRef = useRef(false);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const prevHoverRef = useRef<string | null>(null);
  const atlasRef = useRef<{
    img: HTMLImageElement;
    json: Record<string, SpriteEntry>;
  } | null>(null);

  // Frame the whole trip once, when features first arrive. Not on every edit,
  // so the map stays where the user left it. (Fit-to-day is 5.4.)
  function maybeFit(map: maplibregl.Map) {
    if (fittedRef.current) return;
    const bounds = computeBounds(fcRef.current, stopFcRef.current);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 400 });
      fittedRef.current = true;
    }
  }

  // Init once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_URL,
      center: [-19, 64.9],
      zoom: 5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    );

    map.on('load', () => {
      map.addSource('legs', { type: 'geojson', data: fc });
      map.addLayer({
        id: 'legs-flat',
        type: 'line',
        source: 'legs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'flat'],
          'line-width': WIDTH,
          'line-opacity': FLAT_OPACITY,
        },
      });
      map.addLayer({
        id: 'legs-shade',
        type: 'line',
        source: 'legs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'shade'],
          'line-width': WIDTH,
          'line-opacity': SHADE_OPACITY,
        },
      });
      map.addLayer({
        id: 'legs-dusk',
        type: 'line',
        source: 'legs',
        filter: ['==', ['get', 'afterDusk'], true],
        paint: {
          'line-color': ['get', 'shade'],
          'line-width': WIDTH,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'legs-arrows',
        type: 'symbol',
        source: 'legs',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 90,
          'text-field': '▸',
          'text-size': 14,
          'text-keep-upright': false,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#334155',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        },
      });
      loadedRef.current = true;
      maybeFit(map);

      // Composite each marker image on demand (day hue ring + kind glyph) when
      // the symbol layer first references it — robust to timing/failures.
      map.on('styleimagemissing', (e) => {
        const atlas = atlasRef.current;
        if (!atlas || !e.id.startsWith('m:') || map.hasImage(e.id)) return;
        try {
          compositeMarker(map, atlas, e.id);
        } catch (err) {
          console.error('marker composite failed for', e.id, err);
        }
      });

      loadAtlas()
        .then((atlas) => {
          atlasRef.current = atlas;
          if (!map.getSource('stops')) {
            map.addSource('stops', {
              type: 'geojson',
              data: stopFcRef.current,
              promoteId: 'stopId',
            });
          }
          addMarkerLayers(map);
          maybeFit(map);
        })
        .catch((err) => console.error('sprite atlas failed to load', err));
    });

    const stopsUnder = (point: maplibregl.Point): string | null => {
      const layers = STOP_LAYERS.filter((l) => map.getLayer(l));
      if (layers.length === 0) return null;
      const hits = map.queryRenderedFeatures(point, { layers });
      return (hits[0]?.properties?.stopId as string | undefined) ?? null;
    };

    // Click a marker to select its stop; click empty map to drop a stop.
    map.on('click', (ev) => {
      const id = stopsUnder(ev.point);
      if (id) selectRef.current?.(id);
      else clickRef.current?.(ev.lngLat.lat, ev.lngLat.lng);
    });

    map.on('mousemove', (ev) => {
      const id = stopsUnder(ev.point);
      map.getCanvas().style.cursor = id ? 'pointer' : '';
      hoverRef.current?.(id);
    });
    map.on('mouseout', () => hoverRef.current?.(null));

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push new data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('legs') as
      maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(fc);
      maybeFit(map);
    }
  }, [fc]);

  // Push new stop markers; missing images composite via styleimagemissing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('stops') as
      maplibregl.GeoJSONSource | undefined;
    source?.setData(stopFc);
  }, [stopFc]);

  // Reflect the externally hovered stop (e.g. hovering a timeline row) as a
  // lifted marker via feature-state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getSource('stops')) return;
    const prev = prevHoverRef.current;
    if (prev && prev !== hoveredStopId) {
      map.setFeatureState({ source: 'stops', id: prev }, { hover: false });
    }
    if (hoveredStopId) {
      map.setFeatureState(
        { source: 'stops', id: hoveredStopId },
        { hover: true },
      );
    }
    prevHoverRef.current = hoveredStopId ?? null;
  }, [hoveredStopId]);

  // Fit the map to a day's stops when that day is selected ("move on select").
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !focusDayId) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const s of recordsRef.current.stops) {
      if (s.day === focusDayId && s.lat && s.lon) bounds.extend([s.lon, s.lat]);
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 500 });
    }
  }, [focusDayId]);

  // The auto/icons/thumbnails control overrides the zoom tier for non-
  // accommodation markers (thumbnails behaves as icons until photos exist).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer('stops-other')) return;
    map.setPaintProperty(
      'stops-other',
      'icon-opacity',
      markerMode === 'auto' ? TIER_OPACITY : 1,
    );
  }, [markerMode]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute left-2 top-2 flex overflow-hidden rounded border border-slate-300 bg-white text-xs shadow">
        {(['auto', 'icons', 'thumbnails'] as MarkerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMarkerMode(m)}
            className={`px-2 py-1 ${markerMode === m ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function computeBounds(
  legFc: ReturnType<typeof buildLegFeatures>,
  stopFc: StopFeatureCollection,
): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  for (const f of legFc.features) {
    for (const [lon, lat] of f.geometry.coordinates) {
      if (typeof lon === 'number' && typeof lat === 'number') {
        bounds.extend([lon, lat]);
      }
    }
  }
  for (const f of stopFc.features) {
    bounds.extend(f.geometry.coordinates);
  }
  return bounds;
}

// --- stop marker images (offscreen-canvas composite of ring + kind icon) ---

interface SpriteEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio: number;
}

let atlasPromise: Promise<{
  img: HTMLImageElement;
  json: Record<string, SpriteEntry>;
}> | null = null;

function loadAtlas() {
  if (!atlasPromise) {
    atlasPromise = Promise.all([
      new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = '/sprites/sprite@2x.png';
      }),
      fetch('/sprites/sprite@2x.json').then(
        (r) => r.json() as Promise<Record<string, SpriteEntry>>,
      ),
    ]).then(([img, json]) => ({ img, json }));
  }
  return atlasPromise;
}

/** Composite one marker image ("m:<icon>:<hue>"): a white ring in the day hue
 * with the black kind glyph. Called on demand via styleimagemissing. */
function compositeMarker(
  map: maplibregl.Map,
  atlas: { img: HTMLImageElement; json: Record<string, SpriteEntry> },
  id: string,
) {
  const parts = id.split(':'); // ["m", icon, "#rrggbb"]
  const icon = parts[1] ?? 'marker';
  const hue = parts[2] ?? '#64748b';
  const S = 56; // device px (displayed at ~28 with pixelRatio 2)
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = hue;
  ctx.stroke();
  const e = atlas.json[icon];
  if (e) {
    const t = S * 0.6;
    ctx.drawImage(
      atlas.img,
      e.x,
      e.y,
      e.width,
      e.height,
      (S - t) / 2,
      (S - t) / 2,
      t,
      t,
    );
  }
  map.addImage(id, ctx.getImageData(0, 0, S, S), { pixelRatio: 2 });
}

const MARKER_LAYOUT = {
  'icon-image': ['get', 'iconImage'],
  'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 1.3, 14, 1.6],
  'icon-allow-overlap': false,
  'symbol-sort-key': ['get', 'sortKey'],
} as unknown as maplibregl.SymbolLayerSpecification['layout'];

// Hover lift via icon-translate (a paint property — feature-state is only
// allowed in paint, not layout, which is why icon-size can't use it).
const HOVER_LIFT = [
  'case',
  ['boolean', ['feature-state', 'hover'], false],
  ['literal', [0, -5]],
  ['literal', [0, 0]],
] as unknown as maplibregl.ExpressionSpecification;

function addMarkerLayers(map: maplibregl.Map) {
  // Two layers because a zoom expression must be top-level, not nested in a
  // case: accommodation is always visible, other kinds fade in past z6.
  if (!map.getLayer('stops-accom')) {
    map.addLayer({
      id: 'stops-accom',
      type: 'symbol',
      source: 'stops',
      filter: ['==', ['get', 'isAccommodation'], true],
      layout: MARKER_LAYOUT,
      paint: { 'icon-translate': HOVER_LIFT },
    });
  }
  if (!map.getLayer('stops-other')) {
    map.addLayer({
      id: 'stops-other',
      type: 'symbol',
      source: 'stops',
      filter: ['==', ['get', 'isAccommodation'], false],
      layout: MARKER_LAYOUT,
      paint: { 'icon-opacity': TIER_OPACITY, 'icon-translate': HOVER_LIFT },
    });
  }
}
