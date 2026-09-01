import { useEffect, useMemo, useRef, useState } from 'react';
import { KINDS, TAXONOMY, type Kind } from '../lib/taxonomy';
import { KindIcon } from './KindIcon';

interface Props {
  value: Kind;
  onChange: (kind: Kind) => void;
  onEscape?: () => void;
  autoFocus?: boolean;
}

/** Icon grid with type-to-filter (BUILD §7: "k opens an icon grid, type to
 * filter, enter"). Presentational only — a parent decides how it's shown
 * (the card expands it inline under the Kind field; the uncategorized
 * review list shows it open on every row) and what onChange does (update
 * and collapse, or just update). */
export function KindPicker({ value, onChange, onEscape, autoFocus }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? KINDS.filter((k) => TAXONOMY[k].label.toLowerCase().includes(q))
      : KINDS;
  }, [query]);

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onEscape?.();
        } else if (e.key === 'Enter' && filtered[0]) {
          onChange(filtered[0]);
        }
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type to filter…"
        className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
        {filtered.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            title={TAXONOMY[k].label}
            className={`flex flex-col items-center gap-1 rounded p-1.5 text-center hover:bg-[oklch(0.6_0.01_250/0.18)] ${
              k === value
                ? 'text-wishlist ring-1 ring-[oklch(0.78_0.13_80/0.55)]'
                : ''
            }`}
          >
            <KindIcon kind={k} />
            <span className="w-full truncate text-[9px] leading-tight">
              {TAXONOMY[k].label}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-6 py-4 text-center text-xs text-slate-400">
            No match.
          </p>
        )}
      </div>
    </div>
  );
}
