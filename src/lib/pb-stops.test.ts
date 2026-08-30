import { describe, it, expect } from 'vitest';
import { coordsOf } from './pb-stops';
import type { StopsResponse } from '../types/pb';

const stop = (id: string, over: Partial<StopsResponse> = {}): StopsResponse =>
  ({ id, lat: 0, lon: 0, ...over }) as StopsResponse;

describe('coordsOf', () => {
  it('uses the stop location when no access point is set', () => {
    const coords = coordsOf([stop('A', { lat: 64, lon: -21 })]);
    expect(coords.get('A')).toEqual({ lat: 64, lon: -21 });
  });

  it('prefers the access point over the stop location when both are set', () => {
    const coords = coordsOf([
      stop('A', { lat: 64, lon: -21, access_lat: 64.1, access_lon: -21.1 }),
    ]);
    expect(coords.get('A')).toEqual({ lat: 64.1, lon: -21.1 });
  });

  it('ignores a half-set access point and falls back to the stop location', () => {
    const coords = coordsOf([
      stop('A', { lat: 64, lon: -21, access_lat: 64.1 }),
    ]);
    expect(coords.get('A')).toEqual({ lat: 64, lon: -21 });
  });

  it('is null when neither the stop nor the access point has coordinates', () => {
    const coords = coordsOf([stop('A')]);
    expect(coords.get('A')).toBeNull();
  });
});
