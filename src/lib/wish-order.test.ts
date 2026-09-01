import { describe, it, expect } from 'vitest';
import {
  buildProximityChain,
  stepInChain,
  type ChainPoint,
} from './wish-order';

/** Four points on a rough west-to-east line across south Iceland, given out
 * of order so a correct chain has to reorder them. */
const POINTS: ChainPoint[] = [
  { id: 'thingvellir', lat: 64.2559, lon: -21.13 },
  { id: 'vik', lat: 63.4187, lon: -19.0063 },
  { id: 'geysir', lat: 64.3104, lon: -20.3024 },
  { id: 'skogafoss', lat: 63.5321, lon: -19.5114 },
];

describe('buildProximityChain', () => {
  it('starts at the anchor and walks to the nearest unvisited point', () => {
    expect(buildProximityChain(POINTS)).toEqual([
      'thingvellir',
      'geysir',
      'skogafoss',
      'vik',
    ]);
  });

  it('keeps every point exactly once', () => {
    const chain = buildProximityChain(POINTS);
    expect(chain).toHaveLength(POINTS.length);
    expect(new Set(chain).size).toBe(POINTS.length);
  });

  it('is stable — the anchor is fixed, so the chain never depends on selection', () => {
    expect(buildProximityChain(POINTS)).toEqual(buildProximityChain(POINTS));
  });

  it('handles the empty and single-point cases', () => {
    expect(buildProximityChain([])).toEqual([]);
    expect(buildProximityChain([POINTS[0]!])).toEqual(['thingvellir']);
  });
});

describe('stepInChain', () => {
  const chain = ['a', 'b', 'c'];

  it('steps forward and back', () => {
    expect(stepInChain(chain, 'a', 1)).toBe('b');
    expect(stepInChain(chain, 'b', -1)).toBe('a');
  });

  it('wraps at both ends', () => {
    expect(stepInChain(chain, 'c', 1)).toBe('a');
    expect(stepInChain(chain, 'a', -1)).toBe('c');
  });

  it('falls back to the first entry for an id that left the chain', () => {
    expect(stepInChain(chain, 'gone', 1)).toBe('a');
    expect(stepInChain([], 'a', 1)).toBeNull();
  });
});
