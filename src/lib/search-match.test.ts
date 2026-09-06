import { describe, it, expect } from 'vitest';
import { matchByNameOrKind, kindLabel } from './search-match';

const items = [
  { title: 'Skógafoss', kind: 'waterfall' },
  { title: 'Seljalandsfoss', kind: 'waterfall' },
  { title: 'Blue Lagoon', kind: 'hot_spring' },
  { title: 'Hotel Vík', kind: 'hotel' },
];

describe('kindLabel', () => {
  it('uses the taxonomy label', () => {
    expect(kindLabel('hot_spring')).toBe('Hot spring');
  });

  it('falls back to the raw value, then to uncategorized', () => {
    expect(kindLabel('something_else')).toBe('something_else');
    expect(kindLabel(undefined)).toBe('uncategorized');
  });
});

describe('matchByNameOrKind', () => {
  it('matches a title anywhere, not just at the start', () => {
    expect(matchByNameOrKind(items, 'lagoon', 6).map((i) => i.title)).toEqual([
      'Blue Lagoon',
    ]);
  });

  it('matches the kind label, so a kind name finds every one of them', () => {
    expect(matchByNameOrKind(items, 'waterfall', 6).map((i) => i.title)).toEqual(
      ['Skógafoss', 'Seljalandsfoss'],
    );
    // The label, not the raw enum member with its underscore.
    expect(matchByNameOrKind(items, 'hot spring', 6)).toHaveLength(1);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(matchByNameOrKind(items, '  HOTEL ', 6)).toHaveLength(1);
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(matchByNameOrKind(items, '   ', 6)).toEqual([]);
    expect(matchByNameOrKind(items, 'foss', 1)).toHaveLength(1);
  });
});
