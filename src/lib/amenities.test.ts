import { describe, it, expect } from 'vitest';
import {
  AMENITIES,
  AMENITY_KEYS,
  amenityState,
  isAmenityKey,
  isBookable,
  readAmenities,
  setAmenity,
} from './amenities';

describe('readAmenities', () => {
  it('reads the current map form, keeping only known keys', () => {
    expect(
      readAmenities({ wifi: 'yes', nonsense: 'yes', linen: 'yes' }),
    ).toEqual({ linen: 'yes', wifi: 'yes' });
  });

  it('reads the legacy array form as all-yes', () => {
    expect(readAmenities(['towels', 'linen'])).toEqual({
      linen: 'yes',
      towels: 'yes',
    });
  });

  it("keeps 'book' only for a bookable amenity", () => {
    expect(readAmenities({ breakfast: 'book' })).toEqual({ breakfast: 'book' });
    // linen is not bookable — coerced to yes.
    expect(readAmenities({ linen: 'book' })).toEqual({ linen: 'yes' });
  });

  it('drops falsy / unknown states', () => {
    expect(readAmenities({ wifi: '', linen: 'yes' })).toEqual({ linen: 'yes' });
  });

  it('is empty for null, a string — anything not array or object', () => {
    expect(readAmenities(null)).toEqual({});
    expect(readAmenities(undefined)).toEqual({});
    expect(readAmenities('linen')).toEqual({});
  });
});

describe('setAmenity', () => {
  it('adds, changes and clears a key', () => {
    let m = setAmenity({}, 'linen', 'yes');
    expect(m).toEqual({ linen: 'yes' });
    m = setAmenity(m, 'breakfast', 'book');
    expect(m).toEqual({ linen: 'yes', breakfast: 'book' });
    m = setAmenity(m, 'linen', null);
    expect(m).toEqual({ breakfast: 'book' });
  });

  it("coerces 'book' to 'yes' for a non-bookable amenity", () => {
    expect(setAmenity({}, 'wifi', 'book')).toEqual({ wifi: 'yes' });
  });
});

describe('amenityState', () => {
  it("is 'no' for an absent key", () => {
    expect(amenityState({}, 'linen')).toBe('no');
    expect(amenityState({ breakfast: 'book' }, 'breakfast')).toBe('book');
    expect(amenityState({ wifi: 'yes' }, 'wifi')).toBe('yes');
  });
});

describe('the closed set', () => {
  it('every amenity has a key and a label', () => {
    for (const a of AMENITIES) {
      expect(a.key).toBeTruthy();
      expect(a.label).toBeTruthy();
    }
  });

  it('only breakfast is bookable', () => {
    expect(isBookable('breakfast')).toBe(true);
    expect(isBookable('wifi')).toBe(false);
  });

  it('isAmenityKey guards the enum', () => {
    expect(AMENITY_KEYS.every(isAmenityKey)).toBe(true);
    expect(isAmenityKey('sauna')).toBe(false);
    expect(isAmenityKey(3)).toBe(false);
  });
});
