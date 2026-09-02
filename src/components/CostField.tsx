import { useState, type KeyboardEvent } from 'react';
import { CURRENCIES, isCurrencyCode, type CurrencyCode } from '../lib/currency';
import type { CostsResponse } from '../types/pb';

/**
 * What a place costs (WORK 16.7, narrowed 2026-09-02 per WORK 16.10) — on a
 * stop and on a wishlist idea alike, because an admission fee is exactly the
 * thing that decides whether an idea makes the cut.
 *
 * One estimated amount, in whatever currency it was actually paid or quoted
 * in — a fuel receipt in ISK shouldn't need mental math before it goes in.
 * The budget popover converts to the trip's own currency for the total; this
 * field never does its own conversion, it just remembers what was typed.
 *
 * The backend still has room for a label, a category and several rows per
 * stop (kept deliberately — "we can keep multiple cost items in the back if
 * we later decide we want them"); this control only ever reads and writes
 * the first one. Members-only. Never reaches a public share — see
 * `costs.ts`.
 */
export function CostField({
  cost,
  onChange,
}: {
  /** The first cost row for this stop/idea, if any. */
  cost: CostsResponse | undefined;
  /** `null` clears it (deletes the row). */
  onChange: (amount: number | null, currency: CurrencyCode) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(() => String(cost?.amount ?? ''));
  const [currency, setCurrency] = useState<CurrencyCode>(() =>
    isCurrencyCode(cost?.currency) ? cost!.currency : 'EUR',
  );

  function commit() {
    const trimmed = amount.trim();
    if (trimmed === '') {
      onChange(null, currency);
    } else {
      const value = Number(trimmed);
      if (Number.isFinite(value) && value > 0) onChange(value, currency);
    }
    setEditing(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      setAmount(String(cost?.amount ?? ''));
      setEditing(false);
    }
  }

  if (!editing && !cost) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-3 text-[12px] text-text-4 hover:text-text-2"
      >
        + add a price
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[9px] border border-border-strong bg-surface-3 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
        Estimated cost
      </div>
      {editing ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            autoFocus
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
            placeholder="0"
            className="h-[30px] w-24 min-w-0 rounded-[7px] border border-border-strong bg-field px-2 font-mono text-[12.5px] text-text outline-none focus:border-accent"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            onBlur={commit}
            className="h-[30px] flex-none rounded-[7px] border border-border-strong bg-field px-1.5 text-[12.5px] text-text outline-none focus:border-accent"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="mt-1 flex w-full items-center justify-between text-left"
        >
          <span className="font-mono text-[15px] text-text">
            {cost!.amount} {cost!.currency}
          </span>
          <span className="text-[11px] text-text-4 hover:text-text-2">
            edit
          </span>
        </button>
      )}
    </div>
  );
}
