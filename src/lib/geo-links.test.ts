import { describe, it, expect } from 'vitest';
import { legDirectionsUrl, mapsDirectionsUrl } from './geo-links';

describe('legDirectionsUrl', () => {
  const kef = { lat: 63.985, lon: -22.605 };
  const gull = { lat: 64.327, lon: -20.12 };

  it('carries both origin and destination', () => {
    const u = new URL(legDirectionsUrl(kef, gull, 'car'));
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('origin')).toBe('63.985,-22.605');
    expect(u.searchParams.get('destination')).toBe('64.327,-20.12');
    expect(u.searchParams.get('travelmode')).toBe('driving');
  });

  it('maps leg modes to Google travelmodes', () => {
    const tm = (m: string) =>
      new URL(legDirectionsUrl(kef, gull, m)).searchParams.get('travelmode');
    expect(tm('walk')).toBe('walking');
    expect(tm('bike')).toBe('bicycling');
    expect(tm('ferry')).toBe('transit');
    expect(tm('flight')).toBe('transit');
    expect(tm('other')).toBe('driving');
    expect(tm('')).toBe('driving');
  });
});

describe('mapsDirectionsUrl', () => {
  it('is destination-only (assumes current location as origin)', () => {
    const u = new URL(mapsDirectionsUrl(64, -21));
    expect(u.searchParams.get('destination')).toBe('64,-21');
    expect(u.searchParams.get('origin')).toBeNull();
  });
});
