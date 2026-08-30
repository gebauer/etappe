import { describe, it, expect } from 'vitest';
import { planInsertBetween, planDeleteStop, type LegLike } from './pb-legs';
import { isRoutable, createPocketBaseRouting } from './routing';
import type { TypedPocketBase } from '../types/pb';

const leg = (
  id: string,
  from: string,
  to: string,
  over: Partial<LegLike> = {},
): LegLike => ({
  id,
  from_stop: from,
  to_stop: to,
  mode: 'car',
  surface: 'gravel',
  ...over,
});

describe('planInsertBetween', () => {
  it('splits the existing leg, inheriting its mode/surface', () => {
    const existing = leg('L', 'A', 'C', { mode: 'car', surface: 'gravel' });
    const plan = planInsertBetween(existing, 'A', 'B', 'C');
    expect(plan.deleteLegIds).toEqual(['L']);
    expect(plan.create).toEqual([
      { from_stop: 'A', to_stop: 'B', mode: 'car', surface: 'gravel' },
      { from_stop: 'B', to_stop: 'C', mode: 'car', surface: 'gravel' },
    ]);
  });

  it('inserting at the start adds one leg and deletes nothing', () => {
    const plan = planInsertBetween(null, null, 'B', 'C');
    expect(plan.deleteLegIds).toEqual([]);
    expect(plan.create).toEqual([
      { from_stop: 'B', to_stop: 'C', mode: 'car', surface: null },
    ]);
  });

  it('inserting at the end adds one leg', () => {
    const plan = planInsertBetween(null, 'A', 'B', null);
    expect(plan.create).toEqual([
      { from_stop: 'A', to_stop: 'B', mode: 'car', surface: null },
    ]);
  });

  it('inserting into an empty day creates no legs', () => {
    expect(planInsertBetween(null, null, 'B', null)).toEqual({
      deleteLegIds: [],
      create: [],
    });
  });
});

describe('planDeleteStop', () => {
  it('merges the two legs, inheriting the incoming leg', () => {
    const incoming = leg('L1', 'A', 'B', { mode: 'car', surface: 'paved' });
    const outgoing = leg('L2', 'B', 'C', { mode: 'car', surface: 'froad' });
    const plan = planDeleteStop(incoming, outgoing, 'A', 'C');
    expect(plan.deleteLegIds).toEqual(['L1', 'L2']);
    expect(plan.create).toEqual([
      { from_stop: 'A', to_stop: 'C', mode: 'car', surface: 'paved' },
    ]);
  });

  it('deleting the first stop removes its outgoing leg, merges nothing', () => {
    const outgoing = leg('L2', 'B', 'C');
    const plan = planDeleteStop(null, outgoing, null, 'C');
    expect(plan.deleteLegIds).toEqual(['L2']);
    expect(plan.create).toEqual([]);
  });

  it('deleting the last stop removes its incoming leg, merges nothing', () => {
    const incoming = leg('L1', 'A', 'B');
    const plan = planDeleteStop(incoming, null, 'A', null);
    expect(plan.deleteLegIds).toEqual(['L1']);
    expect(plan.create).toEqual([]);
  });

  it('deleting a lone stop is a no-op', () => {
    expect(planDeleteStop(null, null, null, null)).toEqual({
      deleteLegIds: [],
      create: [],
    });
  });
});

describe('isRoutable', () => {
  it('routes car legs only', () => {
    expect(isRoutable('car')).toBe(true);
    for (const m of ['walk', 'flight', 'ferry', 'bike', 'other']) {
      expect(isRoutable(m)).toBe(false);
    }
  });
});

describe('createPocketBaseRouting', () => {
  it('POSTs to /api/route with the coordinate pair and profile', async () => {
    const calls: Array<{ path: string; options: unknown }> = [];
    const pb = {
      send: async (path: string, options: unknown) => {
        calls.push({ path, options });
        return {
          duration_min: 100,
          distance_m: 118000,
          geometry: {},
          cached: true,
        };
      },
    } as unknown as TypedPocketBase;

    const routing = createPocketBaseRouting(pb);
    const result = await routing.route(
      { lat: 64, lon: -21 },
      { lat: 63, lon: -22 },
    );

    expect(result.duration_min).toBe(100);
    expect(calls).toEqual([
      {
        path: '/api/route',
        options: {
          method: 'POST',
          body: {
            from: { lat: 64, lon: -21 },
            to: { lat: 63, lon: -22 },
            profile: 'driving-car',
          },
        },
      },
    ]);
  });
});
