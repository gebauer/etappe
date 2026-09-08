import { describe, it, expect } from 'vitest';
import {
  AMENITIES,
  AMENITY_KEYS,
  isAmenityKey,
  readAmenities,
  toggleAmenity,
} from './amenities';

describe('readAmenities', () => {
  it('keeps only known keys, in the canonical order', () => {
    // Given out of order and with junk mixed in.
    expect(readAmenities(['wifi', 'nonsense', 'linen', 'breakfast'])).toEqual([
      'linen',
      'breakfast',
      'wifi',
    ]);
  });

  it('de-duplicates', () => {
    expect(readAmenities(['towels', 'towels', 'towels'])).toEqual(['towels']);
  });

  it('is empty for null, a string, an object — anything not an array', () => {
    expect(readAmenities(null)).toEqual([]);
    expect(readAmenities(undefined)).toEqual([]);
    expect(readAmenities('linen')).toEqual([]);
    expect(readAmenities({ linen: true })).toEqual([]);
  });
});

describe('toggleAmenity', () => {
  it('adds a key and re-normalises the order', () => {
    expect(toggleAmenity(['wifi'], 'linen', true)).toEqual(['linen', 'wifi']);
  });

  it('removes a key', () => {
    expect(toggleAmenity(['linen', 'wifi'], 'linen', false)).toEqual(['wifi']);
  });

  it('is idempotent — adding what is there, removing what is not', () => {
    expect(toggleAmenity(['linen'], 'linen', true)).toEqual(['linen']);
    expect(toggleAmenity(['linen'], 'wifi', false)).toEqual(['linen']);
  });
});

describe('the closed set', () => {
  it('every amenity has a key, a label and an icon path', () => {
    for (const a of AMENITIES) {
      expect(a.key).toBeTruthy();
      expect(a.label).toBeTruthy();
    }
  });

  it('isAmenityKey guards the enum', () => {
    expect(AMENITY_KEYS.every(isAmenityKey)).toBe(true);
    expect(isAmenityKey('sauna')).toBe(false);
    expect(isAmenityKey(3)).toBe(false);
  });
});
