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
        className="mb-2 h-[30px] w-full rounded-lg border border-border-strong bg-field px-2.5 text-[13px] text-text placeholder:text-text-4 focus:border-accent focus:outline-none"
      />
      <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border-strong [&::-webkit-scrollbar-track]:bg-control [&::-webkit-scrollbar]:w-1.5">
        {filtered.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            title={TAXONOMY[k].label}
            // Selected is gold, not accent blue: accent already means
            // "selected on the map", and a kind choice is a different kind
            // of state. Transparent border at rest so the selected cell's
            // 1px border doesn't shift the grid.
            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center ${
              k === value
                ? 'border-[oklch(0.42_0.09_80)] bg-[oklch(0.26_0.045_80)] text-[oklch(0.82_0.13_80)]'
                : 'border-transparent text-text hover:bg-control'
            }`}
          >
            <KindIcon kind={k} />
            <span
              className={`w-full truncate text-[10px] leading-tight ${
                k === value ? '' : 'text-text-3'
              }`}
            >
              {TAXONOMY[k].label}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-6 py-4 text-center text-xs text-text-4">
            No match.
          </p>
        )}
      </div>
    </div>
  );
}
