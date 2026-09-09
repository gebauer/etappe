import { describe, it, expect } from 'vitest';
import {
  lockBlocks,
  lockChipLabel,
  lockRefusalMessage,
  tripLockOf,
  isTripLock,
  type LockScope,
} from './trip-lock';

const SCOPES: LockScope[] = ['itinerary', 'wishlist', 'days'];

describe('lockBlocks', () => {
  it('blocks nothing when the trip is open', () => {
    for (const scope of SCOPES) expect(lockBlocks('', scope)).toBe(false);
  });

  it('blocks only day structure at the "days" level', () => {
    expect(lockBlocks('days', 'days')).toBe(true);
    expect(lockBlocks('days', 'itinerary')).toBe(false);
    expect(lockBlocks('days', 'wishlist')).toBe(false);
  });

  it('blocks the itinerary and day structure at the "all" level', () => {
    expect(lockBlocks('all', 'days')).toBe(true);
    expect(lockBlocks('all', 'itinerary')).toBe(true);
  });

  it('never blocks the wishlist — it stays a scratchpad at every level', () => {
    expect(lockBlocks('days', 'wishlist')).toBe(false);
    expect(lockBlocks('all', 'wishlist')).toBe(false);
  });
});

describe('tripLockOf', () => {
  it('reads a stored level', () => {
    expect(tripLockOf({ locked: 'all' })).toBe('all');
    expect(tripLockOf({ locked: 'days' })).toBe('days');
  });

  it('treats an unset, empty or absent field as open', () => {
    expect(tripLockOf({ locked: '' })).toBe('');
    expect(tripLockOf({})).toBe('');
    expect(tripLockOf(null)).toBe('');
  });

  it('falls back to open for a value outside the enum', () => {
    // A row written by a newer client, or a hand-edited record.
    expect(tripLockOf({ locked: 'something-else' })).toBe('');
  });
});

describe('isTripLock', () => {
  it('accepts the enum and rejects everything else', () => {
    expect(isTripLock('')).toBe(true);
    expect(isTripLock('days')).toBe(true);
    expect(isTripLock('all')).toBe(true);
    expect(isTripLock('locked')).toBe(false);
    expect(isTripLock(null)).toBe(false);
    expect(isTripLock(1)).toBe(false);
  });
});

describe('lockChipLabel', () => {
  it('names each locked level and stays silent when open', () => {
    expect(lockChipLabel('')).toBeNull();
    expect(lockChipLabel('days')).toBe('Days locked');
    expect(lockChipLabel('all')).toBe('Locked');
  });
});

describe('lockRefusalMessage', () => {
  it('always names the way out, so a refusal never reads as a broken app', () => {
    for (const lock of ['days', 'all'] as const) {
      for (const scope of SCOPES) {
        expect(lockRefusalMessage(lock, scope)).toContain('header to unlock');
      }
    }
  });

  it('says specifically that days are locked when only they are', () => {
    expect(lockRefusalMessage('days', 'days')).toMatch(/Days are locked/);
    expect(lockRefusalMessage('all', 'itinerary')).toMatch(/trip is locked/);
  });
});
