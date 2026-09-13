import { formatDayDate } from '../lib/format';
import type { TripsResponse } from '../types/pb';

/**
 * Confirms adding a day (author, 2026-09-10).
 *
 * On a phone the day dock's `+` sits inside a 34px rail that a thumb hits
 * on the way past, and an accidental day is not a harmless one: inserting
 * shifts every later day's derived date, taking the notes pinned to them
 * along. The undo is "find the day you did not mean to add and delete it",
 * which means first noticing it happened.
 *
 * Asks on desktop too, by request: the same click exists there, and one
 * confirmation everywhere beats a rule about which pointer is trusted.
 */
export function AddDayPrompt({
  trip,
  atIndex,
  dayCount,
  onConfirm,
  onDismiss,
}: {
  trip: TripsResponse;
  /** Where the new day lands. `dayCount` means the end of the trip. */
  atIndex: number;
  dayCount: number;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const appending = atIndex >= dayCount;
  const date = formatDayDate(trip.start_date, atIndex);
  // Everything at or after the new day moves one day later.
  const shifted = dayCount - atIndex;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[oklch(0.12_0.015_250/0.6)]"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border-strong bg-surface-2 p-4 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] font-semibold">
          {appending
            ? `Add Day ${atIndex + 1}?`
            : `Insert a day before Day ${atIndex + 1}?`}
        </p>
        <p className="mt-1.5 text-[13px] text-text-3">
          An empty day on <strong className="text-text-2">{date}</strong>.{' '}
          {appending
            ? 'Nothing else moves.'
            : shifted === 1
              ? `Day ${dayCount} moves one day later, and any note pinned to it moves too.`
              : `Days ${atIndex + 1}–${dayCount} each move one day later, and notes pinned to them move too.`}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onConfirm}
            autoFocus
            className="h-[34px] flex-1 rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent"
          >
            {appending ? 'Add day' : 'Insert day'}
          </button>
          <button
            onClick={onDismiss}
            className="h-[34px] flex-1 rounded-lg border border-border-strong px-3 text-[13px] text-text-2 hover:bg-control"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
