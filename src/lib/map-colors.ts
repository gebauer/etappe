/**
 * Day/leg colours (BUILD §5). Each day gets a hue from a fixed palette, cycled
 * past ten days. From that hue we derive a flat mid tone and two shades (dark
 * L≈45%, light L≈65%) in OKLCH, alternating by leg index. MapLibre's colour
 * parser has no oklch(), so we convert to hex here.
 *
 * categoryColor (WORK 6.4 follow-up) is a separate, day-independent mapping:
 * nearby ghost pins have no day to take a hue from, so they're grouped by
 * taxonomy kind instead — a waterfall and a restaurant should read as
 * different things at a glance, the way the day palette lets two days.
 */

import type { Kind } from './taxonomy';

const CHROMA = 0.13;

// Ten spread hues (OKLCH hue angles, degrees).
export const DAY_HUES = [
  250, 25, 145, 300, 90, 195, 330, 60, 275, 160,
] as const;

export function dayHue(dayIndex: number): number {
  const n = DAY_HUES.length;
  return DAY_HUES[((dayIndex % n) + n) % n]!;
}

/** OKLCH (L 0..1, C, H degrees) to an sRGB "#rrggbb" hex (Ottosson's matrices). */
export function oklchToHex(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toByte = (c: number) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, v)) * 255);
  };
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(toByte(lr))}${hex(toByte(lg))}${hex(toByte(lb))}`;
}

/** Flat mid tone used for the zoomed-out route shape. */
export function flatColor(hue: number): string {
  return oklchToHex(0.55, CHROMA, hue);
}

export interface LegShades {
  dark: string;
  light: string;
}

export function legShades(hue: number): LegShades {
  return {
    dark: oklchToHex(0.45, CHROMA, hue),
    light: oklchToHex(0.65, CHROMA, hue),
  };
}

/** Alternating shade for a leg by its index within the day. */
export function legColor(hue: number, legIndex: number): string {
  const { dark, light } = legShades(hue);
  return legIndex % 2 === 0 ? dark : light;
}

// Broad groups, not one hue per kind — ~7 legible buckets beat 26 similar
// dots. Kinds not listed (parking, other, uncategorized, ...) fall back to a
// flat grey rather than being forced into a bucket they don't fit.
const CATEGORY_BUCKETS: ReadonlyArray<{ hue: number; kinds: readonly Kind[] }> =
  [
    {
      hue: 145,
      kinds: ['waterfall', 'canyon', 'viewpoint', 'hike', 'wildlife', 'cave'],
    }, // nature/land
    { hue: 195, kinds: ['glacier', 'lake', 'coast', 'pool'] }, // water/ice
    { hue: 25, kinds: ['hot_spring', 'volcano'] }, // heat
    { hue: 275, kinds: ['museum', 'monument', 'church', 'town'] }, // culture
    { hue: 50, kinds: ['restaurant'] }, // food
    { hue: 230, kinds: ['hotel', 'campsite'] }, // lodging
    { hue: 250, kinds: ['airport', 'ferry', 'fuel', 'shop'] }, // services
  ];

const CATEGORY_HUE: Partial<Record<Kind, number>> = Object.fromEntries(
  CATEGORY_BUCKETS.flatMap(({ hue, kinds }) => kinds.map((k) => [k, hue])),
);

const CATEGORY_FALLBACK = '#94a3b8'; // slate-400

/** A taxonomy kind's category colour, for markers with no day to take a hue
 * from (ghost pins). Unlisted kinds get a flat grey rather than an arbitrary
 * bucket. */
export function categoryColor(kind: string): string {
  const hue = CATEGORY_HUE[kind as Kind];
  return hue != null ? oklchToHex(0.6, CHROMA, hue) : CATEGORY_FALLBACK;
}
