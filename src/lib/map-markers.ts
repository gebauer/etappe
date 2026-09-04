/**
 * Marker rendering: the sprite atlas loader (still used by `KindIcon` for
 * the kind picker), the badge compositing for the GL symbol layers, and the
 * layers that put them on the map.
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

/** Blits one sprite-atlas glyph, recoloured to solid white, centred at
 * `(cx, cy)` on `ctx` at `size` device px. The sheet's glyphs are black
 * with the shape in the alpha channel (same as `KindIcon`'s mask), so a
 * plain `drawImage` would paint black — the `source-in` white fill on a
 * scratch canvas turns it into a clean white cutout that reads over any
 * pin colour. Used for the wishlist "icon" pin mode (WORK 18.11). */
export function drawAtlasGlyphWhite(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  iconName: string,
  cx: number,
  cy: number,
  size: number,
) {
  const e = atlas.json[iconName];
  if (!e) return;
  const scratch = document.createElement('canvas');
  scratch.width = size;
  scratch.height = size;
  const sctx = scratch.getContext('2d');
  if (!sctx) return;
  sctx.drawImage(atlas.img, e.x, e.y, e.width, e.height, 0, 0, size, size);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, size, size);
  ctx.drawImage(scratch, cx - size / 2, cy - size / 2);
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

const BADGE_BG = oklchToHex(0.24, 0.013, 250); // control
const BADGE_BORDER = oklchToHex(0.72, 0.13, 215); // accent
const BADGE_TEXT = oklchToHex(0.92, 0.006, 250); // text
const BADGE_SEL_BG = oklchToHex(0.72, 0.13, 215); // accent
const BADGE_SEL_BORDER = oklchToHex(0.96, 0.01, 240);
const BADGE_SEL_TEXT = oklchToHex(0.16, 0.02, 240); // on-accent
const BADGE_HALO = oklchToHex(0.72, 0.13, 215); // accent, alpha applied separately

// Trip-overview day badge (WORK 17.6): one per day at its starting point,
// deliberately a size up from the 26px stop pins — at trip scale these are
// the only pins and each is the day's handle. Accent fill with a lighter
// ring; a day with no stops of its own renders on `control` with a dim ring
// so an unplanned day is visible rather than missing.
const DAY_BADGE_D = 60; // -> 30px CSS
const DAY_ACCENT_BG = oklchToHex(0.72, 0.13, 215); // accent
const DAY_ACCENT_RING = oklchToHex(0.9, 0.05, 235);
const DAY_ACCENT_TEXT = oklchToHex(0.16, 0.02, 240); // on-accent
const DAY_EMPTY_BG = oklchToHex(0.24, 0.013, 250); // control
const DAY_EMPTY_RING = oklchToHex(0.4, 0.012, 250);
const DAY_EMPTY_TEXT = oklchToHex(0.92, 0.006, 250); // text

/** Composites a trip-overview day badge. `id` is "d:<n>" (accent) or
 * "d:<n>:empty" (control, for a day with no stops of its own). Called on
 * demand via styleimagemissing, like the numbered stop badges. */
export function compositeDayBadge(map: maplibregl.Map, id: string) {
  const body = id.slice('d:'.length);
  const empty = body.endsWith(':empty');
  const num = empty ? body.slice(0, -':empty'.length) : body;
  const d = DAY_BADGE_D;
  const r = d / 2;
  const canvas = document.createElement('canvas');
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  fillCircle(
    ctx,
    r,
    r,
    r - BADGE_BORDER_D / 2,
    empty ? DAY_EMPTY_BG : DAY_ACCENT_BG,
  );
  strokeCircle(
    ctx,
    r,
    r,
    r - BADGE_BORDER_D / 2,
    empty ? DAY_EMPTY_RING : DAY_ACCENT_RING,
    BADGE_BORDER_D,
  );
  drawBadgeNumber(ctx, r, r, num, empty ? DAY_EMPTY_TEXT : DAY_ACCENT_TEXT, 26);
  map.addImage(id, ctx.getImageData(0, 0, d, d), { pixelRatio: 2 });
}

