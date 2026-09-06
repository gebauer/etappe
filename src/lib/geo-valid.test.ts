import { describe, it, expect } from 'vitest';
import { isValidLatLon } from './geo';

describe('isValidLatLon', () => {
  it('accepts a real point', () => {
    expect(isValidLatLon(64.1466, -21.9426)).toBe(true);
    expect(isValidLatLon(-90, 180)).toBe(true);
  });

  it('rejects an out-of-range value — the address-pasted-into-latitude case', () => {
    expect(isValidLatLon(1000, -21.9426)).toBe(false);
    expect(isValidLatLon(64.1466, 999)).toBe(false);
    expect(isValidLatLon(90.0001, 0.5)).toBe(false);
  });

  it('still treats a zero in either half as "not placed yet"', () => {
    // An unplaced stop or idea is stored as 0/0 — the map must not draw it
    // off the coast of Africa. Same rule the old `lat && lon` guard had.
    expect(isValidLatLon(0, 0)).toBe(false);
    expect(isValidLatLon(64.1466, 0)).toBe(false);
    expect(isValidLatLon(0, -21.9426)).toBe(false);
  });

  it('rejects a missing or non-finite value', () => {
    expect(isValidLatLon(null, 12)).toBe(false);
    expect(isValidLatLon(12, undefined)).toBe(false);
    expect(isValidLatLon(NaN, 1)).toBe(false);
    expect(isValidLatLon(1, Infinity)).toBe(false);
  });
});
