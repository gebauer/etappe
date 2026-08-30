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
import type { StopsResponse } from '../types/pb';

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

// Shared by every routed-leg layer so the manual dashed connector (drawn by
// its own layer) never doubles up with the day-hue styling.
const NOT_MANUAL = ['!=', ['get', 'manual'], true];
const NOT_MANUAL_FILTER =
  NOT_MANUAL as unknown as maplibregl.FilterSpecification;
const AFTER_DUSK_AND_ROUTED = [
  'all',
  ['==', ['get', 'afterDusk'], true],
  NOT_MANUAL,
] as unknown as maplibregl.FilterSpecification;

export type MarkerMode = 'auto' | 'icons' | 'thumbnails';

export function MapPane({
  records,
  result,
  onMapClick,
  onSelectStop,
  onHoverStop,
  hoveredStopId,
  focusDayId,
  flyTo,
  selectedStop,
  onDragStop,
  onDragAccessPoint,
}: {
  records: TripRecords;
  result: CascadeResult | null;
  onMapClick?: (lat: number, lon: number) => void;
  onSelectStop?: (stopId: string) => void;
  onHoverStop?: (stopId: string | null) => void;
  hoveredStopId?: string | null;
  focusDayId?: string | null;
  flyTo?: { lat: number; lon: number; nonce: number } | null;
  selectedStop?: StopsResponse | null;
  onDragStop?: (stopId: string, lat: number, lon: number) => void;
  onDragAccessPoint?: (stopId: string, lat: number, lon: number) => void;
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
  const dragStopRef = useRef(onDragStop);
  dragStopRef.current = onDragStop;
  const dragAccessRef = useRef(onDragAccessPoint);
  dragAccessRef.current = onDragAccessPoint;
  const selectedStopIdRef = useRef<string | null>(selectedStop?.id ?? null);
  selectedStopIdRef.current = selectedStop?.id ?? null;
  const poiMarkerRef = useRef<maplibregl.Marker | null>(null);
  const poiMarkerStopIdRef = useRef<string | null>(null);
  const accessMarkerRef = useRef<maplibregl.Marker | null>(null);
  const draggingRef = useRef(false);
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
      map.addSource('legs', { type: 'geojson', data: fcRef.current });
      map.addLayer({
        id: 'legs-flat',
        type: 'line',
        source: 'legs',
        filter: NOT_MANUAL_FILTER,
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
        filter: NOT_MANUAL_FILTER,
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
        filter: AFTER_DUSK_AND_ROUTED,
        paint: {
          'line-color': ['get', 'shade'],
          'line-width': WIDTH,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
        },
      });
      // Legs with no route geometry (manual, or routing failed): a thin grey
      // dashed line just shows the two stops are connected, deliberately not
      // day-coloured so it reads as "not a computed route".
      map.addLayer({
        id: 'legs-manual',
        type: 'line',
        source: 'legs',
        filter: ['==', ['get', 'manual'], true],
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#94a3b8',
          'line-width': 2,
          'line-dasharray': [1, 2],
          'line-opacity': 0.8,
        },
      });
      // No text-glyph direction arrows on the legs: the basemap's glyph
      // endpoint 404s on the arrow range, and a failed symbol glyph aborts the
      // whole source's tile in the worker — which silently drops the leg lines
      // too. Direction arrows via a sprite icon are tracked in ToDo.md.
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
      poiMarkerRef.current?.remove();
      poiMarkerRef.current = null;
      accessMarkerRef.current?.remove();
      accessMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
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

  // Highlight the hovered stop with a ring (a filtered circle layer — reliable,
  // unlike feature-state which several paint props reject).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer('stops-hover')) return;
    map.setFilter('stops-hover', [
      '==',
      ['get', 'stopId'],
      hoveredStopId ?? '',
    ]);
  }, [hoveredStopId]);

  // Fly to a point on demand (inspector zoom button).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !flyTo) return;
    map.flyTo({
      center: [flyTo.lon, flyTo.lat],
      zoom: Math.max(map.getZoom(), 13),
      duration: 600,
    });
  }, [flyTo]);

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

  // Draggable marker for the selected stop only: dragging every marker at
  // once would mean ditching the fast symbol-layer rendering BUILD §5 chose
  // for potentially many stops. It's the stop's real pin (same shape/icon/
  // hue as the GL layer, built from the same atlas) so dragging it reads as
  // moving the actual marker, not a generic overlay — the GL layer hides
  // this one stop's icon underneath while its DOM twin is shown. Its access
  // point, once set, gets a second draggable pin with a car glyph instead.
  // Dropping calls back with the new point; the caller re-routes
  // automatically, the same "did it resolve?" feedback the click-to-place
  // flow already gives — no live snap-to-road.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const selId = selectedStop?.id ?? '';
    map.setFilter('stops-accom', [
      'all',
      ['==', ['get', 'isAccommodation'], true],
      ['!=', ['get', 'stopId'], selId],
    ] as unknown as maplibregl.FilterSpecification);
    map.setFilter('stops-other', [
      'all',
      ['==', ['get', 'isAccommodation'], false],
      ['!=', ['get', 'stopId'], selId],
    ] as unknown as maplibregl.FilterSpecification);

    if (draggingRef.current) return;

    if (selectedStop?.lat && selectedStop?.lon) {
      if (
        !poiMarkerRef.current ||
        poiMarkerStopIdRef.current !== selectedStop.id
      ) {
        poiMarkerRef.current?.remove();
        const feature = stopFcRef.current.features.find(
          (f) => f.properties.stopId === selectedStop.id,
        );
        const atlas = atlasRef.current;
        const element = buildPinElement(
          feature?.properties.hue ?? '#0284c7',
          (ctx) => {
            if (atlas && feature)
              drawAtlasGlyph(ctx, atlas, feature.properties.icon);
          },
        );
        const marker = new maplibregl.Marker({
          element,
          anchor: 'bottom',
          draggable: true,
        })
          .setLngLat([selectedStop.lon, selectedStop.lat])
          .addTo(map);
        marker.on('dragstart', () => {
          draggingRef.current = true;
        });
        marker.on('dragend', () => {
          draggingRef.current = false;
          const id = selectedStopIdRef.current;
          const { lat, lng } = marker.getLngLat();
          if (id) dragStopRef.current?.(id, lat, lng);
        });
        poiMarkerRef.current = marker;
        poiMarkerStopIdRef.current = selectedStop.id;
      } else {
        poiMarkerRef.current.setLngLat([selectedStop.lon, selectedStop.lat]);
      }
    } else {
      poiMarkerRef.current?.remove();
      poiMarkerRef.current = null;
      poiMarkerStopIdRef.current = null;
    }

    if (selectedStop?.access_lat && selectedStop?.access_lon) {
      if (!accessMarkerRef.current) {
        const element = buildPinElement('#f59e0b', (ctx) =>
          drawEmojiGlyph(ctx, '🚗'),
        );
        const marker = new maplibregl.Marker({
          element,
          anchor: 'bottom',
          draggable: true,
        })
          .setLngLat([selectedStop.access_lon, selectedStop.access_lat])
          .addTo(map);
        marker.on('dragstart', () => {
          draggingRef.current = true;
        });
        marker.on('dragend', () => {
          draggingRef.current = false;
          const id = selectedStopIdRef.current;
          const { lat, lng } = marker.getLngLat();
          if (id) dragAccessRef.current?.(id, lat, lng);
        });
        accessMarkerRef.current = marker;
      } else {
        accessMarkerRef.current.setLngLat([
          selectedStop.access_lon,
          selectedStop.access_lat,
        ]);
      }
    } else {
      accessMarkerRef.current?.remove();
      accessMarkerRef.current = null;
    }
  }, [
    selectedStop?.id,
    selectedStop?.lat,
    selectedStop?.lon,
    selectedStop?.access_lat,
    selectedStop?.access_lon,
  ]);

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

