/**
 * Stop marker rendering (BUILD §5.3): the sprite atlas loader, the pin
 * drawing routines shared by the GL symbol layer and the draggable DOM
 * markers, and the layers that put them on the map. Split out of MapPane
 * (WORK 6.4) once the file passed ~800 lines — no behaviour change, just
 * giving the map-click/nearby/labels concerns in MapPane room to grow
 * without this drawing code buried in the middle of it.
 */

import type maplibregl from 'maplibre-gl';

// Non-accommodation markers fade in past z6 (the trip-overview zoom).
export const TIER_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  0,
  6,
  1,
] as unknown as maplibregl.ExpressionSpecification;

export interface SpriteEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio: number;
}

export interface Atlas {
  img: HTMLImageElement;
  json: Record<string, SpriteEntry>;
}

let atlasPromise: Promise<Atlas> | null = null;

export function loadAtlas(): Promise<Atlas> {
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
export const PIN_CSS_W = PIN_W / 2;
export const PIN_CSS_H = PIN_H / 2;

/** Draws the pin silhouette — solid hue fill, tail and head as one shape —
 * with no glyph. */
function drawPinBase(ctx: CanvasRenderingContext2D, hue: string) {
  const cx = PIN_W / 2;
  ctx.fillStyle = hue;
  ctx.beginPath();
  ctx.moveTo(cx - HEAD_R * 0.8, HEAD_CY + HEAD_R * 0.55);
  ctx.lineTo(cx + HEAD_R * 0.8, HEAD_CY + HEAD_R * 0.55);
  ctx.lineTo(cx, PIN_H - 1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, HEAD_CY, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
}

/** Recolours whatever is drawn by `draw` to solid white, keeping its alpha
 * shape — done on an isolated scratch canvas (globalCompositeOperation
 * 'source-in' would otherwise erase the pin body already on `ctx`), then
 * composited onto the pin at the head centre. Gives every glyph — sprite icon
 * or emoji — the same white-cutout look regardless of its native colours. */
function drawWhiteGlyph(
  ctx: CanvasRenderingContext2D,
  draw: (scratch: CanvasRenderingContext2D) => void,
) {
  const scratch = document.createElement('canvas');
  scratch.width = GLYPH_SIZE;
  scratch.height = GLYPH_SIZE;
  const sctx = scratch.getContext('2d');
  if (!sctx) return;
  draw(sctx);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, GLYPH_SIZE, GLYPH_SIZE);
  ctx.drawImage(scratch, PIN_W / 2 - GLYPH_SIZE / 2, HEAD_CY - GLYPH_SIZE / 2);
}

/** Draws a taxonomy sprite glyph, recoloured white, centred in the pin's
 * head. */
export function drawAtlasGlyph(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  icon: string,
) {
  const e = atlas.json[icon];
  if (!e) return;
  drawWhiteGlyph(ctx, (sctx) => {
    sctx.drawImage(
      atlas.img,
      e.x,
      e.y,
      e.width,
      e.height,
      0,
      0,
      GLYPH_SIZE,
      GLYPH_SIZE,
    );
  });
}

/** Draws a plain glyph (e.g. an emoji), recoloured white, centred in the
 * pin's head — used for markers that aren't a taxonomy kind, like the
 * access-point car. */
export function drawEmojiGlyph(ctx: CanvasRenderingContext2D, emoji: string) {
  drawWhiteGlyph(ctx, (sctx) => {
    sctx.font = `${GLYPH_SIZE}px sans-serif`;
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText(emoji, GLYPH_SIZE / 2, GLYPH_SIZE / 2 + 1);
  });
}

/** Composite one marker image ("m:<icon>:<hue>") for the GL symbol layer.
 * Called on demand via styleimagemissing. */
export function compositeMarker(map: maplibregl.Map, atlas: Atlas, id: string) {
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
export function buildPinElement(
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

// Eligible from just above the initial trip-overview zoom — the collision
// engine, not a zoom floor, is what decides whether there's room for a given
// label, so pull this down and let it do that job at any reasonable zoom.
const LABEL_MINZOOM = 5;
// Mirrors MARKER_LAYOUT's icon-size curve (1 -> 1.3 -> 1.6), scaled by 10, so
// text-size and the pin's rendered height stay in constant proportion across
// zoom (pin height / text size = PIN_CSS_H / 10 = 3, always). That's what
// makes a single fixed text-offset below correct at every zoom instead of
// only the one it happened to be tuned against — a mismatch here is exactly
// what let the label sit low enough to cover the icon instead of clearing it.
const LABEL_SIZE = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  10,
  10,
  13,
  14,
  16,
] as unknown as maplibregl.ExpressionSpecification;
// >= 3em clears the pin's full height at any zoom (see LABEL_SIZE); the
// extra 0.6 is breathing room between the label and the pin's tip.
const LABEL_OFFSET = [0, -3.6];

const LABEL_LAYOUT = {
  'text-field': ['get', 'title'],
  'text-font': ['Noto Sans Regular'],
  'text-size': LABEL_SIZE,
  'text-anchor': 'bottom',
  'text-offset': LABEL_OFFSET,
  // The collision engine is the "only if there's enough space" behaviour:
  // it hides whichever labels don't fit rather than overlapping them.
  'text-allow-overlap': false,
  'text-optional': true,
  'symbol-sort-key': ['get', 'sortKey'],
} as unknown as maplibregl.SymbolLayerSpecification['layout'];

// A day's first and last stop always get their label, bypassing collision,
// while that day is focused (day-rail click) — the pinned filter starts
// empty and is set by the "focused day" effect in MapPane.
const PINNED_LABEL_LAYOUT = {
  'text-field': ['get', 'title'],
  'text-font': ['Noto Sans Regular'],
  'text-size': LABEL_SIZE,
  'text-anchor': 'bottom',
  'text-offset': LABEL_OFFSET,
  'text-allow-overlap': true,
  'symbol-sort-key': ['get', 'sortKey'],
} as unknown as maplibregl.SymbolLayerSpecification['layout'];

export function addMarkerLayers(map: maplibregl.Map) {
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
  if (!map.getLayer('stops-label')) {
    map.addLayer({
      id: 'stops-label',
      type: 'symbol',
      source: 'stops-labels',
      minzoom: LABEL_MINZOOM,
      layout: LABEL_LAYOUT,
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.2,
      },
    });
  }
  if (!map.getLayer('stops-label-pinned')) {
    map.addLayer({
      id: 'stops-label-pinned',
      type: 'symbol',
      source: 'stops-labels',
      filter: ['==', ['get', 'stopId'], ''],
      layout: PINNED_LABEL_LAYOUT,
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.2,
      },
    });
  }
}

// Device px; the nearby-photo layer has no zoom-scaled icon-size curve (it's
// a small fixed accent, not the main marker), so one size is enough.
const PHOTO_SIZE = 40;

/** Composites a loaded image into a circular thumbnail with a white ring,
 * for the nearby-photo symbol layer (WORK 6.4 follow-up — Wikimedia
 * thumbnails on ghost pins that have one). Cover-fits so non-square source
 * images don't distort. Returns null only on a missing canvas context;
 * getImageData itself throws (caught by the caller) if the image loaded
 * without CORS permission and tainted the canvas. */
export function compositePhotoCircle(img: HTMLImageElement): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const r = PHOTO_SIZE / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const scale = Math.max(
    PHOTO_SIZE / img.naturalWidth,
    PHOTO_SIZE / img.naturalHeight,
  );
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (PHOTO_SIZE - w) / 2, (PHOTO_SIZE - h) / 2, w, h);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(r, r, r - 1.5, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  return ctx.getImageData(0, 0, PHOTO_SIZE, PHOTO_SIZE);
}
