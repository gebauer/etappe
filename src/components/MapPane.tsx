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
import {
  TIER_OPACITY,
  loadAtlas,
  compositeMarker,
  addMarkerLayers,
  buildPinElement,
  drawAtlasGlyph,
  drawEmojiGlyph,
  compositePhotoCircle,
  type SpriteEntry,
} from '../lib/map-markers';
import { queryNearby, type NearbyPoi } from '../lib/overpass';
import { categoryColor } from '../lib/map-colors';
import { loadThumbnailUrl } from '../lib/wikimedia';

const TILE_URL =
  import.meta.env.VITE_TILE_URL ??
  'https://tiles.openfreemap.org/styles/liberty';

const STOP_LAYERS = ['stops-accom', 'stops-other'];

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

// A nearby POI renders as a plain colour circle or a Wikimedia photo, never
// both — one GeoJSON feature can't paint on a circle layer and a symbol
// layer at once, so it's split across nearby-ghost/nearby-photo by this.
const HAS_PHOTO = [
  '==',
  ['get', 'hasPhoto'],
  true,
] as unknown as maplibregl.FilterSpecification;
const NOT_HAS_PHOTO = [
  '!=',
  ['get', 'hasPhoto'],
  true,
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
  onSelectNearby,
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
  onSelectNearby?: (poi: NearbyPoi) => void;
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
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(5);
  const [nearbyPois, setNearbyPois] = useState<NearbyPoi[]>([]);
  const [nearbyPhotoIds, setNearbyPhotoIds] = useState<Set<string>>(new Set());
  const nearbyRef = useRef(nearbyPois);
  nearbyRef.current = nearbyPois;
  const selectNearbyRef = useRef(onSelectNearby);
  selectNearbyRef.current = onSelectNearby;

  const fc = useMemo(
    () => buildLegFeatures(records, result),
    [records, result],
  );
  const stopFc = useMemo(() => buildStopFeatures(records), [records]);
  const fcRef = useRef(fc);
  fcRef.current = fc;
  const stopFcRef = useRef(stopFc);
  stopFcRef.current = stopFc;
  const nearbyFc = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: nearbyPois.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        properties: {
          osmId: p.osmId,
          name: p.name,
          kind: p.kind,
          color: categoryColor(p.kind),
          hasPhoto: nearbyPhotoIds.has(p.osmId),
          photoImage: `photo:${p.osmId}`,
        },
      })),
    }),
    [nearbyPois, nearbyPhotoIds],
  );
  const nearbyFcRef = useRef(nearbyFc);
  nearbyFcRef.current = nearbyFc;
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

      // Nearby ghost pins (WORK 6.4): small circles, deliberately not full
      // pins — "not yet part of your plan" should read as visually distinct
      // from a real stop, not just a different colour of the same shape.
      // Colour-coded by taxonomy category (a waterfall and a restaurant
      // shouldn't look identical) rather than flat grey. A POI with a
      // Wikimedia thumbnail (below) renders on a second, symbol layer
      // instead — one feature can't be both a circle and a symbol paint.
      map.addSource('nearby', { type: 'geojson', data: nearbyFcRef.current });
      map.addLayer({
        id: 'nearby-ghost',
        type: 'circle',
        source: 'nearby',
        filter: NOT_HAS_PHOTO,
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'nearby-photo',
        type: 'symbol',
        source: 'nearby',
        filter: HAS_PHOTO,
        layout: {
          'icon-image': ['get', 'photoImage'],
          'icon-size': 1,
          'icon-allow-overlap': true,
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
          // Labels live on their own source, deliberately not fused into the
          // icon layers: a symbol layer whose text glyph 404s can abort its
          // *whole source's* worker tile (see ToDo.md — this already silently
          // dropped the leg lines once). Isolating labels here means a bad
          // glyph can only ever cost the labels, never the icons.
          if (!map.getSource('stops-labels')) {
            map.addSource('stops-labels', {
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

    const nearbyUnder = (point: maplibregl.Point): string | null => {
      const layers = ['nearby-ghost', 'nearby-photo'].filter((l) =>
        map.getLayer(l),
      );
      if (layers.length === 0) return null;
      const hits = map.queryRenderedFeatures(point, { layers });
      return (hits[0]?.properties?.osmId as string | undefined) ?? null;
    };

    // Click a ghost pin to capture it (same placement flow as any other
    // capture); click a marker to select its stop; click empty map to drop
    // a stop.
    map.on('click', (ev) => {
      const nearbyId = nearbyUnder(ev.point);
      if (nearbyId) {
        const poi = nearbyRef.current.find((p) => p.osmId === nearbyId);
        if (poi) selectNearbyRef.current?.(poi);
        return;
      }
      const id = stopsUnder(ev.point);
      if (id) selectRef.current?.(id);
      else clickRef.current?.(ev.lngLat.lat, ev.lngLat.lng);
    });

    map.on('mousemove', (ev) => {
      const id = stopsUnder(ev.point);
      const overNearby = id ? false : !!nearbyUnder(ev.point);
      map.getCanvas().style.cursor = id || overNearby ? 'pointer' : '';
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
    const labelSource = map.getSource('stops-labels') as
      maplibregl.GeoJSONSource | undefined;
    labelSource?.setData(stopFc);
  }, [stopFc]);

  // Push new ghost pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('nearby') as
      maplibregl.GeoJSONSource | undefined;
    source?.setData(nearbyFc);
  }, [nearbyFc]);

  // Query Overpass for the focused day's corridor when Nearby is toggled on,
  // or the day/radius changes. Reads records via the ref (not a dependency)
  // so an unrelated stop edit elsewhere doesn't re-trigger the query.
  useEffect(() => {
    if (!nearbyEnabled) {
      setNearbyPois([]);
      return;
    }
    if (!focusDayId) {
      setNearbyPois([]);
      return;
    }
    const dayStops = recordsRef.current.stops
      .filter((s) => s.day === focusDayId && s.lat && s.lon)
      .map((s) => ({ lat: s.lat, lon: s.lon }));
    if (dayStops.length === 0) {
      setNearbyPois([]);
      return;
    }
    const existing = recordsRef.current.stops
      .filter((s) => s.lat && s.lon)
      .map((s) => ({ lat: s.lat, lon: s.lon }));
    let cancelled = false;
    queryNearby(dayStops, nearbyRadiusKm * 1000, existing)
      .then((pois) => {
        if (!cancelled) setNearbyPois(pois);
      })
      .catch((err) => {
        console.error('nearby query failed', err);
        if (!cancelled) setNearbyPois([]);
      });
    return () => {
      cancelled = true;
    };
  }, [nearbyEnabled, nearbyRadiusKm, focusDayId]);

  // For each nearby POI with a wikidata tag, look up its P18 image and
  // composite a circular thumbnail (WORK 6.4 follow-up) — a preview, not
  // BUILD §7.2's photo pipeline: nothing is stored, and a promoted stop
  // doesn't carry the photo over. loadThumbnailUrl is cached, so re-running
  // this for a POI already resolved (or already known to have none) is
  // cheap. A tainted canvas (an image that loaded without CORS permission)
  // throws on getImageData — caught per-POI so one bad image doesn't stop
  // the rest.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    let cancelled = false;
    for (const poi of nearbyPois) {
      if (
        !poi.wikidataId ||
        nearbyPhotoIds.has(poi.osmId) ||
        map.hasImage(`photo:${poi.osmId}`)
      ) {
        continue;
      }
      void loadThumbnailUrl(poi.wikidataId).then((url) => {
        if (cancelled || !url) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled) return;
          try {
            const imageData = compositePhotoCircle(img);
            if (!imageData) return;
            if (!map.hasImage(`photo:${poi.osmId}`)) {
              map.addImage(`photo:${poi.osmId}`, imageData, {
                pixelRatio: 2,
              });
            }
            setNearbyPhotoIds((prev) => new Set(prev).add(poi.osmId));
          } catch (err) {
            console.error('photo composite failed for', poi.osmId, err);
          }
        };
        img.src = url;
      });
    }
    return () => {
      cancelled = true;
    };
  }, [nearbyPois, nearbyPhotoIds]);

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

  // Always show the focused day's first and last stop, even if the collision
  // engine would otherwise hide them — the start/end of the day you're
  // looking at shouldn't disappear just because the route is dense.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer('stops-label-pinned')) {
      return;
    }
    const dayStops = focusDayId
      ? recordsRef.current.stops
          .filter((s) => s.day === focusDayId)
          .sort((a, b) => a.order_index - b.order_index)
      : [];
    const ids = [...new Set([dayStops[0]?.id, dayStops.at(-1)?.id])].filter(
      (id): id is string => !!id,
    );
    map.setFilter('stops-label-pinned', [
      'in',
      ['get', 'stopId'],
      ['literal', ids],
    ] as unknown as maplibregl.FilterSpecification);
  }, [focusDayId, stopFc]);

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

    // Layers are added asynchronously after the sprite atlas fetch resolves
    // (see the init effect), so there's a real window — especially under
    // StrictMode's dev-only double-mount — where loadedRef is already true
    // but stops-accom/stops-other don't exist yet. Skip the filter update
    // rather than crash; the next selection change re-runs this once they do.
    const selId = selectedStop?.id ?? '';
    if (map.getLayer('stops-accom') && map.getLayer('stops-other')) {
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
    }

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
      <div className="absolute left-2 top-11 flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs shadow">
        <button
          onClick={() => setNearbyEnabled((v) => !v)}
          className={
            nearbyEnabled ? 'font-semibold text-slate-900' : 'text-slate-500'
          }
        >
          Nearby
        </button>
        {nearbyEnabled && (
          <>
            <input
              type="range"
              min={1}
              max={20}
              value={nearbyRadiusKm}
              onChange={(e) => setNearbyRadiusKm(Number(e.target.value))}
              className="w-16"
            />
            <span className="text-slate-400">{nearbyRadiusKm}km</span>
          </>
        )}
      </div>
      {nearbyEnabled && !focusDayId && (
        <div className="absolute left-2 top-[4.75rem] rounded bg-white px-2 py-1 text-xs text-slate-500 shadow">
          Select a day to see nearby POIs
        </div>
      )}
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