// Pin geometry, shared by the GL symbol images (compositeMarker) and the DOM
// drag markers (buildPinElement) so both read as the same shape. Device px at
// pixelRatio 2. The tip — not the centre — is the exact coordinate, which is
// the point of a pin over a badge: dragging has an unambiguous anchor pixel.
const PIN_W = 44;
const PIN_H = 60;
const HEAD_R = 15;
const HEAD_CY = 17;
const GLYPH_SIZE = 19;
const PIN_CSS_W = PIN_W / 2;
const PIN_CSS_H = PIN_H / 2;

/** Draws the pin silhouette (hue tail + white ring head) with no glyph. */
function drawPinBase(ctx: CanvasRenderingContext2D, hue: string) {
  const cx = PIN_W / 2;
  ctx.beginPath();
  ctx.moveTo(cx - HEAD_R * 0.8, HEAD_CY + HEAD_R * 0.55);
  ctx.lineTo(cx + HEAD_R * 0.8, HEAD_CY + HEAD_R * 0.55);
  ctx.lineTo(cx, PIN_H - 1);
  ctx.closePath();
  ctx.fillStyle = hue;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, HEAD_CY, HEAD_R, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = hue;
  ctx.stroke();
}

/** Draws a taxonomy sprite glyph centred in the pin's head. */
function drawAtlasGlyph(
  ctx: CanvasRenderingContext2D,
  atlas: { img: HTMLImageElement; json: Record<string, SpriteEntry> },
  icon: string,
) {
  const e = atlas.json[icon];
  if (!e) return;
  const cx = PIN_W / 2;
  ctx.drawImage(
    atlas.img,
    e.x,
    e.y,
    e.width,
    e.height,
    cx - GLYPH_SIZE / 2,
    HEAD_CY - GLYPH_SIZE / 2,
    GLYPH_SIZE,
    GLYPH_SIZE,
  );
}