// Starred-stop badge (WORK 14.3): sized down from the wishlist pin's default
// so it stays proportionate to the much smaller numbered circle. Bigger on
// the selected/DOM badge since that badge itself is bigger.
const STOP_STAR_D_UNSEL = 18;
const STOP_STAR_D_SEL = 24;

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

/** Composites the unselected numbered badge for the GL symbol layer. `id` is
 * "n:<seq>", or "n:<seq>:star" for a starred stop — a separate image, not a
 * second GL layer, so the star can't drift out of sync with which pin is
 * which (WORK 14.3, same reasoning as the wishlist pin's star). Called on
 * demand via styleimagemissing — one image per distinct (sequence, starred)
 * pair, shared across every day/stop that happens to land on it, since the
 * badge carries no day- or kind-specific styling otherwise. */
/** Small neutral diamond, no number, no star — a waypoint is a route point,
 * not a destination, and painting it like one would say otherwise. About
 * half the destination badge's footprint so it reads as background chrome
 * on the route rather than something competing for attention with the
 * numbered stops either side of it. */
function compositeWaypointBadge(map: maplibregl.Map, id: string) {
  const d = BADGE_UNSEL_D;
  const r = d / 2;
  const size = d * 0.42;
  const canvas = document.createElement('canvas');
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = BADGE_BG;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.lineWidth = BADGE_BORDER_D;
  ctx.strokeStyle = BADGE_BORDER;
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.restore();
  map.addImage(id, ctx.getImageData(0, 0, d, d), { pixelRatio: 2 });
}

export function compositeNumberBadge(map: maplibregl.Map, id: string) {
  const key = id.slice('n:'.length);
  if (key.startsWith('wp:')) {
    compositeWaypointBadge(map, id);
    return;
  }
  const starred = key.endsWith(':star');
  const seq = starred ? key.slice(0, -':star'.length) : key;
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
  if (starred) {
    drawStarBadge(
      ctx,
      d - STOP_STAR_D_UNSEL / 2,
      STOP_STAR_D_UNSEL / 2,
      STOP_STAR_D_UNSEL,
    );
  }
  map.addImage(id, ctx.getImageData(0, 0, d, d), { pixelRatio: 2 });
}

/** Builds the selected stop's draggable DOM marker: bigger badge, brighter
 * border, plus the spec's 8px accent halo at 16% alpha baked into the same
 * canvas (simpler than a second underlying layer for one always-DOM
 * marker). Centre-anchored, like the GL badge — see `MARKER_LAYOUT`. */
