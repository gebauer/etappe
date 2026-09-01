import { useState, type KeyboardEvent } from 'react';
import { sumCosts, formatMoney } from '../lib/costs';
import type { NewCost } from '../lib/pb-costs';
import type { CostsResponse } from '../types/pb';

/**
 * What a place costs (WORK 16.7) — on a stop and on a wishlist idea alike,
 * because an admission fee is exactly the thing that decides whether an idea
 * makes the cut.
 *
 * Deliberately small: a label, an amount, and whether it's a guess. Currency
 * comes from the trip, so there is no picker and no conversion. The category
 * breakdown phase 11.1 wants reads the same rows; this is the entry surface
 * it never had.
 *
 * Members-only. These never reach a public share — see `costs.ts`.
 */
export function CostList({
  costs,
  currency,
  onAdd,
  onDelete,
}: {
  costs: CostsResponse[];
  currency: string;
  onAdd: (cost: NewCost) => void;
  onDelete: (costId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [estimate, setEstimate] = useState(false);
  const total = sumCosts(costs);

  function submit() {
    const value = Number(amount);
    if (!label.trim() || !Number.isFinite(value) || value <= 0) return;
    onAdd({ label: label.trim(), amount: value, is_estimate: estimate });
    setLabel('');
    setAmount('');
    setEstimate(false);
    setAdding(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') setAdding(false);
  }

  return (
    <div className="mt-3 rounded-[9px] border border-border-strong bg-surface-3 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
          Cost
        </span>
        {total.count > 0 && (
          <span className="font-mono text-[13px] text-text">
            {formatMoney(total.total, currency)}
            {total.estimated > 0 && (
              <span
                className="ml-1 text-[11px] text-text-4"
                title={`${formatMoney(total.estimated, currency)} of that is an estimate`}
              >
                ~
              </span>
            )}
          </span>
        )}
      </div>

      {costs.map((cost) => (
        <div
          key={cost.id}
          className="mt-1.5 flex items-baseline gap-2 text-[12.5px]"
        >
          <span className="min-w-0 flex-1 truncate text-text-2">
            {cost.label}
            {cost.is_estimate && (
              <span className="ml-1 text-text-4" title="An estimate">
                ~
              </span>
            )}
          </span>
          <span className="flex-none font-mono text-text-2">
            {formatMoney(cost.amount, currency)}
          </span>
          <button
            onClick={() => onDelete(cost.id)}
            aria-label={`Remove ${cost.label}`}
            className="flex-none text-text-5 hover:text-danger-text"
          >
            ✕
          </button>
        </div>
      ))}

      {adding ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={onKey}
            placeholder="What for"
            className="h-[30px] min-w-0 flex-1 rounded-[7px] border border-border-strong bg-field px-2 text-[12.5px] text-text outline-none focus:border-accent"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onKey}
            placeholder="0"
            className="h-[30px] w-20 rounded-[7px] border border-border-strong bg-field px-2 font-mono text-[12.5px] text-text outline-none focus:border-accent"
          />
          <button
            onClick={() => setEstimate((v) => !v)}
            title="Mark as an estimate"
            aria-pressed={estimate}
            className={`h-[30px] w-8 flex-none rounded-[7px] border text-[13px] ${
              estimate
                ? 'border-wishlist text-wishlist'
                : 'border-border-strong text-text-4 hover:text-text-2'
            }`}
          >
            ~
          </button>
          <button
            onClick={submit}
            className="h-[30px] flex-none rounded-[7px] bg-accent px-2.5 text-[12.5px] text-on-accent"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1.5 text-[12px] text-text-4 hover:text-text-2"
        >
          + add a price
        </button>
      )}
    </div>
  );
}
