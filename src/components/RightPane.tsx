import { MapPane } from './MapPane';
import { StopInspector } from './StopInspector';
import { formatDayDate } from '../lib/format';
import type { TripRecords } from '../lib/pb-trip-doc';
import type { CascadeResult } from '../lib/cascade';
import type { DaysResponse, StopsResponse } from '../types/pb';
import type { StopPatch } from '../lib/pb-stops';
import type { NearbyPoi } from '../lib/overpass';

interface Props {
  records: TripRecords;
  result: CascadeResult | null;
  selectedDay: DaysResponse | null;
  selectedStop: StopsResponse | null;
  onMapClick?: (lat: number, lon: number) => void;
  onSelectStop?: (stopId: string) => void;
  onHoverStop?: (stopId: string | null) => void;
  onUpdateStop: (stopId: string, patch: StopPatch) => void;
  onDeleteStop: (stopId: string) => void;
  onZoomStop: (lat: number, lon: number) => void;
  onPlaceAccessPoint: (stopId: string) => void;
  onClearAccessPoint: (stopId: string) => void;
  onDragStop: (stopId: string, lat: number, lon: number) => void;
  onDragAccessPoint: (stopId: string, lat: number, lon: number) => void;
  onSelectNearby: (poi: NearbyPoi) => void;
  hoveredStopId?: string | null;
  focusDayId?: string | null;
  flyTo?: { lat: number; lon: number; nonce: number } | null;
}

/** Right pane: map on top, inspector below (BUILD §9). The block editor is
 * built in 7.1; for now the inspector shows the selected day's details. */
export function RightPane({
  records,
  result,
  selectedDay,
  selectedStop,
  onMapClick,
  onSelectStop,
  onHoverStop,
  onUpdateStop,
  onDeleteStop,
  onZoomStop,
  onPlaceAccessPoint,
  onClearAccessPoint,
  onDragStop,
  onDragAccessPoint,
  onSelectNearby,
  hoveredStopId,
  focusDayId,
  flyTo,
}: Props) {
  const { trip } = records;
  return (
    <div className="flex h-full flex-col">
      <div className="h-1/2 border-b border-slate-200">
        <MapPane
          records={records}
          result={result}
          onMapClick={onMapClick}
          onSelectStop={onSelectStop}
          onHoverStop={onHoverStop}
          hoveredStopId={hoveredStopId}
          focusDayId={focusDayId}
          flyTo={flyTo}
          selectedStop={selectedStop}
          onDragStop={onDragStop}
          onDragAccessPoint={onDragAccessPoint}
          onSelectNearby={onSelectNearby}
        />
      </div>
      <div className="h-1/2 overflow-y-auto p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {selectedStop ? 'Stop' : 'Inspector'}
        </h2>
        {selectedStop ? (
          <StopInspector
            key={`${selectedStop.id}:${selectedStop.updated}`}
            stop={selectedStop}
            onUpdate={(patch) => onUpdateStop(selectedStop.id, patch)}
            onDelete={() => onDeleteStop(selectedStop.id)}
            onZoom={() =>
              onZoomStop(selectedStop.lat || 0, selectedStop.lon || 0)
            }
            onPlaceAccessPoint={() => onPlaceAccessPoint(selectedStop.id)}
            onClearAccessPoint={() => onClearAccessPoint(selectedStop.id)}
          />
        ) : selectedDay ? (
          <div className="text-sm text-slate-700">
            <p className="font-medium text-slate-900">
              {selectedDay.title || 'Untitled day'}
            </p>
            <p className="text-slate-500">
              {formatDayDate(trip.start_date, selectedDay.order_index)} ·{' '}
              {selectedDay.kind}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Select a stop (in the timeline or on the map) to edit it.
          </p>
        )}
      </div>
    </div>
  );
}
