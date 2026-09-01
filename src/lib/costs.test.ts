import { describe, it, expect } from 'vitest';
import {
  sumCosts,
  costsFor,
  dayTotal,
  tripTotal,
  byCategory,
  formatMoney,
} from './costs';
import type { CostsResponse } from '../types/pb';

const costs = [
  {
    id: 'c1',
    parent_type: 'stop',
    parent_id: 's1',
    amount: 40,
    label: 'Entry',
    category: 'activities',
  },
  {
    id: 'c2',
    parent_type: 'stop',
    parent_id: 's1',
    amount: 12.5,
    label: 'Parking',
    is_estimate: true,
    category: 'transport',
  },
  {
    id: 'c3',
    parent_type: 'day',
    parent_id: 'd1',
    amount: 120,
    label: 'Hotel',
    category: 'lodging',
  },
  {
    id: 'c4',
    parent_type: 'leg',
    parent_id: 'l1',
    amount: 30,
    label: 'Ferry',
    is_estimate: true,
    category: 'transport',
  },
  {
    id: 'c5',
    parent_type: 'stop',
    parent_id: 'other',
    amount: 99,
    label: 'Elsewhere',
  },
] as unknown as CostsResponse[];

describe('sumCosts', () => {
  it('totals everything and reports how much of it is a guess', () => {
    expect(sumCosts(costs)).toEqual({
      total: 301.5,
      estimated: 42.5,
      count: 5,
    });
  });

  it('is zero for nothing', () => {
    expect(sumCosts([])).toEqual({ total: 0, estimated: 0, count: 0 });
  });
});

describe('costsFor', () => {
  it('picks one parent’s costs', () => {
    expect(costsFor(costs, 'stop', 's1').map((c) => c.id)).toEqual([
      'c1',
      'c2',
    ]);
  });
});

describe('dayTotal', () => {
  it('adds the day’s own costs to its stops’ and legs’', () => {
    expect(dayTotal(costs, 'd1', ['s1'], ['l1'])).toMatchObject({
      total: 202.5,
      estimated: 42.5,
    });
  });

  it('leaves out a stop on another day', () => {
    expect(dayTotal(costs, 'd1', ['s1']).total).toBe(172.5);
  });
});

describe('tripTotal', () => {
  it('is everything, whatever it hangs off', () => {
    expect(tripTotal(costs).total).toBe(301.5);
  });
});

describe('byCategory', () => {
  it('groups and sorts biggest first', () => {
    expect(byCategory(costs)).toEqual([
      { category: 'lodging', total: 120 },
      { category: 'uncategorized', total: 99 },
      { category: 'transport', total: 42.5 },
      { category: 'activities', total: 40 },
    ]);
  });
});

describe('formatMoney', () => {
  it('drops needless decimals but keeps real ones', () => {
    expect(formatMoney(40, 'EUR')).toBe('40 EUR');
    expect(formatMoney(12.5, 'EUR')).toBe('12.50 EUR');
    expect(formatMoney(12.345, 'EUR')).toBe('12.35 EUR');
  });
});
