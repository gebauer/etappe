import { useState, type KeyboardEvent } from 'react';
import { CURRENCIES, isCurrencyCode, type CurrencyCode } from '../lib/currency';
import { formatMoney } from '../lib/costs';
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
 * Once a price is set, the field also tracks how much of it is already handed
 * over (phase 27): "Fully paid" writes the whole amount, "Partial" opens a
 * box for a deposit. There is no stored "paid" flag — `paid === amount` *is*
 * fully paid — and no currency picker for it: a payment is in the same
 * currency as the price.
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
  /** `null` amount clears it (deletes the row). `paid` is how much of the
   * amount is already settled; it is clamped into `[0, amount]` on write. */
  onChange: (
    amount: number | null,
    currency: CurrencyCode,
    paid: number,
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(() => String(cost?.amount ?? ''));
  const [currency, setCurrency] = useState<CurrencyCode>(() =>
    isCurrencyCode(cost?.currency) ? cost!.currency : 'EUR',
  );
  const [paidEditing, setPaidEditing] = useState(false);
  const [paidInput, setPaidInput] = useState('');

  const paid = Math.min(Math.max(cost?.paid ?? 0, 0), cost?.amount ?? 0);

  function commit() {
    const trimmed = amount.trim();
    if (trimmed === '') {
      onChange(null, currency, 0);
    } else {
      const value = Number(trimmed);
      if (Number.isFinite(value) && value > 0) {
        onChange(value, currency, cost?.paid ?? 0);
      }
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

  function setPaid(value: number) {
    if (!cost) return;
    onChange(cost.amount, currency, value);
    setPaidEditing(false);
  }

  function commitPaid() {
    const trimmed = paidInput.trim();
    const value = trimmed === '' ? 0 : Number(trimmed);
    if (Number.isFinite(value) && value >= 0) setPaid(value);
    else setPaidEditing(false);
  }

  function onPaidKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitPaid();
    if (e.key === 'Escape') setPaidEditing(false);
  }

  function openPartial() {
    setPaidInput(paid > 0 ? String(paid) : '');
    setPaidEditing(true);
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

      {cost && !editing && (
        <div className="mt-2 border-t border-border-strong pt-2">
          {paidEditing ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-4">Paid</span>
              <input
                autoFocus
                type="number"
                min={0}
                step="0.01"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                onKeyDown={onPaidKey}
                onBlur={commitPaid}
                placeholder="0"
                className="h-[26px] w-20 min-w-0 rounded-[7px] border border-border-strong bg-field px-2 font-mono text-[12px] text-text outline-none focus:border-accent"
              />
              <span className="font-mono text-[11px] text-text-4">
                {cost.currency}
              </span>
            </div>
          ) : paid <= 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPaid(cost.amount)}
                className="rounded-[6px] border border-border-strong px-2 py-[3px] text-[11px] text-text-2 hover:border-text-5 hover:text-text"
              >
                Fully paid
              </button>
              <button
                onClick={openPartial}
                className="rounded-[6px] border border-border-strong px-2 py-[3px] text-[11px] text-text-2 hover:border-text-5 hover:text-text"
              >
                Partial
              </button>
            </div>
          ) : paid >= cost.amount ? (
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-2">✓ Paid in full</span>
              <button
                onClick={() => setPaid(0)}
                className="text-[11px] text-text-4 hover:text-text-2"
              >
                undo
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-2">
                Paid {formatMoney(paid, cost.currency)} ·{' '}
                <span className="text-text-4">
                  {formatMoney(cost.amount - paid, cost.currency)} open
                </span>
              </span>
              <button
                onClick={openPartial}
                className="text-[11px] text-text-4 hover:text-text-2"
              >
                edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
