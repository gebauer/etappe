import { describe, it, expect } from 'vitest';
import { mapOsmTags } from './osm-tags';

describe('mapOsmTags', () => {
  it('maps the canonical example waterway=waterfall', () => {
    expect(mapOsmTags({ waterway: 'waterfall' })).toBe('waterfall');
  });

  it('maps any shop value to shop', () => {
    expect(mapOsmTags({ shop: 'bakery' })).toBe('shop');
    expect(mapOsmTags({ shop: 'supermarket' })).toBe('shop');
  });

  it('lets a specific rule win over a generic tag on the same feature', () => {
    // place_of_worship resolves to church even alongside a historic tag that
    // matches no rule.
    expect(
      mapOsmTags({ amenity: 'place_of_worship', historic: 'church' }),
    ).toBe('church');
  });

  it('resolves accommodation and transport tags', () => {
    expect(mapOsmTags({ tourism: 'hotel' })).toBe('hotel');
    expect(mapOsmTags({ tourism: 'camp_site' })).toBe('campsite');
    expect(mapOsmTags({ aeroway: 'aerodrome' })).toBe('airport');
  });

  it('returns null for unknown or empty tags', () => {
    expect(mapOsmTags({ leisure: 'pitch' })).toBeNull();
    expect(mapOsmTags({})).toBeNull();
  });
});
