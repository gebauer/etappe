import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// The decoder lives in `pb_hooks/` because that is where it runs (each
// PocketBase hook is its own VM, so it is a `require`-able _lib file rather
// than shared app code). It is CommonJS, which this package's `"type":
// "module"` would otherwise refuse — so evaluate it as CJS here rather
// than renaming the file and diverging from `membership_lib.js`.
const libPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../pb_hooks/flexpolyline_lib.js',
);
const moduleShim = { exports: {} as Record<string, unknown> };
new Function('module', 'exports', readFileSync(libPath, 'utf8'))(
  moduleShim,
  moduleShim.exports,
);
const decodeFlexPolyline = moduleShim.exports.decodeFlexPolyline as (
  s: string,
) => number[][];

/** Round-trip fixtures from HERE's own flexible-polyline spec. */
describe('decodeFlexPolyline', () => {
  it('decodes HERE’s published spec example', () => {
    // The README fixture: encode([[50.1022829, 8.6982122],
    // [50.1020076, 8.6956695], [50.1006313, 8.6914960],
    // [50.0987800, 8.6875156]]) === 'BFoz5xJ67i1B1B7PzIhaxL7Y'.
    const coords = decodeFlexPolyline('BFoz5xJ67i1B1B7PzIhaxL7Y');
    expect(coords.length).toBe(4);
    // GeoJSON order: [lon, lat].
    expect(coords[0]![1]).toBeCloseTo(50.10228, 5);
    expect(coords[0]![0]).toBeCloseTo(8.69821, 5);
    expect(coords[3]![1]).toBeCloseTo(50.09878, 5);
    expect(coords[3]![0]).toBeCloseTo(8.68752, 5);
  });

  it('returns [] for anything it cannot read', () => {
    expect(decodeFlexPolyline('')).toEqual([]);
    expect(decodeFlexPolyline('!!!!')).toEqual([]);
    // A version byte other than 1 is not this format.
    expect(decodeFlexPolyline('CFoz5xJ67i1B')).toEqual([]);
  });

  it('does not throw on a truncated payload', () => {
    const full = 'BFoz5xJ67i1B1B7PzIhaxL7Y';
    for (let i = 1; i < full.length; i++) {
      expect(() => decodeFlexPolyline(full.slice(0, i))).not.toThrow();
    }
  });

  it('drops a third dimension instead of leaking it into the line', () => {
    // Same points encoded with an elevation third dimension: every
    // coordinate must still be a 2-tuple.
    const coords = decodeFlexPolyline('BVoz5xJ67i1BU1B7PUzIhaxL7Y');
    for (const c of coords) expect(c.length).toBe(2);
  });
});
