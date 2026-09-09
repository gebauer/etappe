import { describe, it, expect } from 'vitest';
import { clampIndex, stepIndex, swipeStep, SWIPE_MIN_PX } from './stop-step';

describe('stepIndex', () => {
  it('moves forward and back', () => {
    expect(stepIndex(0, 4, 1)).toBe(1);
    expect(stepIndex(2, 4, -1)).toBe(1);
  });

  it('wraps at both ends', () => {
    expect(stepIndex(3, 4, 1)).toBe(0);
    expect(stepIndex(0, 4, -1)).toBe(3);
  });

  it('stays put in a one-stop day', () => {
    expect(stepIndex(0, 1, 1)).toBe(0);
    expect(stepIndex(0, 1, -1)).toBe(0);
  });

  it('survives an empty day', () => {
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});

describe('clampIndex', () => {
  it('pulls an index back inside a day that shrank', () => {
    expect(clampIndex(5, 3)).toBe(2);
  });

  it('leaves a valid index alone', () => {
    expect(clampIndex(1, 3)).toBe(1);
  });

  it('floors at zero, including for an empty day', () => {
    expect(clampIndex(-2, 3)).toBe(0);
    expect(clampIndex(2, 0)).toBe(0);
  });
});

describe('swipeStep', () => {
  it('ignores a drag at or under the threshold', () => {
    expect(swipeStep(SWIPE_MIN_PX)).toBeNull();
    expect(swipeStep(-SWIPE_MIN_PX)).toBeNull();
    expect(swipeStep(0)).toBeNull();
  });

  it('reads a left drag as the next stop', () => {
    expect(swipeStep(-60)).toBe(1);
  });

  it('reads a right drag as the previous stop', () => {
    expect(swipeStep(60)).toBe(-1);
  });
});
