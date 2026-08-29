import { describe, it, expect } from 'vitest';
import {
  planInsertDay,
  planDeleteDay,
  planMoveDay,
  blocksOnDays,
  type DayOrder,
} from './day-ordering';

// Helper: a contiguous 0-based run of days a,b,c,...
function days(...ids: string[]): DayOrder[] {
  return ids.map((id, order_index) => ({ id, order_index }));
}

describe('planInsertDay', () => {
  it('inserting at the end shifts nothing', () => {
    const plan = planInsertDay(days('a', 'b', 'c'), 3);
    expect(plan.newOrderIndex).toBe(3);
    expect(plan.updates).toEqual([]);
    expect(plan.changedDayIds).toEqual([]);
  });

  it('inserting at the front shifts every existing day down', () => {
    const plan = planInsertDay(days('a', 'b', 'c'), 0);
    expect(plan.newOrderIndex).toBe(0);
    expect(plan.updates).toEqual([
      { id: 'a', order_index: 1 },
      { id: 'b', order_index: 2 },
      { id: 'c', order_index: 3 },
    ]);
    expect(plan.changedDayIds).toEqual(['a', 'b', 'c']);
  });

  it('inserting in the middle shifts only the tail', () => {
    const plan = planInsertDay(days('a', 'b', 'c', 'd'), 2);
    expect(plan.newOrderIndex).toBe(2);
    expect(plan.updates).toEqual([
      { id: 'c', order_index: 3 },
      { id: 'd', order_index: 4 },
    ]);
  });

  it('clamps an out-of-range position to the end', () => {
    const plan = planInsertDay(days('a', 'b'), 99);
    expect(plan.newOrderIndex).toBe(2);
    expect(plan.updates).toEqual([]);
  });

  it('inserting into an empty trip yields index 0', () => {
    const plan = planInsertDay([], 0);
    expect(plan.newOrderIndex).toBe(0);
    expect(plan.updates).toEqual([]);
  });
});

describe('planDeleteDay', () => {
  it('deleting the first day shifts the rest up', () => {
    const plan = planDeleteDay(days('a', 'b', 'c'), 'a');
    expect(plan.updates).toEqual([
      { id: 'b', order_index: 0 },
      { id: 'c', order_index: 1 },
    ]);
    expect(plan.changedDayIds).toEqual(['b', 'c']);
  });

  it('deleting the last day shifts nothing', () => {
    const plan = planDeleteDay(days('a', 'b', 'c'), 'c');
    expect(plan.updates).toEqual([]);
  });

  it('deleting a middle day shifts only the tail', () => {
    const plan = planDeleteDay(days('a', 'b', 'c', 'd'), 'b');
    expect(plan.updates).toEqual([
      { id: 'c', order_index: 1 },
      { id: 'd', order_index: 2 },
    ]);
  });

  it('deleting an unknown day is a no-op', () => {
    expect(planDeleteDay(days('a', 'b'), 'z').updates).toEqual([]);
  });
});

describe('planMoveDay', () => {
  it('moving a day earlier shifts the days it passes', () => {
    const plan = planMoveDay(days('a', 'b', 'c', 'd'), 'd', 1);
    // final order: a, d, b, c
    expect(plan.updates).toEqual([
      { id: 'd', order_index: 1 },
      { id: 'b', order_index: 2 },
      { id: 'c', order_index: 3 },
    ]);
  });

  it('moving a day later shifts the days it passes', () => {
    const plan = planMoveDay(days('a', 'b', 'c', 'd'), 'a', 2);
    // final order: b, c, a, d
    expect(plan.updates).toEqual([
      { id: 'b', order_index: 0 },
      { id: 'c', order_index: 1 },
      { id: 'a', order_index: 2 },
    ]);
  });

  it('moving to the same position is a no-op', () => {
    expect(planMoveDay(days('a', 'b', 'c'), 'b', 1).updates).toEqual([]);
  });

  it('moving an unknown day is a no-op', () => {
    expect(planMoveDay(days('a', 'b'), 'z', 0).updates).toEqual([]);
  });
});

describe('reindex plans persist no absolute date', () => {
  it('updates only ever carry id and order_index', () => {
    const plans = [
      planInsertDay(days('a', 'b'), 0),
      planDeleteDay(days('a', 'b', 'c'), 'a'),
      planMoveDay(days('a', 'b', 'c'), 'c', 0),
    ];
    for (const plan of plans) {
      for (const update of plan.updates) {
        expect(Object.keys(update).sort()).toEqual(['id', 'order_index']);
      }
    }
  });
});

describe('blocksOnDays', () => {
  const blocks = [
    { id: 'b1', parent_type: 'day', parent_id: 'a' },
    { id: 'b2', parent_type: 'day', parent_id: 'b' },
    { id: 'b3', parent_type: 'stop', parent_id: 'a' },
    { id: 'b4', parent_type: 'day', parent_id: 'c' },
  ];

  it('returns only day-parented blocks on the changed days', () => {
    expect(blocksOnDays(['a', 'c'], blocks).map((b) => b.id)).toEqual([
      'b1',
      'b4',
    ]);
  });

  it('ignores stop-parented blocks even on a changed day', () => {
    expect(blocksOnDays(['a'], blocks).map((b) => b.id)).toEqual(['b1']);
  });

  it('returns nothing when no days changed', () => {
    expect(blocksOnDays([], blocks)).toEqual([]);
  });
});
