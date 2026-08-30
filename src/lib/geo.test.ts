import { describe, it, expect } from 'vitest';
import { haversineMeters } from './geo';

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters({ lat: 64, lon: -21 }, { lat: 64, lon: -21 })).toBe(
      0,
    );
  });

  it('matches a known distance (Reykjavík to Selfoss, roughly 50km)', () => {
    const reykjavik = { lat: 64.1466, lon: -21.9426 };
    const selfoss = { lat: 63.9333, lon: -21.0 };
    const d = haversineMeters(reykjavik, selfoss);
    expect(d).toBeGreaterThan(45000);
    expect(d).toBeLessThan(65000);
  });
});
