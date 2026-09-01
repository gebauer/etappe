import { useEffect, useState } from 'react';
import { loadAtlas, type Atlas } from '../lib/map-markers';
import { TAXONOMY, type Kind } from '../lib/taxonomy';

let atlasCache: Atlas | null = null;

/** One taxonomy kind's Maki/Temaki glyph (WORK 7.3), read from the same
 * sprite atlas the map's markers composite from (phase 5.1) — a CSS crop,
 * not a canvas: this is a static UI icon, not a marker that needs day-hue
 * tinting or offscreen compositing. `size` is the displayed box in CSS px;
 * the crop and sheet are scaled to match so any size stays crisp off the 2x
 * sheet, not just the native 20px.
 *
 * The crop is a *mask*, not a background image. The sheet's glyphs are pure
 * black with the shape in the alpha channel, so painting them directly put
 * black icons on the dark card — barely visible. As a mask the glyph takes
 * `currentColor`, so an icon is whatever colour its surroundings are: near
 * white on the dark card, slate in the light review drawer, gold when the
 * kind picker marks it as the chosen one. */
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
        className={`inline-block shrink-0 rounded-full bg-[oklch(0.55_0.01_250/0.25)] ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  // entry.{x,y,width,height} are native sheet px at entry.pixelRatio; scale
  // everything so the requested `size` maps onto one icon cell exactly.
  const cellPx = entry.width / entry.pixelRatio;
  const displayScale = size / cellPx;
  const sheetToPixelRatioScale = displayScale / entry.pixelRatio;
  const position = `${-entry.x * sheetToPixelRatioScale}px ${-entry.y * sheetToPixelRatioScale}px`;
  const sheetSize = `${atlas.img.naturalWidth * sheetToPixelRatioScale}px ${atlas.img.naturalHeight * sheetToPixelRatioScale}px`;
  const mask = `url(${atlas.img.src})`;
  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        maskImage: mask,
        maskPosition: position,
        maskSize: sheetSize,
        maskRepeat: 'no-repeat',
        WebkitMaskImage: mask,
        WebkitMaskPosition: position,
        WebkitMaskSize: sheetSize,
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  );
}
