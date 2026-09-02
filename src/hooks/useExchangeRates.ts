import { useEffect, useState } from 'react';
import { getExchangeRates } from '../lib/exchange-rates';
import type { CurrencyCode, ExchangeRates } from '../lib/currency';

/** `null` while loading or on failure (offline, no cache yet) — the budget
 * popover falls back to showing amounts unconverted rather than crashing;
 * see `BudgetPopover`. */
export function useExchangeRates(base: CurrencyCode): ExchangeRates | null {
  const [rates, setRates] = useState<ExchangeRates | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRates(null);
    getExchangeRates(base)
      .then((r) => {
        if (!cancelled) setRates(r);
      })
      .catch(() => {
        if (!cancelled) setRates(null);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  return rates;
}
