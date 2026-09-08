import { describe, it, expect } from 'vitest';
import { linkDomainLabel } from './link-domains';

describe('linkDomainLabel', () => {
  it('recognises the domains named in the request', () => {
    expect(linkDomainLabel('https://www.airbnb.com/rooms/12345')).toEqual({
      label: 'Airbnb',
      icon: '🏠',
    });
    expect(linkDomainLabel('https://www.booking.com/hotel/is/x.html')).toEqual({
      label: 'Booking.com',
      icon: '🛏️',
    });
    expect(linkDomainLabel('https://maps.google.com/?q=Gullfoss')).toEqual({
      label: 'Google Maps',
      icon: '📍',
    });
  });

  it('only treats google.com as Google Maps on a /maps path, not search', () => {
    expect(
      linkDomainLabel('https://www.google.com/maps/place/Gullfoss'),
    ).toEqual({ label: 'Google Maps', icon: '📍' });
    expect(
      linkDomainLabel('https://www.google.com/search?q=gullfoss'),
    ).toBeNull();
    expect(linkDomainLabel('https://drive.google.com/file/d/x')).toBeNull();
  });

  it('recognises the maps.app.goo.gl share-link host', () => {
    expect(linkDomainLabel('https://maps.app.goo.gl/abc123')).toEqual({
      label: 'Google Maps',
      icon: '📍',
    });
  });

  it('recognises a goo.gl/maps short link but not a bare goo.gl link', () => {
    expect(linkDomainLabel('https://goo.gl/maps/xyz')).toEqual({
      label: 'Google Maps',
      icon: '📍',
    });
    expect(linkDomainLabel('https://goo.gl/xyz')).toBeNull();
  });

  it('ignores the www. prefix and is case-insensitive', () => {
    expect(linkDomainLabel('https://WWW.Airbnb.COM/rooms/1')).toEqual({
      label: 'Airbnb',
      icon: '🏠',
    });
  });

  it('matches an airbnb subdomain (e.g. a locale prefix)', () => {
    expect(linkDomainLabel('https://de.airbnb.com/rooms/1')).toEqual({
      label: 'Airbnb',
      icon: '🏠',
    });
  });

  it('returns null for an unrecognised domain', () => {
    expect(linkDomainLabel('https://example.com/page')).toBeNull();
  });

  it('returns null for missing or malformed input', () => {
    expect(linkDomainLabel(undefined)).toBeNull();
    expect(linkDomainLabel(null)).toBeNull();
    expect(linkDomainLabel('')).toBeNull();
    expect(linkDomainLabel('not a url')).toBeNull();
  });
});
