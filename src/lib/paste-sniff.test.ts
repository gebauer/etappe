import { describe, it, expect } from 'vitest';
import { sniffPaste } from './paste-sniff';

describe('sniffPaste', () => {
  it('decimal coordinates (comma or space)', () => {
    expect(sniffPaste('64.1466, -21.9426')).toEqual({
      kind: 'coords',
      lat: 64.1466,
      lon: -21.9426,
    });
    expect(sniffPaste('  64.1466   -21.9426 ')).toEqual({
      kind: 'coords',
      lat: 64.1466,
      lon: -21.9426,
    });
  });

  it('rejects out-of-range numbers as an address', () => {
    expect(sniffPaste('200, 500').kind).toBe('address');
  });

  it('DMS coordinates', () => {
    const r = sniffPaste(`64°08'48.0"N 21°56'32.0"W`);
    expect(r.kind).toBe('coords');
    if (r.kind === 'coords') {
      expect(r.lat).toBeCloseTo(64.1467, 3);
      expect(r.lon).toBeCloseTo(-21.9422, 3);
    }
  });

  it('Google Maps URL with @coords', () => {
    const r = sniffPaste(
      'https://www.google.com/maps/place/Gullfoss/@64.3271,-20.1199,15z',
    );
    expect(r).toEqual({
      kind: 'mapUrl',
      url: 'https://www.google.com/maps/place/Gullfoss/@64.3271,-20.1199,15z',
      lat: 64.3271,
      lon: -20.1199,
    });
  });

  it('Google Maps q= URL', () => {
    const r = sniffPaste('https://maps.google.com/?q=63.9,-20.9');
    expect(r.kind).toBe('mapUrl');
  });

  it('Google short link needs server resolution', () => {
    const r = sniffPaste('https://maps.app.goo.gl/abc123');
    expect(r).toEqual({
      kind: 'shortlink',
      url: 'https://maps.app.goo.gl/abc123',
    });
  });

  it('Komoot URL', () => {
    const r = sniffPaste('https://www.komoot.com/tour/12345');
    expect(r).toEqual({
      kind: 'url',
      url: 'https://www.komoot.com/tour/12345',
      provider: 'komoot',
    });
  });

  it('plain address', () => {
    expect(sniffPaste('Gullfoss waterfall, Iceland')).toEqual({
      kind: 'address',
      query: 'Gullfoss waterfall, Iceland',
    });
  });
});
