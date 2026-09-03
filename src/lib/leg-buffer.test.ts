import { describe, it, expect } from 'vitest';
import {
  formatBufferOverride,
  parseBufferOverride,
  type BufferOverride,
} from './leg-buffer';

describe('parseBufferOverride', () => {
  it('reads a trailing % as a percentage', () => {
    expect(parseBufferOverride('12%')).toEqual({ unit: 'pct', value: 12 });
    expect(parseBufferOverride(' 7 % ')).toEqual({ unit: 'pct', value: 7 });
    expect(parseBufferOverride('7.5%')).toEqual({ unit: 'pct', value: 7.5 });
  });

  it('reads a bare number as flat minutes', () => {
    expect(parseBufferOverride('12')).toEqual({ unit: 'min', value: 12 });
    expect(parseBufferOverride(' 12 ')).toEqual({ unit: 'min', value: 12 });
  });

  it('treats empty as no override', () => {
    expect(parseBufferOverride('')).toBeNull();
    expect(parseBufferOverride('   ')).toBeNull();
    expect(parseBufferOverride(null)).toBeNull();
    expect(parseBufferOverride(undefined)).toBeNull();
  });

  it('keeps a deliberate zero distinct from empty', () => {
    // The whole reason the field is text: "" falls back to the trip
    // default, "0" means this leg genuinely gets no buffer.
    expect(parseBufferOverride('0')).toEqual({ unit: 'min', value: 0 });
    expect(parseBufferOverride('0%')).toEqual({ unit: 'pct', value: 0 });
  });

  it('refuses anything that is not a buffer', () => {
    expect(parseBufferOverride('soon')).toBe('invalid');
    expect(parseBufferOverride('-5')).toBe('invalid');
    expect(parseBufferOverride('-5%')).toBe('invalid');
    expect(parseBufferOverride('10 min')).toBe('invalid');
    expect(parseBufferOverride('%')).toBe('invalid');
    expect(parseBufferOverride('1%%')).toBe('invalid');
  });
});

describe('formatBufferOverride', () => {
  it('round-trips every parseable form', () => {
    for (const text of ['12%', '12', '0', '0%', '7.5%']) {
      const parsed = parseBufferOverride(text) as BufferOverride;
      expect(formatBufferOverride(parsed)).toBe(text);
    }
  });

  it('renders no override as empty', () => {
    expect(formatBufferOverride(null)).toBe('');
  });
});
