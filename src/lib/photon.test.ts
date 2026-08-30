import { describe, it, expect } from 'vitest';
import { parsePhoton } from './photon';

// Shape mirrors Photon's GeoJSON responses.
const response = {
  features: [
    {
      geometry: { type: 'Point', coordinates: [-20.1199, 64.3271] },
      properties: {
        name: 'Gullfoss',
        osm_key: 'waterway',
        osm_value: 'waterfall',
        country: 'Iceland',
      },
    },
    {
      geometry: { type: 'Point', coordinates: [-21.9426, 64.1466] },
      properties: {
        osm_key: 'place',
        osm_value: 'city',
        housenumber: '2',
        street: 'Austurstræti',
        city: 'Reykjavík',
        country: 'Iceland',
      },
    },
  ],
};

describe('parsePhoton', () => {
  it('maps a named feature with its OSM kind and coordinates', () => {
    const [gullfoss] = parsePhoton(response);
    expect(gullfoss!.name).toBe('Gullfoss');
    expect(gullfoss!.lat).toBe(64.3271);
    expect(gullfoss!.lon).toBe(-20.1199);
    expect(gullfoss!.kind).toBe('waterfall'); // waterway=waterfall
  });

  it('composes an address when there is no name, and falls back on kind', () => {
    const place = parsePhoton(response)[1]!;
    expect(place.name).toBe('2 Austurstræti, Reykjavík, Iceland');
    expect(place.kind).toBe('town'); // place=city -> town (or uncategorized)
  });

  it('rejects malformed data', () => {
    expect(() => parsePhoton({ features: [{ geometry: {} }] })).toThrow();
  });
});
