import { MapPane } from './MapPane';
import { formatDayDate } from '../lib/format';
import type { TripRecords } from '../lib/pb-trip-doc';
import type { CascadeResult } from '../lib/cascade';
import type { DaysResponse } from '../types/pb';

interface Props {
  records: TripRecords;
  result: CascadeResult | null;
  selectedDay: DaysResponse | null;
  onMapClick?: (lat: number, lon: number) => void;
}

/** Right pane: map on top, inspector below (BUILD §9). The block editor is
 * built in 7.1; for now the inspector shows the selected day's details. */
export function RightPane({ records, result, selectedDay, onMapClick }: Props) {
  const { trip } = records;
  return (
    <div className="flex h-full flex-col">
      <div className="h-1/2 border-b border-slate-200">
        <MapPane records={records} result={result} onMapClick={onMapClick} />
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
