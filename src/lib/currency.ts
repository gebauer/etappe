/**
 * Cross-currency conversion for the budget popover (WORK 16.10).
 *
 * A trip has one currency (`trips.currency`, silently EUR today — settled
 * with the author 2026-09-02 as a placeholder for a real trip-creation
 * setting later). A cost can be entered in a different one — the point of
 * asking, since a fuel receipt in ISK shouldn't need mental math before it
 * goes in. `convert()` is pure: given a same-shaped set of rates, turn one
 * amount in one currency into another. Fetching and caching those rates is
 * a separate, impure concern — see `exchange-rates.ts`.
 */

/** A reasonably small, curated set rather than all ~180 ISO codes — every
 * one of these is covered by the free rate source this app uses (verified
 * against ISK specifically, since Iceland is the worked example throughout
 * this project and some free providers omit it). Extend if a real trip
 * needs a currency not here; nothing else assumes this list is exhaustive. */
export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'ISK',
  'NOK',
  'SEK',
  'DKK',
  'CHF',
  'CAD',
  'AUD',
  'JPY',
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === 'string' &&
    (CURRENCIES as readonly string[]).includes(value)
  );
}

/** Rates are always expressed as "1 unit of `base` equals `rates[code]` units
 * of `code`" — the shape a typical free rate API already returns, so no
 * client-side inversion is needed for the common case (converting *from*
 * the base). Converting *to* the base, or between two non-base currencies,
 * divides/cross-multiplies through it instead. */
export interface ExchangeRates {
  base: CurrencyCode;
  rates: Partial<Record<CurrencyCode, number>>;
}

/**
 * Converts `amount` from `from` to `to`. Returns `null` when the rates
 * available don't cover the pair — a stale or partial cache, or a currency
 * the free source doesn't carry — so the caller can show "—" rather than a
 * silently wrong number.
 */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates,
): number | null {
  if (from === to) return amount;
  if (from === rates.base) {
    const r = rates.rates[to];
    return r != null ? amount * r : null;
  }
  if (to === rates.base) {
    const r = rates.rates[from];
    return r != null ? amount / r : null;
  }
  const rFrom = rates.rates[from];
  const rTo = rates.rates[to];
  if (rFrom == null || rTo == null) return null;
  // amount(from) -> base -> to
  return (amount / rFrom) * rTo;
}
