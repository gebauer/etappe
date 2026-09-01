/**
 * Marker rendering: the sprite atlas loader (still used by `KindIcon` for
 * the kind picker), the pin drawing routines shared by the GL symbol layer
 * and the draggable DOM markers, and the layers that put them on the map.
 * Split out of MapPane (WORK 6.4) once the file passed ~800 lines — no
 * behaviour change, just giving the map-click/nearby/labels concerns in
 * MapPane room to grow without this drawing code buried in the middle of it.
 *
 * BUILD §5.3's zoom-tiered, kind-icon pin (`compositeMarker`,
 * `drawAtlasGlyph`, the accommodation/other layer split, `TIER_OPACITY`) is
 * retired here, not restyled — the redesign (design_handoff_map_first_
 * planner/README.md, WORK 12.4) replaces it with a plain numbered circle,
 * identical across every kind and day, day-scoped by `MapPane` rather than
 * zoom-faded. Identity now lives in the card (WORK 12.2), not painted on the
 * pin. The access-point marker is a dashed "P" disc (`buildAccessPointElement`,
 * WORK 12.9) — it isn't part of the itinerary sequence the numbered pins
 * encode, and the picking flow it belongs to needs a plain draggable element,
 * not a symbol image.
 */

import type maplibregl from 'maplibre-gl';
import { oklchToHex } from './map-colors';

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

// --- numbered stop pins (design_handoff_map_first_planner, WORK 12.4) -----
//
// Device px at pixelRatio 2, matching the rest of this file's convention
// (canvas dimensions and draw coordinates are device px directly; the CSS
// display size is exactly half). Colours are the redesign's oklch tokens
// (tailwind.config.js), converted once through oklchToHex — MapLibre and
// Canvas 2D both need concrete colours, not the CSS custom properties
// Tailwind generates.
const BADGE_UNSEL_D = 52; // -> 26px CSS
const BADGE_SEL_D = 68; // -> 34px CSS
const BADGE_BORDER_D = 4; // -> 2px CSS
const BADGE_HALO_D = 16; // -> 8px CSS halo width
export const BADGE_CSS_UNSEL = BADGE_UNSEL_D / 2;
export const BADGE_CSS_SEL = BADGE_SEL_D / 2;

const BADGE_BG = oklchToHex(0.24, 0.013, 250); // control
const BADGE_BORDER = oklchToHex(0.72, 0.13, 215); // accent
const BADGE_TEXT = oklchToHex(0.92, 0.006, 250); // text
const BADGE_SEL_BG = oklchToHex(0.72, 0.13, 215); // accent
const BADGE_SEL_BORDER = oklchToHex(0.96, 0.01, 240);
const BADGE_SEL_TEXT = oklchToHex(0.16, 0.02, 240); // on-accent
const BADGE_HALO = oklchToHex(0.72, 0.13, 215); // accent, alpha applied separately

function fillCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  width: number,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawBadgeNumber(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  color: string,
  px: number,
) {
  ctx.fillStyle = color;
  ctx.font = `600 ${px}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
}

/** Composites the unselected numbered badge ("n:<seq>") for the GL symbol
 * layer. Called on demand via styleimagemissing — one image per distinct
 * sequence number, shared across every day/stop that happens to land on it,
 * since the badge carries no day- or kind-specific styling any more. */
export function compositeNumberBadge(map: maplibregl.Map, id: string) {
  const seq = id.slice('n:'.length);
  const d = BADGE_UNSEL_D;
  const r = d / 2;
  const canvas = document.createElement('canvas');
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  fillCircle(ctx, r, r, r - BADGE_BORDER_D / 2, BADGE_BG);
  strokeCircle(ctx, r, r, r - BADGE_BORDER_D / 2, BADGE_BORDER, BADGE_BORDER_D);
  drawBadgeNumber(ctx, r, r, seq, BADGE_TEXT, 24);
  map.addImage(id, ctx.getImageData(0, 0, d, d), { pixelRatio: 2 });
}

/** Builds the selected stop's draggable DOM marker: bigger badge, brighter
 * border, plus the spec's 8px accent halo at 16% alpha baked into the same
 * canvas (simpler than a second underlying layer for one always-DOM
 * marker). Centre-anchored, like the GL badge — see `MARKER_LAYOUT`. */
export function buildNumberedPinElement(seq: number): HTMLCanvasElement {
  const d = BADGE_SEL_D + BADGE_HALO_D * 2;
  const canvas = document.createElement('canvas');
  canvas.width = d;
  canvas.height = d;
  canvas.style.width = `${d / 2}px`;
  canvas.style.height = `${d / 2}px`;
  canvas.style.cursor = 'grab';
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = d / 2;
    ctx.globalAlpha = 0.16;
    fillCircle(ctx, c, c, BADGE_SEL_D / 2 + BADGE_HALO_D / 2, BADGE_HALO);
    ctx.globalAlpha = 1;
    fillCircle(ctx, c, c, BADGE_SEL_D / 2 - BADGE_BORDER_D / 2, BADGE_SEL_BG);
    strokeCircle(
      ctx,
      c,
      c,
      BADGE_SEL_D / 2 - BADGE_BORDER_D / 2,
      BADGE_SEL_BORDER,
      BADGE_BORDER_D,
    );
    drawBadgeNumber(ctx, c, c, String(seq), BADGE_SEL_TEXT, 28);
  }
  return canvas;
}

// --- access-point picking (design_handoff_map_first_planner, WORK 12.9) ---
//
// Plain DOM elements, not canvas pins: both are transient, shown only while
// picking, and never collide at density — so the symbol-layer machinery the
// itinerary pins need would be dead weight here.

const PICK_ACCENT = oklchToHex(0.72, 0.13, 215);

/** The dashed "P" disc that marks a stop's set access point — replaces the
 * earlier car-emoji teardrop (the handoff calls for a dashed accent P).
 * Draggable; MapPane wires the drag callback. */
export function buildAccessPointElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = 'P';
  Object.assign(el.style, {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: `2px dashed ${PICK_ACCENT}`,
    background: oklchToHex(0.22, 0.013, 250),
    color: PICK_ACCENT,
    font: '600 10px "IBM Plex Mono", ui-monospace, monospace',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    boxShadow: '0 2px 8px rgba(8, 10, 14, 0.5)',
  });
  return el;
}

/** A clickable parking chip anchored at a lot's coordinate during picking:
 * `P` badge · name · straight-line distance. Clicking sets the access point
 * there (stopPropagation keeps the map's own click from also firing). */
export function buildParkingChipElement(
  name: string,
  distance: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  Object.assign(btn.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    height: '30px',
    padding: '0 11px 0 8px',
    borderRadius: '15px',
    border: `1px solid ${PICK_ACCENT}`,
    background: oklchToHex(0.21, 0.013, 250),
    color: oklchToHex(0.92, 0.006, 250),
    font: '500 12px "Instrument Sans", system-ui, sans-serif',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(8, 10, 14, 0.55)',
  });

  const badge = document.createElement('span');
  badge.textContent = 'P';
  Object.assign(badge.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '5px',
    background: PICK_ACCENT,
    color: oklchToHex(0.16, 0.02, 240),
    font: '600 10px "IBM Plex Mono", ui-monospace, monospace',
  });

  const label = document.createElement('span');
  label.textContent = name;

  const dist = document.createElement('span');
  dist.textContent = distance;
  Object.assign(dist.style, {
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
    fontSize: '11px',
    color: oklchToHex(0.66, 0.01, 250),
  });

  btn.append(badge, label, dist);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

// --- wishlist pins (design_handoff_map_first_planner, WORK 12.4) ----------
//
// Square photo thumbnails, not dots — the amber border is the entire visual
// distinction from a stop pin (per the handoff, deliberately: no
// clustering, no zoom-gating, ~100 hand-curated pins read fine). Composited
// the same on-demand way as the numbered badges, but per wishlist item
// rather than per shared value, since each item's cover photo differs.
const WISH_UNSEL_D = 60; // -> 30px CSS
const WISH_SEL_D = 76; // -> 38px CSS
const WISH_BORDER_D = 4; // -> 2px CSS
const WISH_RADIUS_D = 18; // -> 9px CSS corner radius
const WISH_HALO_D = 12; // -> 6px CSS outline

const WISH_BORDER = oklchToHex(0.78, 0.13, 80); // wishlist (amber)
const WISH_SEL_BORDER = oklchToHex(0.9, 0.1, 85);
const WISH_HALO = oklchToHex(0.78, 0.13, 80); // wishlist, alpha applied separately

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cover-fits `img` (or, with no image, just fills with `fallbackColor`)
 * into a rounded square of side `size` at origin `(x,y)`, then strokes the
 * amber border. Shared by the unselected/selected wishlist composites and
 * by the initial synchronous fallback (drawn before any photo has loaded —
 * `img` is null), so all three read as the same shape. */
function drawWishSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
  border: string,
  borderWidth: number,
  img: HTMLImageElement | null,
  fallbackColor: string,
) {
  roundedRectPath(ctx, x, y, size, size, radius);
  if (img) {
    ctx.save();
    ctx.clip();
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fill();
  }
  roundedRectPath(
    ctx,
    x + borderWidth / 2,
    y + borderWidth / 2,
    size - borderWidth,
    size - borderWidth,
    Math.max(0, radius - borderWidth / 2),
  );
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = border;
  ctx.stroke();
}

/** Composites both the unselected ("w:<id>") and selected ("w:<id>:sel")
 * images for one wishlist item in one pass — `img` is null until its cover
 * photo has loaded, in which case the caller draws the plain fallback first
 * and re-calls this once the photo resolves (`updateImage`, not `addImage`,
 * for the already-added keys — see MapPane). */
export function compositeWishlistPin(
  map: maplibregl.Map,
  poiId: string,
  img: HTMLImageElement | null,
  fallbackColor: string,
) {
  const unselCanvas = document.createElement('canvas');
  unselCanvas.width = WISH_UNSEL_D;
  unselCanvas.height = WISH_UNSEL_D;
  const unselCtx = unselCanvas.getContext('2d');
  if (unselCtx) {
    drawWishSquare(
      unselCtx,
      0,
      0,
      WISH_UNSEL_D,
      WISH_RADIUS_D,
      WISH_BORDER,
      WISH_BORDER_D,
      img,
      fallbackColor,
    );
    const data = unselCtx.getImageData(0, 0, WISH_UNSEL_D, WISH_UNSEL_D);
    const id = `w:${poiId}`;
    if (map.hasImage(id)) map.updateImage(id, data);
    else map.addImage(id, data, { pixelRatio: 2 });
  }

  const d = WISH_SEL_D + WISH_HALO_D * 2;
  const selCanvas = document.createElement('canvas');
  selCanvas.width = d;
  selCanvas.height = d;
  const selCtx = selCanvas.getContext('2d');
  if (selCtx) {
    const inset = WISH_HALO_D;
    selCtx.globalAlpha = 0.18;
    roundedRectPath(selCtx, 0, 0, d, d, WISH_RADIUS_D + WISH_HALO_D);
    selCtx.fillStyle = WISH_HALO;
    selCtx.fill();
    selCtx.globalAlpha = 1;
    drawWishSquare(
      selCtx,
      inset,
      inset,
      WISH_SEL_D,
      WISH_RADIUS_D,
      WISH_SEL_BORDER,
      WISH_BORDER_D,
      img,
      fallbackColor,
    );
    const data = selCtx.getImageData(0, 0, d, d);
    const id = `w:${poiId}:sel`;
    if (map.hasImage(id)) map.updateImage(id, data);
    else map.addImage(id, data, { pixelRatio: 2 });
  }
}

// design_handoff_map_first_planner/README.md's stop pins are a fixed CSS
// size regardless of zoom (unlike BUILD §5.3's zoom-scaling teardrop) — an
// HTML-overlay-like presentation, matching the day pills/card/wishlist
// panel that are all fixed-size DOM. Centre-anchored, not tip/bottom: a
// numbered dot has no meaningful "tip", and the spec's own
// `transform: translate(-50%,-50%)` is exactly a centre anchor.
const MARKER_LAYOUT = {
  'icon-image': ['get', 'iconImage'],
  'icon-anchor': 'center',
  'icon-allow-overlap': true,
} as unknown as maplibregl.SymbolLayerSpecification['layout'];

// Roughly the unselected badge's radius (BADGE_UNSEL_D/2 in CSS px) plus a
// few px of margin — fixed, not zoom-interpolated, to match the pins.
const HOVER_RADIUS = 16;

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
  // One layer for every stop pin — no more accommodation/other split (that
  // existed only to let one layer bypass the now-removed zoom fade) and no
  // text-label layers: the number on the pin is the identifier, matching
  // the itinerary column's own sequence badge (WORK 12.6) rather than
  // repeating the title on the map.
  if (!map.getLayer('stops')) {
    map.addLayer({
      id: 'stops',
      type: 'symbol',
      source: 'stops',
      layout: MARKER_LAYOUT,
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
