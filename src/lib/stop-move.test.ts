import { describe, it, expect } from 'vitest';
import { planStopMove, type StopPos, type LegPair } from './stop-move';

// day d1: A,B,C  day d2: X,Y  with the obvious chain legs.
const stops: StopPos[] = [
  { id: 'A', day: 'd1', order_index: 0 },
  { id: 'B', day: 'd1', order_index: 1 },
  { id: 'C', day: 'd1', order_index: 2 },
  { id: 'X', day: 'd2', order_index: 0 },
  { id: 'Y', day: 'd2', order_index: 1 },
];
const legs: LegPair[] = [
  { id: 'AB', from_stop: 'A', to_stop: 'B' },
  { id: 'BC', from_stop: 'B', to_stop: 'C' },
  { id: 'XY', from_stop: 'X', to_stop: 'Y' },
];

describe('planStopMove — within a day', () => {
  it('moving C before B reorders and rewires only the affected legs', () => {
    const plan = planStopMove(stops, legs, 'C', 'd1', 1); // A, C, B
    expect(plan.stopUpdates).toEqual([
      { id: 'B', day: 'd1', order_index: 2 },
      { id: 'C', day: 'd1', order_index: 1 },
    ]);
    // AB and BC gone; AC and CB created; XY untouched.
    expect(plan.legPlan.deleteLegIds.sort()).toEqual(['AB', 'BC']);
    expect(plan.legPlan.create).toEqual([
      { from_stop: 'A', to_stop: 'C', mode: 'car', surface: null },
      { from_stop: 'C', to_stop: 'B', mode: 'car', surface: null },
    ]);
  });

  it('moving to the same position is a no-op', () => {
    const plan = planStopMove(stops, legs, 'B', 'd1', 1);
    expect(plan.stopUpdates).toEqual([]);
    expect(plan.legPlan).toEqual({ deleteLegIds: [], create: [] });
  });
});

describe('planStopMove — across days', () => {
  it('moving B into d2 merges d1 and splices d2', () => {
    const plan = planStopMove(stops, legs, 'B', 'd2', 1); // d1: A,C  d2: X,B,Y
    expect(plan.stopUpdates).toContainEqual({
      id: 'B',
      day: 'd2',
      order_index: 1,
    });
    expect(plan.stopUpdates).toContainEqual({
      id: 'C',
      day: 'd1',
      order_index: 1,
    });
    expect(plan.stopUpdates).toContainEqual({
      id: 'Y',
      day: 'd2',
      order_index: 2,
    });
    // AB, BC, XY removed; AC (merge d1), XB + BY (splice d2) created.
    expect(plan.legPlan.deleteLegIds.sort()).toEqual(['AB', 'BC', 'XY']);
    expect(plan.legPlan.create).toEqual([
      { from_stop: 'A', to_stop: 'C', mode: 'car', surface: null },
      { from_stop: 'X', to_stop: 'B', mode: 'car', surface: null },
      { from_stop: 'B', to_stop: 'Y', mode: 'car', surface: null },
    ]);
  });

  it('moving an unknown stop is a no-op', () => {
    expect(planStopMove(stops, legs, 'Z', 'd1', 0)).toEqual({
      stopUpdates: [],
      legPlan: { deleteLegIds: [], create: [] },
    });
  });
});
