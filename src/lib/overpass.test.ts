import { describe, it, expect } from 'vitest';
import {
  buildOverpassQuery,
  parseOverpass,
  buildParkingQuery,
  parseParking,
} from './overpass';

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
        tags: { tourism: 'viewpoint', name: 'Kerið', wikidata: 'Q1533555' },
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

  it('carries the wikidata tag when present, omits it otherwise', () => {
    const results = parseOverpass(response, []);
    expect(results.find((r) => r.name === 'Kerið')?.wikidataId).toBe(
      'Q1533555',
    );
    expect(
      results.find((r) => r.name === 'Close one')?.wikidataId,
    ).toBeUndefined();
  });

  it('excludes results within the exclusion radius of an existing stop', () => {
    const results = parseOverpass(response, [{ lat: 63.0, lon: -20.0 }], 100);
    expect(results.map((r) => r.name)).toEqual(['Kerið']);
  });
});

describe('buildParkingQuery', () => {
  it('queries parking and parking_entrance around one point', () => {
    const q = buildParkingQuery({ lat: 64.25, lon: -21.03 }, 600);
    expect(q).toContain('around:600,64.25,-21.03');
    expect(q).toContain('node["amenity"="parking"]');
    expect(q).toContain('way["amenity"="parking"]');
    expect(q).toContain('node["amenity"="parking_entrance"]');
    expect(q).toContain('out center;');
  });
});

describe('parseParking', () => {
  const center = { lat: 64.2559, lon: -21.0331 };
  const response = {
    elements: [
      {
        type: 'node',
        id: 10,
        lat: 64.2565,
        lon: -21.0325,
        tags: { amenity: 'parking', name: 'Hakið car park', fee: 'no' },
      },
      {
        type: 'way',
        id: 11,
        center: { lat: 64.262, lon: -21.04 },
        tags: { amenity: 'parking', capacity: '80' },
      },
      {
        type: 'node',
        id: 12,
        lat: 64.28,
        lon: -21.06,
        tags: { amenity: 'parking', name: 'Far lot' },
      },
      // No coordinate at all — dropped.
      { type: 'way', id: 13, tags: { amenity: 'parking' } },
    ],
  };

  it('resolves way centres and sorts by distance', () => {
    const lots = parseParking(response, center);
    expect(lots.map((l) => l.name)).toEqual([
      'Hakið car park',
      'Parking',
      'Far lot',
    ]);
    expect(lots[0]!.distanceM).toBeLessThan(lots[1]!.distanceM);
  });

  it('names an untagged lot "Parking" and keeps the way centre coordinate', () => {
    const lot = parseParking(response, center).find(
      (l) => l.name === 'Parking',
    );
    expect(lot).toMatchObject({ lat: 64.262, lon: -21.04, capacity: '80' });
  });

  it('drops elements with no resolvable coordinate', () => {
    const lots = parseParking(response, center);
    expect(lots.some((l) => l.osmId === 'way/13')).toBe(false);
  });

  it('keeps only the nearest `limit`', () => {
    expect(parseParking(response, center, 2)).toHaveLength(2);
  });
});