export function buildNumberedPinElement(
  seq: number,
  starred = false,
): HTMLCanvasElement {
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
    if (starred) {
      // Corner of the badge's own bounding box (inset by the halo margin),
      // not the full canvas — the halo's transparent margin would otherwise
      // push the star away from the badge it belongs to.
      drawStarBadge(
        ctx,
        BADGE_HALO_D + BADGE_SEL_D - STOP_STAR_D_SEL / 2,
        BADGE_HALO_D + STOP_STAR_D_SEL / 2,
        STOP_STAR_D_SEL,
      );
    }
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
const WISH_HOVER_D = 72; // -> 36px CSS (WORK 12.10 hover highlight)
const WISH_BORDER_D = 4; // -> 2px CSS
const WISH_RADIUS_D = 18; // -> 9px CSS corner radius
const WISH_HALO_D = 12; // -> 6px CSS outline

const WISH_BORDER = oklchToHex(0.78, 0.13, 80); // wishlist (amber)
const WISH_SEL_BORDER = oklchToHex(0.9, 0.1, 85);
const WISH_HALO = oklchToHex(0.78, 0.13, 80); // wishlist, alpha applied separately

// The persistent `★` badge — a gold star on a dark disc so it stays legible
// over any cover photo or pin colour. Shared by wishlist pins (WORK 12.10,
// folded into `compositeWishlistPin` so a late photo load can't drop it) and
// starred stops (WORK 14.3, folded into the numbered badge for the same
// reason — one composited image per variant, not a second GL layer to keep
// in sync). `WISH_STAR_D` is the default (wishlist pin) size; stop badges
// pass a smaller one to stay in proportion to their smaller circle.
const WISH_STAR_D = 32; // -> 16px CSS badge
const WISH_STAR_FILL = oklchToHex(0.86, 0.15, 92); // gold
const WISH_STAR_BG = oklchToHex(0.16, 0.014, 250);

function drawStarBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  diameter = WISH_STAR_D,
) {
  fillCircle(ctx, cx, cy, diameter / 2, WISH_STAR_BG);
  ctx.fillStyle = WISH_STAR_FILL;
  // Same proportions as the default 32px badge's 22px glyph.
  ctx.font = `600 ${Math.round(diameter * 0.6875)}px "Instrument Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', cx, cy + 1);
}

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
  glyph?: { atlas: Atlas; iconName: string } | null,
) {
  roundedRectPath(ctx, x, y, size, size, radius);
  if (glyph) {
    // Icon mode (WORK 18.11): a filled tile with the kind's white glyph,
    // no photo — the amber border still marks it as a wishlist pin.
    ctx.fillStyle = fallbackColor;
    ctx.fill();
    drawAtlasGlyphWhite(
      ctx,
      glyph.atlas,
      glyph.iconName,
      x + size / 2,
      y + size / 2,
      Math.round(size * 0.52),
    );
  } else if (img) {
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

/** Composites the unselected ("w:<id>"), selected ("w:<id>:sel") and hovered
 * ("w:<id>:hover") images for one wishlist item in one pass — `img` is null
 * until its cover photo has loaded, in which case the caller draws the plain
 * fallback first and re-calls this once the photo resolves (`updateImage`,
 * not `addImage`, for the already-added keys — see MapPane). `starred` draws
 * the gold `★ Top choices` badge into every variant (WORK 12.10); passing it
 * on every call is what keeps a late photo load from dropping the star. */
export function compositeWishlistPin(
  map: maplibregl.Map,
  poiId: string,
  img: HTMLImageElement | null,
  fallbackColor: string,
  starred: boolean,
  glyph?: { atlas: Atlas; iconName: string } | null,
) {
  // One variant: a rounded photo square of side `sizeD`, optionally on an
  // amber halo of width `haloD`, with the star badge tucked into its
  // top-right corner. All three are centre-anchored square canvases, so the
  // map can swap between them without the pin shifting off its coordinate.
  const variant = (
    sizeD: number,
    haloD: number,
    border: string,
  ): ImageData | null => {
    const total = sizeD + haloD * 2;
    const canvas = document.createElement('canvas');
    canvas.width = total;
    canvas.height = total;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const inset = haloD;
    if (haloD > 0) {
      ctx.globalAlpha = 0.18;
      roundedRectPath(ctx, 0, 0, total, total, WISH_RADIUS_D + haloD);
      ctx.fillStyle = WISH_HALO;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawWishSquare(
      ctx,
      inset,
      inset,
      sizeD,
      WISH_RADIUS_D,
      border,
      WISH_BORDER_D,
      img,
      fallbackColor,
      glyph,
    );
    if (starred) {
      drawStarBadge(
        ctx,
        inset + sizeD - WISH_STAR_D / 2,
        inset + WISH_STAR_D / 2,
      );
    }
    return ctx.getImageData(0, 0, total, total);
  };

  let replaced = false;
  const put = (id: string, data: ImageData | null) => {
    if (!data) return;
    if (map.hasImage(id)) {
      map.updateImage(id, data);
      replaced = true;
    } else {
      map.addImage(id, data, { pixelRatio: 2 });
    }
  };

  put(`w:${poiId}`, variant(WISH_UNSEL_D, 0, WISH_BORDER));
  put(`w:${poiId}:sel`, variant(WISH_SEL_D, WISH_HALO_D, WISH_SEL_BORDER));
  put(`w:${poiId}:hover`, variant(WISH_HOVER_D, WISH_HALO_D, WISH_BORDER));

  // `addImage` marks the style changed and the map redraws itself;
  // `updateImage` does not — it swaps the texture and sets an internal
  // `updatedImages` flag, nothing more (maplibre-gl's ImageManager). The map
  // only paints when something dirties it, so replacing a pin's fallback
  // with its photo after the load animation has settled left the old picture
  // on screen until the next pan, hover or edit happened to force a frame.
  // That is the "no thumbnails until I touch something" report.
  if (replaced) map.triggerRepaint();
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
