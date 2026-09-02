import { useEffect, useRef, useState } from 'react';
import { budgetByKind, formatMoney } from '../lib/costs';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { isCurrencyCode } from '../lib/currency';
import type { CostsResponse, StopsResponse, PoisResponse } from '../types/pb';

/**
 * A header glyph that becomes the trip's running cost once any stop has one
 * (design_handoff_map_first_planner revision 6, "Budget", 2026-09-02).
 * Costs are a background fact, not a planning surface — this is the one
 * place they show at all; nothing appears on the card at rest, the
 * itinerary rows or the phone strip (WORK 16.10 removed the day/trip totals
 * WORK 16.7 had put in the itinerary header, for exactly that reason).
 *
 * Bucketing and currency conversion are `budgetByKind` (`lib/costs.ts`);
 * this component is presentation and the popover's open/closed state only.
 */
export function BudgetPopover({
  costs,
  stops,
  pois,
  tripCurrency,
}: {
  costs: CostsResponse[];
  stops: StopsResponse[];
  pois: PoisResponse[];
  tripCurrency: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currency = isCurrencyCode(tripCurrency) ? tripCurrency : 'EUR';
  const rates = useExchangeRates(currency);
  const budget = budgetByKind(costs, stops, pois, currency, rates);
  const hasCost = budget.total > 0 || budget.buckets.some((b) => b.count > 0);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Trip budget"
        className={`flex h-[30px] items-center justify-center rounded-lg border font-mono text-[12.5px] ${
          hasCost ? 'px-[11px]' : 'w-[30px] px-0'
        } ${
          open
            ? 'border-[oklch(0.42_0.012_250)] bg-control-hover text-text-2'
            : 'border-[oklch(0.32_0.012_250)] bg-control text-text-2'
        }`}
      >
        {hasCost ? formatMoney(budget.total, currency) : '€'}
      </button>

      {open && (
        <div className="absolute right-0 top-[38px] z-40 w-[258px] rounded-[11px] border border-border-strong bg-surface-2 p-3 text-text shadow-card">
          <div className="flex items-baseline justify-between">
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
              Budget
            </span>
            <span className="font-mono text-[10.5px] text-text-5">
              {rates ? 'est.' : '…'} · {currency}
            </span>
          </div>
          {budget.buckets.map((b) => (
            <div
              key={b.key}
              className="mt-1.5 flex h-[26px] items-center gap-2"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-[oklch(0.84_0.007_250)]">
                {b.label}
              </span>
              <span className="flex-none font-mono text-[11px] text-text-5">
                {b.count > 0 ? b.count : ''}
              </span>
              <span
                className={`w-[68px] flex-none text-right font-mono text-[12.5px] ${
                  b.count > 0
                    ? 'text-[oklch(0.92_0.006_250)]'
                    : 'text-[oklch(0.48_0.01_250)]'
                }`}
              >
                {b.count > 0 ? formatMoney(b.total, currency) : '—'}
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="text-[12.5px] font-semibold">Total</span>
            <span className="font-mono text-[14px] font-semibold">
              {formatMoney(budget.total, currency)}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-text-5 [text-wrap:pretty]">
            {hasCost
              ? "Sum of the cost field on this trip's stops. Stops without a cost are not counted."
              : 'No costs yet. Add a cost to any stop and it lands in the matching line.'}
            {budget.unconverted > 0 && (
              <>
                {' '}
                {budget.unconverted} not counted — a currency without a cached
                rate yet, or a stop that no longer exists.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
