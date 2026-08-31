import { useEffect, useState } from 'react';
import { loadAtlas, type Atlas } from '../lib/map-markers';
import { TAXONOMY, type Kind } from '../lib/taxonomy';

let atlasCache: Atlas | null = null;

/** One taxonomy kind's Maki/Temaki glyph (WORK 7.3), read from the same
 * sprite atlas the map's markers composite from (phase 5.1) — a plain CSS
 * background-position crop, not a canvas: this is a static UI icon, not a
 * marker that needs day-hue tinting or offscreen compositing. `size` is the
 * displayed box in CSS px; the crop and sheet are scaled to match so any
 * size stays crisp off the 2x sheet, not just the native 20px. */
export function KindIcon({
  kind,
  size = 20,
  className = '',
}: {
  kind: Kind;
  size?: number;
  className?: string;
}) {
  const [atlas, setAtlas] = useState<Atlas | null>(atlasCache);
  useEffect(() => {
    if (atlasCache) return;
    loadAtlas().then((a) => {
      atlasCache = a;
      setAtlas(a);
    });
  }, []);

  const entry = atlas?.json[TAXONOMY[kind].icon];
  if (!atlas || !entry) {
    return (
      <span
        className={`inline-block shrink-0 rounded-full bg-slate-100 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  // entry.{x,y,width,height} are native sheet px at entry.pixelRatio; scale
  // everything so the requested `size` maps onto one icon cell exactly.
  const cellPx = entry.width / entry.pixelRatio;
  const displayScale = size / cellPx;
  const sheetToPixelRatioScale = displayScale / entry.pixelRatio;
  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${atlas.img.src})`,
        backgroundPosition: `${-entry.x * sheetToPixelRatioScale}px ${-entry.y * sheetToPixelRatioScale}px`,
        backgroundSize: `${atlas.img.naturalWidth * sheetToPixelRatioScale}px ${atlas.img.naturalHeight * sheetToPixelRatioScale}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
