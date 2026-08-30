import { formatDayDate } from '../lib/format';
import type { TripsResponse, DaysResponse } from '../types/pb';

interface Props {
  trip: TripsResponse;
  days: DaysResponse[];
  onToggleRail: () => void;
  onToggleRight: () => void;
}

/** Centre pane: the whole trip scrolls continuously with day headers (not
 * tabs), so day boundaries stay visible and stops can later be dragged across
 * them. Stop and leg rows are added in 4.2. */
export function Timeline({ trip, days, onToggleRail, onToggleRight }: Props) {
  return (
    <div className="flex h-full min-w-0 flex-col bg-slate-50">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <button
          onClick={onToggleRail}
          className="rounded border border-slate-300 px-2 py-1 text-xs min-[900px]:hidden"
        >
          Days
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
          {trip.title}
        </h1>
        <button
          onClick={onToggleRight}
          className="rounded border border-slate-300 px-2 py-1 text-xs min-[1280px]:hidden"
        >
          Map &amp; details
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {days.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No days yet — add one from the rail to start planning.
          </p>
        )}
        {days.map((day, i) => (
          <section key={day.id}>
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 px-4 py-2 backdrop-blur">
              <h2 className="text-sm font-semibold text-slate-900">
                Day {i + 1}
                {day.title ? ` · ${day.title}` : ''}
              </h2>
              <p className="text-xs text-slate-500">
                {formatDayDate(trip.start_date, day.order_index)} · {day.kind}
              </p>
            </header>
            <div className="px-4 py-3 text-sm text-slate-400">
              No stops yet.
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
