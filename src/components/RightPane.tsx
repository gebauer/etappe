import { formatDayDate } from '../lib/format';
import type { TripsResponse, DaysResponse } from '../types/pb';

interface Props {
  trip: TripsResponse;
  selectedDay: DaysResponse | null;
}

/** Right pane: map on top, inspector below (BUILD §9). The map is built in
 * phase 5 and the block editor in 7.1; for now both are labelled placeholders
 * so the layout is real and the split is visible. */
export function RightPane({ trip, selectedDay }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="grid h-1/2 place-items-center border-b border-slate-200 bg-slate-100 text-xs text-slate-400">
        Map — phase 5
      </div>
      <div className="h-1/2 overflow-y-auto p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Inspector
        </h2>
        {selectedDay ? (
          <div className="mt-2 text-sm text-slate-700">
            <p className="font-medium text-slate-900">
              {selectedDay.title || 'Untitled day'}
            </p>
            <p className="text-slate-500">
              {formatDayDate(trip.start_date, selectedDay.order_index)} ·{' '}
              {selectedDay.kind}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            Select a day or stop to see its details.
          </p>
        )}
      </div>
    </div>
  );
}
