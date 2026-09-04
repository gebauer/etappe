import { describe, it, expect } from 'vitest';
import {
  tripStatus,
  costBand,
  compareTripCards,
  type TripCard,
} from './trip-card';

describe('tripStatus', () => {
  const now = new Date('2027-06-15T12:00:00');

  it('is a draft when the trip has no days', () => {
    expect(tripStatus('2027-06-20', 0, now)).toEqual({
      kind: 'draft',
      label: 'Draft',
    });
  });

  it('counts days until an upcoming trip', () => {
    expect(tripStatus('2027-06-20', 5, now)).toEqual({
      kind: 'upcoming',
      label: 'In 5 days',
    });
    expect(tripStatus('2027-06-16', 5, now).label).toBe('Tomorrow');
  });

  it('reads the current day while a trip is in progress', () => {
    // starts 3 days ago, 10-day trip → day 4
    expect(tripStatus('2027-06-12', 10, now)).toEqual({
      kind: 'progress',
      label: 'Day 4',
    });
  });

  it('is past once the last day is behind us', () => {
    expect(tripStatus('2027-06-01', 5, now)).toEqual({
      kind: 'past',
      label: 'Past',
    });
  });
});

describe('costBand', () => {
  it('is empty for no spend, then tiers up', () => {
    expect(costBand(0)).toBe('');
    expect(costBand(-3)).toBe('');
    expect(costBand(50)).toBe('€');
    expect(costBand(500)).toBe('€');
    expect(costBand(501)).toBe('€€');
    expect(costBand(2000)).toBe('€€');
    expect(costBand(2001)).toBe('€€€');
  });
});

describe('compareTripCards', () => {
  const card = (over: {
    status: TripCard['status'];
    start_date?: string;
    updated?: string;
  }): TripCard =>
    ({
      trip: {
        start_date: over.start_date ?? '2027-01-01',
        updated: over.updated ?? '2027-01-01 00:00:00',
      },
      status: over.status,
    }) as unknown as TripCard;

  it('orders in-progress, then upcoming, then drafts, then past', () => {
    const cards = [
      card({ status: { kind: 'past', label: 'Past' } }),
      card({ status: { kind: 'draft', label: 'Draft' } }),
      card({ status: { kind: 'upcoming', label: '' } }),
      card({ status: { kind: 'progress', label: 'Day 1' } }),
    ];
    expect(cards.sort(compareTripCards).map((c) => c.status.kind)).toEqual([
      'progress',
      'upcoming',
      'draft',
      'past',
    ]);
  });

  it('sorts upcoming by soonest start and past by most recent', () => {
    const up = [
      card({
        status: { kind: 'upcoming', label: '' },
        start_date: '2027-08-01',
      }),
      card({
        status: { kind: 'upcoming', label: '' },
        start_date: '2027-07-01',
      }),
    ];
    expect(up.sort(compareTripCards).map((c) => c.trip.start_date)).toEqual([
      '2027-07-01',
      '2027-08-01',
    ]);

    const past = [
      card({
        status: { kind: 'past', label: 'Past' },
        start_date: '2025-01-01',
      }),
      card({
        status: { kind: 'past', label: 'Past' },
        start_date: '2026-01-01',
      }),
    ];
    expect(past.sort(compareTripCards).map((c) => c.trip.start_date)).toEqual([
      '2026-01-01',
      '2025-01-01',
    ]);
  });
});
