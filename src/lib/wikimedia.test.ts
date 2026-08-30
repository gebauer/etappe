import { describe, it, expect } from 'vitest';
import { extractP18Filename, commonsThumbnailUrl } from './wikimedia';

describe('extractP18Filename', () => {
  it('extracts the filename from a real wbgetclaims shape', () => {
    // Actual shape from https://www.wikidata.org/w/api.php?action=wbgetclaims&property=P18
    const json = {
      claims: {
        P18: [
          {
            mainsnak: {
              snaktype: 'value',
              property: 'P18',
              datavalue: { value: 'Kerid crater lake.jpg', type: 'string' },
              datatype: 'commonsMedia',
            },
          },
        ],
      },
    };
    expect(extractP18Filename(json)).toBe('Kerid crater lake.jpg');
  });

  it('returns null when there is no P18 claim', () => {
    expect(extractP18Filename({ claims: {} })).toBeNull();
  });

  it('returns null for a malformed response', () => {
    expect(extractP18Filename({})).toBeNull();
    expect(extractP18Filename(null)).toBeNull();
  });
});

describe('commonsThumbnailUrl', () => {
  it('URL-encodes the filename and sets the width', () => {
    const url = commonsThumbnailUrl('Kerið crater lake.jpg', 96);
    expect(url).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Keri%C3%B0%20crater%20lake.jpg?width=96',
    );
  });
});
