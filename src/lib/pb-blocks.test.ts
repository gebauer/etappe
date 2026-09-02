import { describe, it, expect } from 'vitest';
import { blocksFor, reorderBlock } from './pb-blocks';
import type { BlocksResponse } from '../types/pb';

/** A partial `BlocksResponse` — loosely typed so a test can pass a plain
 * `created` string past the branded `IsoAutoDateString`. */
function block(p: Record<string, unknown>): BlocksResponse {
  return {
    id: 'x',
    collectionId: '',
    collectionName: 'blocks',
    trip: 't1',
    parent_type: 'poi',
    parent_id: 'p1',
    kind: 'note',
    visibility: 'trip',
    creator: 'u1',
    created: '2026-01-01 00:00:00.000Z',
    updated: '2026-01-01 00:00:00.000Z',
    body: '',
    title: '',
    url: '',
    file: '',
    lat: 0,
    lon: 0,
    taken_at: '',
    attribution_author: '',
    attribution_licence: '',
    attribution_url: '',
    ...p,
  } as unknown as BlocksResponse;
}

describe('blocksFor', () => {
  it('filters to the parent and orders by order_index', () => {
    const all = [
      block({ id: 'b', parent_id: 'p1', order_index: 1 }),
      block({ id: 'a', parent_id: 'p1', order_index: 0 }),
      block({ id: 'other', parent_id: 'p2', order_index: 0 }),
    ];
    expect(blocksFor(all, 'poi', 'p1').map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('falls back to creation order when order_index is missing', () => {
    // The capture and import paths append blocks without an order_index, so
    // without the `created` tiebreaker every one sorts as 0 and "the first
    // photo" (the cover) is whatever the fetch happened to return.
    const all = [
      block({ id: 'late', created: '2026-01-03 00:00:00.000Z' }),
      block({ id: 'early', created: '2026-01-01 00:00:00.000Z' }),
      block({ id: 'mid', created: '2026-01-02 00:00:00.000Z' }),
    ];
    expect(blocksFor(all, 'poi', 'p1').map((b) => b.id)).toEqual([
      'early',
      'mid',
      'late',
    ]);
  });

  it('an explicit order_index still wins over creation order', () => {
    const all = [
      block({ id: 'first-made', created: '2026-01-01', order_index: 2 }),
      block({ id: 'last-made', created: '2026-01-09', order_index: 0 }),
    ];
    expect(blocksFor(all, 'poi', 'p1').map((b) => b.id)).toEqual([
      'last-made',
      'first-made',
    ]);
  });
});

describe('reorderBlock', () => {
  function fakeBatch() {
    const writes: { id: string; data: unknown }[] = [];
    return {
      writes,
      pb: {
        createBatch: () => ({
          collection: () => ({
            update: (id: string, data: unknown) => writes.push({ id, data }),
          }),
          send: async () => {},
        }),
      } as never,
    };
  }

  const siblings = [
    block({ id: 'a', order_index: 0 }),
    block({ id: 'b', order_index: 1 }),
    block({ id: 'c', order_index: 2 }),
    block({ id: 'd', order_index: 3 }),
  ];

  it('moves a block down and only rewrites the affected span', async () => {
    const { pb, writes } = fakeBatch();
    await reorderBlock(pb, siblings, 'a', 2); // a -> position 2: b,c,a,d
    expect(
      writes.map((w) => [
        w.id,
        (w.data as { order_index: number }).order_index,
      ]),
    ).toEqual([
      ['b', 0],
      ['c', 1],
      ['a', 2],
    ]);
  });

  it('is a no-op when the target position is unchanged', async () => {
    const { pb, writes } = fakeBatch();
    await reorderBlock(pb, siblings, 'b', 1);
    expect(writes).toHaveLength(0);
  });

  it('clamps an out-of-range target', async () => {
    const { pb, writes } = fakeBatch();
    await reorderBlock(pb, siblings, 'a', 99); // -> b,c,d,a
    expect(writes.map((w) => w.id)).toEqual(['b', 'c', 'd', 'a']);
  });
});
