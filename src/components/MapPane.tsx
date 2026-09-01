import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  buildLegFeatures,
  buildStopFeatures,
  buildWishlistFeatures,
  type StopFeatureCollection,
} from '../lib/map-features';
import type { TripRecords } from '../lib/pb-trip-doc';
import type { CascadeResult } from '../lib/cascade';
import type { StopsResponse, PoisResponse } from '../types/pb';
import {
  addMarkerLayers,
  buildNumberedPinElement,
  buildAccessPointElement,
  buildParkingChipElement,
  compositeNumberBadge,
  compositeWishlistPin,
  compositePhotoCircle,
} from '../lib/map-markers';
import { queryNearby, type NearbyPoi, type ParkingLot } from '../lib/overpass';
import { categoryColor } from '../lib/map-colors';
import { formatMeters } from '../lib/format';
import { loadThumbnailUrl } from '../lib/wikimedia';
import { pb } from '../lib/pb';
import { blocksFor, blockFileUrl } from '../lib/pb-blocks';
import { DayPills } from './DayPills';

const TILE_URL =
  import.meta.env.VITE_TILE_URL ??
  'https://tiles.openfreemap.org/styles/liberty';

const STOP_LAYERS = ['stops'];

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
  wishlist,
  onSelectWishlist,
  selectedWishlistId,
  hoveredWishlistId,
  onSelectDay,
  onAddDay,
  picking,
  parkingLots,
  onPickParking,
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
  /** Wishlist ideas (WORK 8.1 follow-up) — hand-curated, so shown plainly,
   * unlike Nearby's raw Overpass results which are gated behind a toggle. */
  wishlist?: PoisResponse[];
  onSelectWishlist?: (poi: PoisResponse) => void;
  /** Drives the bigger/haloed wishlist pin variant (design handoff, WORK
   * 12.4) — the open card's item, mirroring `selectedStop`. */
  selectedWishlistId?: string | null;
  /** The wishlist idea currently hovered in the carousel or the compact list
   * (WORK 12.10) — grows its pin via the `wishlist-pins-hovered` layer.
   * Highlight only: never selects, opens a card, or moves the map. */
  hoveredWishlistId?: string | null;
  /** Day pills (WORK 12.5) — the trip's only day switcher since WORK 12.6
   * retired the day rail. */
  onSelectDay?: (dayId: string) => void;
  onAddDay?: () => void;
  /** Access-point picking mode (WORK 12.9). When set, the map is zoomed to
   * the stop and every bare click reports an access point rather than
   * selecting a pin; `parkingLots` render as clickable chips. Memoised by
   * the caller so its identity is stable between renders. */
  picking?: { lat: number; lon: number } | null;
  parkingLots?: ParkingLot[];
  onPickParking?: (lot: ParkingLot) => void;
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
  const pickingRef = useRef(picking ?? null);
  pickingRef.current = picking ?? null;
  const pickParkingRef = useRef(onPickParking);
  pickParkingRef.current = onPickParking;
  const parkingMarkersRef = useRef<maplibregl.Marker[]>([]);
  const selectedStopIdRef = useRef<string | null>(selectedStop?.id ?? null);
  selectedStopIdRef.current = selectedStop?.id ?? null;
  const poiMarkerRef = useRef<maplibregl.Marker | null>(null);
  const poiMarkerStopIdRef = useRef<string | null>(null);
  const accessMarkerRef = useRef<maplibregl.Marker | null>(null);
  const draggingRef = useRef(false);
  const selectedWishlistIdRef = useRef<string | null>(
    selectedWishlistId ?? null,
  );
  selectedWishlistIdRef.current = selectedWishlistId ?? null;
  // What each wishlist pin was last composited from — a signature of
  // `${starred}:${coverUrl}`. The compositing effect skips an item whose
  // signature is unchanged and re-draws one whose cover photo arrived or
  // whose star was toggled. Not state: it never drives a render, only how
  // much work the effect does.
  const wishlistPinStateRef = useRef<Map<string, string>>(new Map());
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(5);
  const [nearbyPois, setNearbyPois] = useState<NearbyPoi[]>([]);
  const [nearbyPhotoIds, setNearbyPhotoIds] = useState<Set<string>>(new Set());
  const nearbyRef = useRef(nearbyPois);
  nearbyRef.current = nearbyPois;
  const selectNearbyRef = useRef(onSelectNearby);
  selectNearbyRef.current = onSelectNearby;
  const selectWishlistRef = useRef(onSelectWishlist);
  selectWishlistRef.current = onSelectWishlist;
  const wishlistRef = useRef(wishlist ?? []);
  wishlistRef.current = wishlist ?? [];

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
  const wishlistFc = useMemo(
    () => buildWishlistFeatures(wishlist ?? []),
    [wishlist],
  );
  const wishlistFcRef = useRef(wishlistFc);
  wishlistFcRef.current = wishlistFc;
  const fittedRef = useRef(false);
  const recordsRef = useRef(records);
  recordsRef.current = records;

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

  // "Fit trip" (design handoff, day pills row) — the explicit re-fit for
  // "the map doesn't grow with the trip": maybeFit only ever auto-fires
  // once (fittedRef guards it), so a later edit that grows the trip's
  // bounds needs this button rather than another automatic re-frame, which
  // would otherwise yank the view out from under whatever the user was
  // looking at.
  //
  // The trip means the trip: stops and legs, not the wishlist. Ideas are
  // day-independent and scattered far wider than the itinerary (a real trip
  // has every one of its ideas outside the stops' bounding box), so
  // including them would zoom out past the thing you asked to see.
  // Selecting an idea flies to it instead — see `flyTo`.
  function fitTrip() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = computeBounds(fcRef.current, stopFcRef.current);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 500 });
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

      // Wishlist pins (design handoff, WORK 12.4): square photo thumbnails
      // with an amber border — always a symbol layer (unlike Nearby's
      // circle/symbol split) since even an unphotographed item still needs
      // the square-with-border shape, not a plain dot. Two layers so the
      // selected item can render bigger with a halo without touching every
      // other pin's paint — same technique as excluding the selected stop
      // from its GL layer below.
      map.addSource('wishlist', {
        type: 'geojson',
        data: wishlistFcRef.current,
        promoteId: 'poiId',
      });
      map.addLayer({
        id: 'wishlist-pins',
        type: 'symbol',
        source: 'wishlist',
        layout: {
          'icon-image': ['get', 'iconImage'],
          'icon-allow-overlap': true,
        },
      });
      map.addLayer({
        id: 'wishlist-pins-selected',
        type: 'symbol',
        source: 'wishlist',
        filter: ['==', ['get', 'poiId'], ''],
        layout: {
          'icon-image': ['get', 'iconImageSelected'],
          'icon-allow-overlap': true,
        },
      });
      // Hover highlight (WORK 12.10): a third filtered layer, same technique
      // as the selected one. A carousel card or compact-list row hover grows
      // the matching pin; selection wins when an item is both.
      map.addLayer({
        id: 'wishlist-pins-hovered',
        type: 'symbol',
        source: 'wishlist',
        filter: ['==', ['get', 'poiId'], ''],
        layout: {
          'icon-image': ['get', 'iconImageHovered'],
          'icon-allow-overlap': true,
        },
      });

      map.addSource('stops', {
        type: 'geojson',
        data: stopFcRef.current,
        promoteId: 'stopId',
      });
      addMarkerLayers(map);

      loadedRef.current = true;
      maybeFit(map);

      // Composite pin images on demand when a layer first references a key —
      // robust to timing/failures, and means nothing has to pre-fetch a
      // sprite sheet before the first pin can render.
      map.on('styleimagemissing', (e) => {
        if (map.hasImage(e.id)) return;
        try {
          if (e.id.startsWith('n:')) {
            compositeNumberBadge(map, e.id);
            return;
          }
          if (e.id.startsWith('w:')) {
            // "w:<poiId>" or "w:<poiId>:sel" — either way, composite both
            // variants now (idempotent — see compositeWishlistPin) so
            // selecting the item never has to wait on a second missing-image
            // round trip. No photo yet: the wishlistCoverEffect below
            // upgrades this in place once (if) one loads.
            const poiId = e.id.slice('w:'.length).split(':')[0] ?? '';
            const item = wishlistRef.current.find((w) => w.id === poiId);
            compositeWishlistPin(
              map,
              poiId,
              null,
              categoryColor(item?.kind ?? 'uncategorized'),
              item?.starred ?? false,
            );
          }
        } catch (err) {
          console.error('pin composite failed for', e.id, err);
        }
      });
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

    const wishlistUnder = (point: maplibregl.Point): string | null => {
      const layers = [
        'wishlist-pins',
        'wishlist-pins-selected',
        'wishlist-pins-hovered',
      ].filter((l) => map.getLayer(l));
      if (layers.length === 0) return null;
      const hits = map.queryRenderedFeatures(point, { layers });
      return (hits[0]?.properties?.poiId as string | undefined) ?? null;
    };

    // Click a wishlist or ghost pin to act on it (place / capture); click a
    // marker to select its stop; click empty map to drop a stop.
    map.on('click', (ev) => {
      // Picking an access point: the whole surface is the target, pins are
      // irrelevant. A chip click is a DOM button above the canvas and never
      // reaches here.
      if (pickingRef.current) {
        clickRef.current?.(ev.lngLat.lat, ev.lngLat.lng);
        return;
      }
      const wishlistId = wishlistUnder(ev.point);
      if (wishlistId) {
        const poi = wishlistRef.current.find((p) => p.id === wishlistId);
        if (poi) selectWishlistRef.current?.(poi);
        return;
      }
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
      if (pickingRef.current) {
        map.getCanvas().style.cursor = 'crosshair';
        return;
      }
      const id = stopsUnder(ev.point);
      const overGhost = id
        ? false
        : !!wishlistUnder(ev.point) || !!nearbyUnder(ev.point);
      map.getCanvas().style.cursor = id || overGhost ? 'pointer' : '';
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
      for (const m of parkingMarkersRef.current) m.remove();
      parkingMarkersRef.current = [];
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

  // Push new stop markers; missing badge images composite via
  // styleimagemissing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('stops') as
      maplibregl.GeoJSONSource | undefined;
    source?.setData(stopFc);
  }, [stopFc]);

  // Push new ghost pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('nearby') as
      maplibregl.GeoJSONSource | undefined;
    source?.setData(nearbyFc);
  }, [nearbyFc]);

  // Push new wishlist pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('wishlist') as
      maplibregl.GeoJSONSource | undefined;
    source?.setData(wishlistFc);
  }, [wishlistFc]);

  // Upgrade each wishlist pin from its synchronous category-colour fallback
  // (composited in styleimagemissing) to its real cover photo, once loaded —
  // via updateImage, not a fresh addImage, since the key already exists.
  // Reads `records.blocks` for the cover photo the way the card does
  // (`blocksFor`), not Wikidata like Nearby's ghost-pin thumbnails: a
  // wishlist item's photo is whatever block the capture/import pipeline (or
  // the card's own block editor) attached to it, not an external lookup.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    let cancelled = false;
    for (const item of wishlist ?? []) {
      if (!item.lat || !item.lon) continue;
      const cover = blocksFor(recordsRef.current.blocks, 'poi', item.id).find(
        (b) => b.kind === 'photo',
      );
      const url = cover ? blockFileUrl(pb, cover, '80x80') : null;
      const fallback = categoryColor(item.kind ?? 'uncategorized');
      // Signature of what the pin should show. Unchanged since last draw →
      // nothing to do. The wishlist and the trip document arrive from two
      // separate fetches, so this effect routinely first runs with the item
      // present but its blocks not loaded yet (url null); when they arrive
      // the signature changes and the pin re-composites. A star toggle
      // changes it the same way.
      const sig = `${item.starred ? 'S' : '-'}:${url ?? ''}`;
      const prev = wishlistPinStateRef.current.get(item.id);
      if (prev === sig) continue;
      wishlistPinStateRef.current.set(item.id, sig);

      if (!url) {
        // No cover photo. The first paint (colour fallback) is handled by
        // styleimagemissing; only re-draw here when the star must go onto
        // that fallback, or a previous draw (star or a since-deleted photo)
        // has to be undone.
        if (item.starred || prev !== undefined) {
          try {
            compositeWishlistPin(
              map,
              item.id,
              null,
              fallback,
              item.starred ?? false,
            );
          } catch (err) {
            console.error('wishlist pin composite failed for', item.id, err);
          }
        }
        continue;
      }

      const starred = item.starred ?? false;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        try {
          compositeWishlistPin(map, item.id, img, fallback, starred);
        } catch (err) {
          console.error('wishlist photo composite failed for', item.id, err);
        }
      };
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [wishlist, records.blocks]);

  // The bigger/haloed wishlist pin variants follow the selected and the
  // hovered item — mirrors the selected-stop exclusion filter below, but
  // wishlist pins never need a draggable DOM twin, so extra GL layers are
  // enough. One effect owns all three filters: setFilter replaces the whole
  // expression, so splitting selection and hover across two effects would
  // clobber whichever ran last (same trap as the stops layer). The base
  // layer hides both the selected and the hovered pin; selection wins when
  // an item is both.
  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !loadedRef.current ||
      !map.getLayer('wishlist-pins') ||
      !map.getLayer('wishlist-pins-selected') ||
      !map.getLayer('wishlist-pins-hovered')
    ) {
      return;
    }
    const sel = selectedWishlistId ?? '';
    const hov = hoveredWishlistId ?? '';
    map.setFilter('wishlist-pins', [
      'all',
      ['!=', ['get', 'poiId'], sel],
      ['!=', ['get', 'poiId'], hov],
    ]);
    map.setFilter('wishlist-pins-selected', ['==', ['get', 'poiId'], sel]);
    map.setFilter('wishlist-pins-hovered', [
      'all',
      ['==', ['get', 'poiId'], hov],
      ['!=', ['get', 'poiId'], sel],
    ]);
  }, [selectedWishlistId, hoveredWishlistId]);

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

  // Centre on a point on demand (selecting a wishlist idea, WORK 12.6).
  // Pan only — the zoom stays wherever the user put it. This used to force
  // a minimum zoom of 13, which was right for its old caller (the
  // inspector's "zoom to this stop" button) but wrong here: bringing an
  // off-screen idea into view shouldn't also throw away the zoom level you
  // were working at.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !flyTo) return;
    map.flyTo({ center: [flyTo.lon, flyTo.lat], duration: 600 });
  }, [flyTo]);

  // Access-point picking (WORK 12.9): zoom in on the stop so a car park is
  // actually findable — you cannot aim at a country-scale view. `picking` is
  // memoised by the caller, so this only fires on entry / target change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !picking) return;
    map.easeTo({
      center: [picking.lon, picking.lat],
      zoom: 17,
      duration: 350,
    });
  }, [picking]);

  // Parking chips: transient DOM markers, only while picking. Nearest 3–5,
  // bounded server-side by `parseParking` — deliberately not the raw Nearby
  // layer. Clicking one sets the access point there.
  useEffect(() => {
    const map = mapRef.current;
    for (const m of parkingMarkersRef.current) m.remove();
    parkingMarkersRef.current = [];
    if (!map || !loadedRef.current || !picking) return;
    for (const lot of parkingLots ?? []) {
      const el = buildParkingChipElement(
        lot.name,
        formatMeters(lot.distanceM),
        () => pickParkingRef.current?.(lot),
      );
      parkingMarkersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lot.lon, lot.lat])
          .addTo(map),
      );
    }
    return () => {
      for (const m of parkingMarkersRef.current) m.remove();
      parkingMarkersRef.current = [];
    };
  }, [picking, parkingLots]);

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

  // Day-scope the stop pins to whichever day is focused (design handoff,
  // "Day switching": "swaps ... the map's numbered pins to that day") and,
  // within that, hide the selected stop's own pin — its DOM twin below
  // stands in for it so it can be dragged. One filter, both conditions,
  // because setFilter replaces the whole expression: a second effect
  // touching the same layer would just clobber whichever ran last.
  //
  // Falls back to the trip's first day when nothing is explicitly focused
  // (day pills don't exist yet — WORK 12.6 — so nothing guarantees a day is
  // ever selected before then) rather than rendering no pins at all.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer('stops')) return;
    const dayId = focusDayId ?? recordsRef.current.days[0]?.id ?? '';
    const selId = selectedStop?.id ?? '';
    map.setFilter('stops', [
      'all',
      ['==', ['get', 'dayId'], dayId],
      ['!=', ['get', 'stopId'], selId],
    ] as unknown as maplibregl.FilterSpecification);
  }, [focusDayId, selectedStop?.id, stopFc]);

  // Draggable marker for the selected stop only: dragging every marker at
  // once would mean ditching the fast symbol-layer rendering BUILD §5 chose
  // for potentially many stops. It's the stop's real pin (same shape/number
  // as the GL layer) so dragging it reads as moving the actual marker, not
  // a generic overlay — the GL layer hides this one stop's badge underneath
  // while its DOM twin is shown. Its access point, once set, gets a second
  // draggable pin with a car glyph instead. Dropping calls back with the
  // new point; the caller re-routes automatically, the same "did it
  // resolve?" feedback the click-to-place flow already gives — no live
  // snap-to-road.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

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
        const element = buildNumberedPinElement(feature?.properties.seq ?? 1);
        const marker = new maplibregl.Marker({
          element,
          anchor: 'center',
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
        const element = buildAccessPointElement();
        const marker = new maplibregl.Marker({
          element,
          anchor: 'center',
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

  const activeDayId = focusDayId ?? records.days[0]?.id ?? null;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {picking && (
        <div className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_0_2px_oklch(0.72_0.13_215/0.55)]" />
      )}
      <DayPills
        days={records.days}
        stops={records.stops}
        activeDayId={activeDayId}
        onSelectDay={(id) => onSelectDay?.(id)}
        onAddDay={() => onAddDay?.()}
        onFitTrip={fitTrip}
      />
      {/* Dev-only capture aid, predates the redesign and unaddressed by it —
          pushed below the day pills row rather than colliding with it. */}
      <div className="absolute left-2 top-14 flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs shadow">
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
        <div className="absolute left-2 top-[6.75rem] rounded bg-white px-2 py-1 text-xs text-slate-500 shadow">
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
