import type { KeyboardEvent } from 'react';
import type { TimingCellSpec } from '../lib/timing-cells';
import type { TimingCell } from '../lib/timing-edit';

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
  if (e.key === 'Escape') {
    e.currentTarget.value = e.currentTarget.defaultValue;
    e.currentTarget.blur();
  }
}

/**
 * The ARRIVE / DEPART / DWELL row, editable in place (WORK 16.1).
 *
 * These three used to be a read-out of cascade output, with the actual
 * inputs — anchor time, anchor type, dwell override — repeated as a second
 * set of fields below. Two rows of near-identical numbers, only one of which
 * did anything. Now you type where you read, and the duplicates are gone:
 * `TripEditor` translates a cell edit back into whichever record field
 * produces it (`planTimingEdit`).
 *
 * A pinned cell is marked. Which of the two clocks is pinned is the whole
 * mechanism — the other is derived from it and the dwell — so it has to be
 * visible, not something you infer from a field further down the card.
 */
export function TimingCells({
  cells,
  size = 'card',
  onEdit,
}: {
  cells: TimingCellSpec[];
  size?: 'card' | 'expanded';
  onEdit?: (cell: TimingCell, value: string) => void;
}) {
  const pad = size === 'card' ? 'px-3 py-2.5' : 'px-3.5 py-2.5';
  const type = size === 'card' ? 'text-[17px]' : 'text-[18px]';
  return (
    <div className="flex overflow-hidden rounded-[10px] border border-border-strong">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={`min-w-0 flex-1 ${pad} ${
            i > 0 ? 'border-l border-border-strong' : ''
          } ${cell.pinned ? 'bg-[oklch(0.72_0.13_215/0.09)]' : ''} ${
            cell.changed ? 'bg-[oklch(0.78_0.13_80/0.12)]' : ''
          }`}
        >
          <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
            <span className="truncate">{cell.label}</span>
            {cell.pinned && (
              <span title="Pinned — the other clock follows this one and the dwell">
                📌
              </span>
            )}
          </div>
          {cell.cell && onEdit ? (
            <input
              // Uncontrolled, so the DOM node keeps whatever it was last
              // given: without a key tied to the value, selecting another
              // stop left the previous one's clock sitting in the field (the
              // tree shape is identical, so React reuses the node). Re-keying
              // on the value remounts it whenever the cascade recomputes,
              // and never mid-typing, since editValue only moves on a reload.
              key={`${cell.label}:${cell.editValue ?? ''}`}
              type={cell.cell === 'dwell' ? 'number' : 'time'}
              min={cell.cell === 'dwell' ? 0 : undefined}
              defaultValue={cell.editValue ?? ''}
              placeholder={cell.value ?? '—'}
              aria-label={cell.label}
              onKeyDown={commitOnEnter}
              onBlur={(e) => {
                if (e.target.value === (cell.editValue ?? '')) return;
                onEdit(cell.cell!, e.target.value);
              }}
              className={`mt-0.5 w-full bg-transparent font-mono ${type} text-text outline-none [color-scheme:dark] focus:text-accent`}
            />
          ) : (
            <div
              className={`mt-0.5 font-mono ${type} ${
                cell.accent ? 'text-daylight' : ''
              }`}
            >
              {cell.value ?? '—'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
