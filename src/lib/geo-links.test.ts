import { describe, it, expect } from 'vitest';
import { legUrl, placeUrl, routeUrl } from './geo-links';

const kef = { lat: 63.985, lon: -22.605 };
const gull = { lat: 64.327, lon: -20.12 };

describe('legUrl', () => {
  it('carries both origin and destination', () => {
    const u = new URL(legUrl('google', kef, gull, 'car')!);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('origin')).toBe('63.985,-22.605');
    expect(u.searchParams.get('destination')).toBe('64.327,-20.12');
    expect(u.searchParams.get('travelmode')).toBe('driving');
  });

  it('maps leg modes to Google travelmodes', () => {
    const tm = (m: string) =>
      new URL(legUrl('google', kef, gull, m)!).searchParams.get('travelmode');
    expect(tm('walk')).toBe('walking');
    expect(tm('bike')).toBe('bicycling');
    expect(tm('ferry')).toBe('transit');
    expect(tm('flight')).toBe('transit');
    expect(tm('other')).toBe('driving');
    expect(tm('')).toBe('driving');
  });

  it('builds an A→B route for every app', () => {
    expect(legUrl('apple', kef, gull)).toContain(
      'saddr=63.985,-22.605&daddr=64.327,-20.12',
    );
    expect(legUrl('here', kef, gull)).toBe(
      'https://wego.here.com/directions/drive/63.985,-22.605/64.327,-20.12',
    );
    expect(legUrl('osm', kef, gull)).toContain(
      'route=63.985,-22.605;64.327,-20.12',
    );
  });
});

describe('routeUrl', () => {
  const chain = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ lat: 64 + i / 100, lon: -21 }));

  it('needs at least two points', () => {
    expect(routeUrl('google', [])).toBeNull();
    expect(routeUrl('google', [kef])).toBeNull();
  });

  it('passes intermediate stops as Google waypoints', () => {
    const r = routeUrl('google', chain(4))!;
    const u = new URL(r.url);
    expect(u.searchParams.get('origin')).toBe('64,-21');
    expect(u.searchParams.get('destination')).toBe('64.03,-21');
    expect(u.searchParams.get('waypoints')).toBe('64.01,-21|64.02,-21');
    expect(r.truncated).toBe(0);
  });

  it('reports how many stops Google could not take', () => {
    // 13 points = origin + 11 intermediate + destination; Google caps at 9.
    const r = routeUrl('google', chain(13))!;
    expect(new URL(r.url).searchParams.get('waypoints')!.split('|')).toHaveLength(
      9,
    );
    expect(r.truncated).toBe(2);
  });

  it('chains every stop for the apps without a cap', () => {
    expect(routeUrl('here', chain(13))!.url.split('/').length).toBe(
      // https: '' wego.here.com directions drive + 13 points
      5 + 13,
    );
    expect(routeUrl('here', chain(13))!.truncated).toBe(0);
    expect(routeUrl('apple', chain(3))!.url).toContain('+to:');
    expect(routeUrl('osm', chain(13))!.url.split(';')).toHaveLength(13);
  });
});

describe('placeUrl', () => {
  it('points at one place, not a route', () => {
    expect(placeUrl('google', kef)).toContain('query=63.985,-22.605');
    expect(placeUrl('apple', kef)).toContain('ll=63.985,-22.605');
    expect(placeUrl('here', kef)).toContain('map=63.985,-22.605');
    expect(placeUrl('osm', kef)).toContain('mlat=63.985&mlon=-22.605');
  });
});
