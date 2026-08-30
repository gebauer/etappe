import { formatDayDate } from '../lib/format';
import type { TripsResponse, DaysResponse } from '../types/pb';

interface Props {
  trip: TripsResponse;
  days: DaysResponse[];
  selectedDayId: string | null;
  onSelectDay: (id: string) => void;
  onAddDay: () => void;
  onDeleteDay: (id: string) => void;
}

/** Left rail: the trip's days with their derived dates, plus an add affordance.
 * Drag-to-reorder and the wishlist arrive in later tasks (4.3 / 6.4). */
export function DayRail({
  trip,
  days,
  selectedDayId,
  onSelectDay,
  onAddDay,
  onDeleteDay,
}: Props) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Days
        </span>
        <button
          onClick={onAddDay}
          className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white"
        >
          + Day
        </button>
      </div>
      <ol className="flex-1 overflow-y-auto">
        {days.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-400">
            No days yet.
          </li>
        )}
        {days.map((day, i) => (
          <li key={day.id}>
            <button
              onClick={() => onSelectDay(day.id)}
              className={`group flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left ${
                selectedDayId === day.id ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900">
                  Day {i + 1}
                  {day.title ? ` · ${day.title}` : ''}
                </span>
                <span className="block text-xs text-slate-500">
                  {formatDayDate(trip.start_date, day.order_index)} · {day.kind}
                </span>
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDay(day.id);
                }}
                className="shrink-0 rounded px-1 text-xs text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                aria-label={`Delete day ${i + 1}`}
              >
                ✕
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
