import { describe, it, expect } from 'vitest';
import { TAXONOMY, KINDS, isKind, defaultDwell } from './taxonomy';

describe('taxonomy', () => {
  it('is the closed set of 26 kinds from BUILD §7', () => {
    expect(KINDS).toHaveLength(26);
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
