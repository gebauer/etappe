import { describe, it, expect } from 'vitest';
import { findNearbyStop } from './merge';
import type { StopsResponse } from '../types/pb';

const stop = (id: string, lat: number, lon: number): StopsResponse =>
  ({ id, title: id, lat, lon }) as StopsResponse;

describe('findNearbyStop', () => {
  it('returns null when nothing is within the radius', () => {
    const stops = [stop('A', 64, -21)];
    expect(findNearbyStop({ lat: 63, lon: -20 }, stops)).toBeNull();
  });

  it('finds a stop within the default 100m radius', () => {
    // ~0.0005 degrees latitude is roughly 55m.
    const stops = [stop('A', 64.0005, -21)];
    const found = findNearbyStop({ lat: 64, lon: -21 }, stops);
    expect(found?.id).toBe('A');
  });

  it('ignores stops without coordinates', () => {
    const stops = [stop('A', 0, 0)];
    expect(findNearbyStop({ lat: 0.0001, lon: 0.0001 }, stops)).toBeNull();
  });

  it('picks the closest match when several are within radius', () => {
    const stops = [stop('far', 64.0009, -21), stop('near', 64.0002, -21)];
    const found = findNearbyStop({ lat: 64, lon: -21 }, stops, 150);
    expect(found?.id).toBe('near');
  });

  it('respects a custom radius', () => {
    const stops = [stop('A', 64.002, -21)]; // ~220m away
    expect(findNearbyStop({ lat: 64, lon: -21 }, stops, 100)).toBeNull();
    expect(findNearbyStop({ lat: 64, lon: -21 }, stops, 300)?.id).toBe('A');
  });
});
