import { describe, it, expect } from 'vitest';
import { haversineMeters, buildOverpassQuery, parseOverpass } from './overpass';

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

describe('buildOverpassQuery', () => {
  it('encodes every waypoint into a shared around filter', () => {
    const q = buildOverpassQuery(
      [
        { lat: 64, lon: -21 },
        { lat: 63, lon: -20 },
      ],
      5000,
    );
    expect(q).toContain('around:5000,64,-21,63,-20');
    expect(q).toContain('node["tourism"]');
    expect(q).toContain('node["historic"]');
    expect(q).toContain('node["natural"~"^(waterfall|');
  });
});

describe('parseOverpass', () => {
  const response = {
    elements: [
      {
        type: 'node',
        id: 1,
        lat: 64.1,
        lon: -21.9,
        tags: { tourism: 'viewpoint', name: 'Kerið' },
      },
      {
        type: 'node',
        id: 2,
        lat: 64.2,
        lon: -21.8,
        tags: { tourism: 'hotel' },
      }, // no name
      {
        type: 'node',
        id: 3,
        lat: 63.0,
        lon: -20.0,
        tags: { natural: 'waterfall', name: 'Close one' },
      },
      {
        type: 'way',
        id: 4,
        tags: { tourism: 'attraction', name: 'A way, not a node' },
      },
    ],
  };

  it('drops unnamed nodes and non-node elements', () => {
    const results = parseOverpass(response, []);
    expect(results.map((r) => r.name)).toEqual(['Kerið', 'Close one']);
  });

  it('maps OSM tags to a taxonomy kind, defaulting to uncategorized', () => {
    const results = parseOverpass(response, []);
    expect(results.find((r) => r.name === 'Kerið')?.kind).toBe('viewpoint');
  });

  it('excludes results within the exclusion radius of an existing stop', () => {
    const results = parseOverpass(response, [{ lat: 63.0, lon: -20.0 }], 100);
    expect(results.map((r) => r.name)).toEqual(['Kerið']);
  });
});
