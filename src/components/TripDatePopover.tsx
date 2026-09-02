import { useEffect, useRef, useState } from 'react';
import { addDays } from '../lib/cascade';
import { formatDayDate } from '../lib/format';

/**
 * Move the whole trip to different dates (WORK 18.4) — a header control
 * showing the trip's span, opening a date picker for its first day.
 *
 * Cheap precisely because dates are derived (CLAUDE.md rule 2): the trip
 * carries one `start_date` and every day's date falls out of it plus
 * `order_index`, so shifting a trip is a single field write with nothing
 * to keep in sync. Anchors are a time-of-day plus a day reference, so an
 * 08:00 ferry stays an 08:00 ferry on whatever date its day lands on.
 */
export function TripDatePopover({
  startDate,
  dayCount,
  onChange,
}: {
  /** The trip's stored start date, in whatever shape PocketBase returns. */
  startDate: string;
  dayCount: number;
  onChange: (isoDate: string) => void;
}) {
  const current = startDate.slice(0, 10);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const ref = useRef<HTMLDivElement>(null);

  // Re-sync when the trip reloads with a new date, so reopening the
  // popover after a shift shows what was actually saved.
  useEffect(() => setValue(current), [current]);

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

  const lastIndex = Math.max(0, dayCount - 1);
  const span =
    dayCount > 1
      ? `${formatDayDate(current, 0)} – ${formatDayDate(current, lastIndex)}`
      : formatDayDate(current, 0);
  const shiftBy =
    value && value !== current
      ? Math.round(
          (Date.parse(`${value}T00:00:00Z`) -
            Date.parse(`${current}T00:00:00Z`)) /
            86_400_000,
        )
      : 0;

  function commit() {
    if (value && value !== current) onChange(value);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Move the trip to different dates"
        className="h-[30px] whitespace-nowrap rounded-lg px-2 font-mono text-[11px] text-text-4 hover:bg-control hover:text-text-2"
      >
        {span}
      </button>
      {open && (
        <div className="absolute left-0 top-[34px] z-40 w-[268px] rounded-[11px] border border-border-strong bg-surface-2 p-3 text-text shadow-card">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
            Move the trip
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-text-3">
            Every day&rsquo;s date is derived from the first one, so this shifts
            the whole itinerary. Times of day stay as they are.
          </p>
          <label className="mt-2.5 block">
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
              Day 1
            </span>
            <input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
              }}
              className="mt-1 h-[34px] w-full rounded-lg border border-border-strong bg-field px-2.5 font-mono text-[13px] text-text outline-none [color-scheme:dark] focus:border-accent"
            />
          </label>
          <div className="mt-2 font-mono text-[11px] text-text-4">
            {shiftBy === 0
              ? 'No change'
              : `${shiftBy > 0 ? '+' : ''}${shiftBy} day${
                  Math.abs(shiftBy) === 1 ? '' : 's'
                } · ends ${formatDayDate(addDays(current, shiftBy), lastIndex)}`}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setValue(current);
                setOpen(false);
              }}
              className="h-[30px] rounded-lg px-3 text-[12.5px] text-text-3 hover:text-text"
            >
              Cancel
            </button>
            <button
              onClick={commit}
              disabled={shiftBy === 0}
              className="h-[30px] rounded-lg bg-accent px-3 text-[12.5px] font-medium text-on-accent disabled:opacity-40"
            >
              Move trip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
