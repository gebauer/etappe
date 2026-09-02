import { formatDayDate } from '../lib/format';
import { formatClock, type CascadeResult } from '../lib/cascade';
import type { DaysResponse, StopsResponse, TripsResponse } from '../types/pb';

interface Props {
  trip: TripsResponse;
  days: DaysResponse[];
  stops: StopsResponse[];
  result: CascadeResult | null;
  onSelectDay: (dayId: string) => void;
}

/**
 * The itinerary column in the trip overview (design_handoff (9), WORK 17.6):
 * shown when no day is selected. One numbered row per day carrying its date,
 * starting point, span and stop count — the index into the trip that the
 * map's numbered day pins point at. Clicking a row selects that day and
 * leaves the overview. The single-day affordances (+ Stop, the
 * accommodation warning, start-point continuity) belong to a day and are
 * not shown here.
 */
export function TripOverview({
  trip,
  days,
  stops,
  result,
  onSelectDay,
}: Props) {
  const ordered = [...days].sort((a, b) => a.order_index - b.order_index);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const range =
    first && last
      ? first === last
        ? formatDayDate(trip.start_date, first.order_index)
        : `${formatDayDate(trip.start_date, first.order_index)} – ${formatDayDate(
            trip.start_date,
            last.order_index,
          )}`
      : '';

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1 font-sans text-text">
      <div className="flex-none border-b border-border px-[15px] pb-[11px] pt-[13px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">
          Whole trip
        </div>
        <div className="mt-0.5 font-mono text-[11.5px] text-text-4">
          {ordered.length} {ordered.length === 1 ? 'day' : 'days'}
          {range ? ` · ${range}` : ''}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-[90px] pt-2">
        {ordered.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[oklch(0.32_0.012_250)] px-4 py-8 text-center text-[13px] text-text-4">
            No days yet — add one with the{' '}
            <span className="mx-1 font-mono">+</span> beside the day pills.
          </div>
        ) : (
          ordered.map((d, i) => {
            const dayStops = stops
              .filter((s) => s.day === d.id)
              .sort((a, b) => a.order_index - b.order_index);
            const dayResult = result?.days.find((r) => r.dayId === d.id);
            const rFirst = dayResult?.stops[0];
            const rLast = dayResult?.stops[dayResult.stops.length - 1];
            const span =
              rFirst && rLast
                ? `${formatClock(rFirst.arrival)} – ${formatClock(rLast.departure)}`
                : '';
            return (
              <button
                key={d.id}
                onClick={() => onSelectDay(d.id)}
                className="mb-1 flex w-full items-center gap-[11px] rounded-[10px] border border-transparent px-[11px] py-[9px] text-left hover:border-transparent hover:bg-[oklch(0.23_0.012_250)]"
              >
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-control font-mono text-[12px] text-text-2">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {dayStops[0]?.title ?? (
                      <span className="text-[oklch(0.48_0.01_250)]">
                        no stops yet
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11.5px] text-text-4">
                    {formatDayDate(trip.start_date, d.order_index)}
                    {span ? ` · ${span}` : ''}
                  </span>
                </span>
                <span className="flex-none font-mono text-[11.5px] text-text-4">
                  {dayStops.length} {dayStops.length === 1 ? 'stop' : 'stops'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
