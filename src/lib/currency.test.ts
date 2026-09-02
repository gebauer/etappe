import { describe, it, expect } from 'vitest';
import { convert, isCurrencyCode, type ExchangeRates } from './currency';

const rates: ExchangeRates = {
  base: 'EUR',
  rates: { ISK: 145, USD: 1.08, GBP: 0.86 },
};

describe('convert', () => {
  it('is a no-op when the currencies already match', () => {
    expect(convert(50, 'EUR', 'EUR', rates)).toBe(50);
  });

  it('converts from the base currency by multiplying', () => {
    expect(convert(10, 'EUR', 'ISK', rates)).toBe(1450);
  });

  it('converts to the base currency by dividing', () => {
    expect(convert(145, 'ISK', 'EUR', rates)).toBe(1);
  });

  it('crosses through the base between two non-base currencies', () => {
    // 108 USD -> 100 EUR -> 14500 ISK
    expect(convert(108, 'USD', 'ISK', rates)).toBeCloseTo(14500, 5);
  });

  it('returns null rather than a silently wrong number when a rate is missing', () => {
    expect(convert(10, 'EUR', 'NOK', rates)).toBeNull();
    expect(convert(10, 'NOK', 'EUR', rates)).toBeNull();
    expect(convert(10, 'NOK', 'ISK', rates)).toBeNull();
  });
});

describe('isCurrencyCode', () => {
  it('accepts a currency in the curated list', () => {
    expect(isCurrencyCode('ISK')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isCurrencyCode('XYZ')).toBe(false);
    expect(isCurrencyCode('eur')).toBe(false); // case-sensitive, matches storage
    expect(isCurrencyCode(42)).toBe(false);
  });
});
