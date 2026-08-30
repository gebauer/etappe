/**
 * Day/leg colours (BUILD §5). Each day gets a hue from a fixed palette, cycled
 * past ten days. From that hue we derive a flat mid tone and two shades (dark
 * L≈45%, light L≈65%) in OKLCH, alternating by leg index. MapLibre's colour
 * parser has no oklch(), so we convert to hex here.
 */

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
