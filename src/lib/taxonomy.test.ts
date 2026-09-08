import { describe, it, expect } from 'vitest';
import {
  TAXONOMY,
  KINDS,
  isKind,
  defaultDwell,
  defaultDwellSeed,
  isAccommodationKind,
  needsKind,
} from './taxonomy';

describe('taxonomy', () => {
  it("is the closed set of 27 kinds from BUILD §7 plus WORK 16.10's rental and cafe (2026-09-04)", () => {
    expect(KINDS).toHaveLength(28);
  });

  it('gives every kind a non-empty label and icon', () => {
    for (const kind of KINDS) {
      const entry = TAXONOMY[kind];
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.icon.length).toBeGreaterThan(0);
    }
  });

  it('gives every kind a dwell that is null or a positive integer', () => {
    for (const kind of KINDS) {
      const dwell = TAXONOMY[kind].dwell;
      if (dwell !== null) {
        expect(Number.isInteger(dwell)).toBe(true);
        expect(dwell).toBeGreaterThan(0);
      }
    }
  });

  it('marks only accommodation kinds with a null default dwell', () => {
    const nullDwell = KINDS.filter((k) => TAXONOMY[k].dwell === null).sort();
    expect(nullDwell).toEqual(['campsite', 'hotel']);
  });

  it('recognises valid kinds and rejects everything else', () => {
    expect(isKind('waterfall')).toBe(true);
    expect(isKind('uncategorized')).toBe(true);
    expect(isKind('castle')).toBe(false);
    expect(isKind('toString')).toBe(false); // not fooled by prototype props
    expect(isKind(42)).toBe(false);
  });

  it('exposes dwell via defaultDwell', () => {
    expect(defaultDwell('waterfall')).toBe(45);
    expect(defaultDwell('hotel')).toBeNull();
  });
});

describe('isAccommodationKind', () => {
  it('is true for the kinds you sleep at', () => {
    expect(isAccommodationKind('hotel')).toBe(true);
    expect(isAccommodationKind('campsite')).toBe(true);
  });

  it('is false for everything else', () => {
    expect(isAccommodationKind('waterfall')).toBe(false);
    expect(isAccommodationKind('restaurant')).toBe(false);
    expect(isAccommodationKind('uncategorized')).toBe(false);
  });

  it('agrees with the dwell seed, which omits accommodation kinds', () => {
    const seed = defaultDwellSeed();
    for (const kind of KINDS) {
      expect(kind in seed).toBe(!isAccommodationKind(kind));
    }
  });
});

describe('needsKind', () => {
  it('is true only for a real, un-picked kind', () => {
    expect(needsKind({ kind: 'uncategorized' })).toBe(true);
    expect(needsKind({ kind: 'waterfall' })).toBe(false);
    expect(needsKind({})).toBe(false);
  });

  it('never nags a waypoint — there is no kind to pick', () => {
    expect(needsKind({ kind: 'uncategorized', routing_kind: 'waypoint' })).toBe(
      false,
    );
    expect(needsKind({ kind: 'uncategorized', routing_kind: 'stop' })).toBe(
      true,
    );
    // PocketBase stores "" for an unset select, not null.
    expect(needsKind({ kind: 'uncategorized', routing_kind: '' })).toBe(true);
    expect(needsKind({ kind: 'uncategorized', routing_kind: null })).toBe(true);
  });
});
