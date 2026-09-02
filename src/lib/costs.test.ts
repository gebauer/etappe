import { describe, it, expect } from 'vitest';
import {
  sumCosts,
  costsFor,
  dayTotal,
  tripTotal,
  byCategory,
  budgetByKind,
  formatMoney,
} from './costs';
import type { CostsResponse, StopsResponse, PoisResponse } from '../types/pb';
import type { ExchangeRates } from './currency';

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

const rates: ExchangeRates = { base: 'EUR', rates: { ISK: 145 } };

describe('budgetByKind', () => {
  const stops = [
    { id: 'hotel1', kind: 'hotel' },
    { id: 'flight1', kind: 'airport' },
    { id: 'car1', kind: 'rental' },
    { id: 'gas1', kind: 'fuel' },
    { id: 'fall1', kind: 'waterfall' },
  ] as unknown as StopsResponse[];
  const pois: PoisResponse[] = [];

  function cost(
    parentId: string,
    amount: number,
    currency = 'EUR',
  ): CostsResponse {
    return {
      id: `c-${parentId}`,
      parent_type: 'stop',
      parent_id: parentId,
      amount,
      currency,
      label: '',
    } as unknown as CostsResponse;
  }

  it('buckets each cost by its parent stop’s current kind', () => {
    const b = budgetByKind(
      [cost('hotel1', 100), cost('flight1', 200), cost('fall1', 30)],
      stops,
      pois,
      'EUR',
      rates,
    );
    const byKey = Object.fromEntries(b.buckets.map((x) => [x.key, x.total]));
    expect(byKey).toMatchObject({
      accommodation: 100,
      flights: 200,
      rental: 0,
      sightseeing: 30,
    });
    expect(b.total).toBe(330);
    expect(b.unconverted).toBe(0);
  });

  it('merges rental and fuel into one bucket', () => {
    const b = budgetByKind(
      [cost('car1', 50), cost('gas1', 20)],
      stops,
      pois,
      'EUR',
      rates,
    );
    const rental = b.buckets.find((x) => x.key === 'rental')!;
    expect(rental.total).toBe(70);
    expect(rental.count).toBe(2);
  });

  it('labels the rental bucket "+ fuel" only when a fuel cost exists', () => {
    const withoutFuel = budgetByKind(
      [cost('car1', 50)],
      stops,
      pois,
      'EUR',
      rates,
    );
    const withFuel = budgetByKind(
      [cost('car1', 50), cost('gas1', 20)],
      stops,
      pois,
      'EUR',
      rates,
    );
    expect(withoutFuel.buckets.find((x) => x.key === 'rental')!.label).toBe(
      'Rental car',
    );
    expect(withFuel.buckets.find((x) => x.key === 'rental')!.label).toBe(
      'Rental car + fuel',
    );
  });

  it('converts a cost entered in a different currency', () => {
    const b = budgetByKind(
      [cost('hotel1', 14500, 'ISK')],
      stops,
      pois,
      'EUR',
      rates,
    );
    expect(b.buckets.find((x) => x.key === 'accommodation')!.total).toBe(100);
  });

  it('counts an unconvertible cost as unconverted rather than guessing', () => {
    const b = budgetByKind(
      [cost('hotel1', 100, 'NOK')], // no NOK rate cached
      stops,
      pois,
      'EUR',
      rates,
    );
    expect(b.total).toBe(0);
    expect(b.unconverted).toBe(1);
  });

  it('falls back to same-currency-only totals with no rates at all', () => {
    const b = budgetByKind(
      [cost('hotel1', 100, 'EUR'), cost('flight1', 50, 'ISK')],
      stops,
      pois,
      'EUR',
      null,
    );
    expect(b.buckets.find((x) => x.key === 'accommodation')!.total).toBe(100);
    expect(b.unconverted).toBe(1);
  });

  it('does not count a cost whose parent no longer exists', () => {
    const b = budgetByKind(
      [cost('deleted-stop', 100)],
      stops,
      pois,
      'EUR',
      rates,
    );
    expect(b.total).toBe(0);
    expect(b.unconverted).toBe(1);
  });
});

describe('formatMoney', () => {
  it('drops needless decimals but keeps real ones', () => {
    expect(formatMoney(40, 'EUR')).toBe('40 EUR');
    expect(formatMoney(12.5, 'EUR')).toBe('12.50 EUR');
    expect(formatMoney(12.345, 'EUR')).toBe('12.35 EUR');
  });
});
