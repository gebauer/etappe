import { describe, it, expect } from 'vitest';
import {
  findDuplicate,
  planMerge,
  planReplace,
  type ExistingPlace,
} from './import-dedupe';
import type { Highlight } from './import-highlights';
import type { BlocksResponse } from '../types/pb';

const gullfoss: ExistingPlace = {
  id: 'p1',
  kind: 'poi',
  title: 'Gullfoss',
  placeKind: 'waterfall',
  lat: 64.3271,
  lon: -20.1199,
  where: 'on the wishlist',
};

function highlight(over: Partial<Highlight> = {}): Highlight {
  return {
    title: 'Gullfoss',
    kind: 'waterfall',
    links: [],
    photos: [],
    ...over,
  } as Highlight;
}

describe('findDuplicate', () => {
  it('matches a place a few metres away', () => {
    const match = findDuplicate(highlight({ lat: 64.3272, lon: -20.12 }), [
      gullfoss,
    ]);
    expect(match?.reason).toBe('distance');
    expect(match?.existing.id).toBe('p1');
    expect(match!.distanceM).toBeLessThan(100);
  });

  it('does not match the same name far away', () => {
    const match = findDuplicate(
      highlight({ title: 'Gullfoss', lat: 65.5, lon: -18 }),
      [gullfoss],
    );
    expect(match).toBeNull();
  });

  it('falls back to the title when the incoming entry has no coordinates', () => {
    const match = findDuplicate(highlight(), [gullfoss]);
    expect(match?.reason).toBe('title');
  });

  it('matches a title through case, accents and punctuation', () => {
    const match = findDuplicate(highlight({ title: '  gullfoss!  ' }), [
      gullfoss,
    ]);
    expect(match?.reason).toBe('title');
  });

  it('takes the nearest of several candidates', () => {
    const other: ExistingPlace = {
      ...gullfoss,
      id: 'p2',
      lat: 64.3273,
      lon: -20.1201,
    };
    const match = findDuplicate(highlight({ lat: 64.32731, lon: -20.12011 }), [
      gullfoss,
      other,
    ]);
    expect(match?.existing.id).toBe('p2');
  });

  it('matches an itinerary stop too — a poi is a stop without a day', () => {
    const stop: ExistingPlace = {
      ...gullfoss,
      id: 's1',
      kind: 'stop',
      where: 'on day 3',
    };
    expect(findDuplicate(highlight(), [stop])?.existing.kind).toBe('stop');
  });

  it('treats PocketBase’s 0 coordinates as never located', () => {
    // An unset number comes back as 0, which is a real place in the Gulf of
    // Guinea — matching it by distance would put every unlocated idea
    // thousands of km from everything.
    const unlocated: ExistingPlace = { ...gullfoss, lat: 0, lon: 0 };
    const match = findDuplicate(highlight({ lat: 64.3271, lon: -20.1199 }), [
      unlocated,
    ]);
    expect(match?.reason).toBe('title');
  });

  it('fills coordinates onto a record whose 0s mean unset', () => {
    const plan = planMerge(
      { ...gullfoss, lat: 0, lon: 0 },
      [],
      highlight({ lat: 64.3, lon: -20.1 }),
    );
    expect(plan.fields).toMatchObject({ lat: 64.3, lon: -20.1 });
  });

  it('finds nothing in an empty trip', () => {
    expect(findDuplicate(highlight(), [])).toBeNull();
  });
});

const blocks = [
  {
    id: 'b1',
    kind: 'note',
    body: 'Already known',
    parent_type: 'poi',
    parent_id: 'p1',
  },
  {
    id: 'b2',
    kind: 'link',
    url: 'https://known.example/',
    parent_type: 'poi',
    parent_id: 'p1',
  },
] as unknown as BlocksResponse[];

describe('planMerge', () => {
  it('fills only empty fields, never overwriting', () => {
    const plan = planMerge(gullfoss, blocks, highlight({ kind: 'canyon' }));
    expect(plan.fields.kind).toBeUndefined();
    expect(plan.fields.lat).toBeUndefined();
  });

  it('treats uncategorized as empty, since that is the taxonomy’s blank', () => {
    const plan = planMerge(
      { ...gullfoss, placeKind: 'uncategorized' },
      blocks,
      highlight({ kind: 'waterfall' }),
    );
    expect(plan.fields.kind).toBe('waterfall');
  });

  it('fills coordinates the existing record never had', () => {
    const plan = planMerge(
      { ...gullfoss, lat: null, lon: null },
      blocks,
      highlight({ lat: 64.3, lon: -20.1 }),
    );
    expect(plan.fields).toMatchObject({ lat: 64.3, lon: -20.1 });
  });

  it('accumulates a new note, and drops one already there', () => {
    const plan = planMerge(
      gullfoss,
      blocks,
      highlight({ description: 'Something new', notes: 'Already known' }),
    );
    expect(plan.blocks.notes).toEqual(['Something new']);
  });

  it('accumulates links and photos, deduplicating on the URL', () => {
    const plan = planMerge(
      gullfoss,
      blocks,
      highlight({
        links: [
          { url: 'https://known.example/' },
          { url: 'https://new.example/', title: 'New' },
        ],
        photos: [{ url: 'https://photo.example/a.jpg' }],
      }),
    );
    expect(plan.blocks.links.map((l) => l.url)).toEqual([
      'https://new.example/',
    ]);
    expect(plan.blocks.photos).toHaveLength(1);
  });
});

describe('planReplace', () => {
  it('overwrites the fields the incoming entry has', () => {
    const plan = planReplace(
      gullfoss,
      blocks,
      highlight({ title: 'Gullfoss waterfall', kind: 'canyon', lat: 64.9 }),
    );
    expect(plan.fields).toMatchObject({
      title: 'Gullfoss waterfall',
      kind: 'canyon',
      lat: 64.9,
    });
  });

  it('still accumulates blocks — replacing text is no reason to lose photos', () => {
    const plan = planReplace(
      gullfoss,
      blocks,
      highlight({ photos: [{ url: 'https://photo.example/a.jpg' }] }),
    );
    expect(plan.blocks.photos).toHaveLength(1);
  });

  it('leaves a field the incoming entry does not have alone', () => {
    const plan = planReplace(gullfoss, blocks, highlight({ title: 'X' }));
    expect(plan.fields.lon).toBeUndefined();
  });
});
