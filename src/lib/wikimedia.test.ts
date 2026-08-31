import { describe, it, expect } from 'vitest';
import {
  extractP18Filename,
  commonsThumbnailUrl,
  extractCommonsAttribution,
} from './wikimedia';

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

describe('extractCommonsAttribution', () => {
  it('extracts and strips HTML from a real imageinfo/extmetadata shape', () => {
    // Actual shape from action=query&titles=File:GullfossOverview.jpg&
    // prop=imageinfo&iiprop=extmetadata
    const json = {
      batchcomplete: '',
      query: {
        pages: {
          '291780': {
            pageid: 291780,
            ns: 6,
            title: 'File:GullfossOverview.jpg',
            imageinfo: [
              {
                extmetadata: {
                  Artist: {
                    value:
                      '<a href="//commons.wikimedia.org/wiki/User:Tillea" title="User:Tillea">Andreas Tille</a>',
                  },
                  LicenseShortName: { value: 'CC BY-SA 4.0' },
                  LicenseUrl: {
                    value: 'https://creativecommons.org/licenses/by-sa/4.0',
                  },
                },
              },
            ],
          },
        },
      },
    };
    expect(extractCommonsAttribution(json, 'GullfossOverview.jpg')).toEqual({
      author: 'Andreas Tille',
      licence: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:GullfossOverview.jpg',
    });
  });

  it('returns null for a missing file', () => {
    const json = {
      query: {
        pages: { '-1': { ns: 6, title: 'File:Nope.jpg', missing: '' } },
      },
    };
    expect(extractCommonsAttribution(json, 'Nope.jpg')).toBeNull();
  });

  it('returns null for a malformed response', () => {
    expect(extractCommonsAttribution({}, 'x.jpg')).toBeNull();
    expect(extractCommonsAttribution(null, 'x.jpg')).toBeNull();
  });
});
