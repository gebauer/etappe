import { useEffect, useMemo, useRef } from 'react';
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

export function MapPane({
  records,
  result,
  onMapClick,
}: {
  records: TripRecords;
  result: CascadeResult | null;
  onMapClick?: (lat: number, lon: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

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
      void addStopLayer(map, stopFc);
    });

    map.on('click', (ev) => clickRef.current?.(ev.lngLat.lat, ev.lngLat.lng));

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

  // Push new stop markers (composite any new icon/hue images first).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    void (async () => {
      await ensureMarkerImages(map, stopFc);
      const source = map.getSource('stops') as
        maplibregl.GeoJSONSource | undefined;
      source?.setData(stopFc);
    })();
  }, [stopFc]);

  return <div ref={containerRef} className="h-full w-full" />;
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

/** Composite a white ring in the day hue with the black kind glyph, once per
 * (icon, hue). This is the marker pipeline the future album reuses. */
async function ensureMarkerImages(
  map: maplibregl.Map,
  fc: StopFeatureCollection,
) {
  const needed = fc.features.filter(
    (f) => !map.hasImage(f.properties.iconImage),
  );
  if (needed.length === 0) return;
  const atlas = await loadAtlas();
  const S = 56; // device px (displayed at ~28 with pixelRatio 2)
  for (const f of needed) {
    const key = f.properties.iconImage;
    if (map.hasImage(key)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = f.properties.hue;
    ctx.stroke();
    const e = atlas.json[f.properties.icon];
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
    map.addImage(key, ctx.getImageData(0, 0, S, S), { pixelRatio: 2 });
  }
}

const MARKER_LAYOUT = {
  'icon-image': ['get', 'iconImage'],
  'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 1.3, 14, 1.6],
  'icon-allow-overlap': false,
  'symbol-sort-key': ['get', 'sortKey'],
} as unknown as maplibregl.SymbolLayerSpecification['layout'];

async function addStopLayer(map: maplibregl.Map, fc: StopFeatureCollection) {
  await ensureMarkerImages(map, fc);
  if (!map.getSource('stops')) {
    map.addSource('stops', { type: 'geojson', data: fc });
  }
  // Two layers because a zoom expression must be top-level, not nested in a
  // case: accommodation is always visible, other kinds fade in past z7.
  if (!map.getLayer('stops-accom')) {
    map.addLayer({
      id: 'stops-accom',
      type: 'symbol',
      source: 'stops',
      filter: ['==', ['get', 'isAccommodation'], true],
      layout: MARKER_LAYOUT,
    });
  }
  if (!map.getLayer('stops-other')) {
    map.addLayer({
      id: 'stops-other',
      type: 'symbol',
      source: 'stops',
      filter: ['==', ['get', 'isAccommodation'], false],
      layout: MARKER_LAYOUT,
      paint: {
        'icon-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          0,
          6,
          1,
        ] as unknown as maplibregl.ExpressionSpecification,
      },
    });
  }
}