/** Draws a plain glyph (e.g. an emoji) centred in the pin's head — used for
 * markers that aren't a taxonomy kind, like the access-point car. */
function drawEmojiGlyph(ctx: CanvasRenderingContext2D, emoji: string) {
  ctx.font = `${GLYPH_SIZE}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, PIN_W / 2, HEAD_CY + 1);
}

/** Composite one marker image ("m:<icon>:<hue>") for the GL symbol layer.
 * Called on demand via styleimagemissing. */
function compositeMarker(
  map: maplibregl.Map,
  atlas: { img: HTMLImageElement; json: Record<string, SpriteEntry> },
  id: string,
) {
  const parts = id.split(':'); // ["m", icon, "#rrggbb"]
  const icon = parts[1] ?? 'marker';
  const hue = parts[2] ?? '#64748b';
  const canvas = document.createElement('canvas');
  canvas.width = PIN_W;
  canvas.height = PIN_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawPinBase(ctx, hue);
  drawAtlasGlyph(ctx, atlas, icon);
  map.addImage(id, ctx.getImageData(0, 0, PIN_W, PIN_H), { pixelRatio: 2 });
}

/** Builds a standalone pin canvas for a draggable DOM marker — same shape as
 * the GL-rendered pins, so dragging the selected stop's marker looks like
 * dragging its real icon rather than a generic overlay. */
function buildPinElement(
  hue: string,
  drawGlyph: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PIN_W;
  canvas.height = PIN_H;
  canvas.style.width = `${PIN_CSS_W}px`;
  canvas.style.height = `${PIN_CSS_H}px`;
  canvas.style.cursor = 'grab';
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawPinBase(ctx, hue);
    drawGlyph(ctx);
  }
  return canvas;
}

const MARKER_LAYOUT = {
  'icon-image': ['get', 'iconImage'],
  'icon-anchor': 'bottom',
  'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 1.3, 14, 1.6],
  'icon-allow-overlap': false,
  'symbol-sort-key': ['get', 'sortKey'],
} as unknown as maplibregl.SymbolLayerSpecification['layout'];

const HOVER_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  10,
  10,
  16,
  14,
  22,
] as unknown as maplibregl.ExpressionSpecification;

function addMarkerLayers(map: maplibregl.Map) {
  // Hover highlight: a ring under the markers, shown for the hovered stop via
  // setFilter. A plain circle layer (no data-driven paint) — reliable.
  if (!map.getLayer('stops-hover')) {
    map.addLayer({
      id: 'stops-hover',
      type: 'circle',
      source: 'stops',
      filter: ['==', ['get', 'stopId'], ''],
      paint: {
        'circle-radius': HOVER_RADIUS,
        'circle-color': '#0ea5e9',
        'circle-opacity': 0.2,
        'circle-stroke-color': '#0284c7',
        'circle-stroke-width': 2,
      },
    });
  }
  // Two layers because a zoom expression must be top-level, not nested in a
  // case: accommodation is always visible, other kinds fade in past z6.
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
      paint: { 'icon-opacity': TIER_OPACITY },
    });
  }
}
