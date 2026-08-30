import { Fragment } from 'react';
import { formatDayDate } from '../lib/format';
import type { CascadeResult, Warning } from '../lib/cascade';
import type {
  TripsResponse,
  DaysResponse,
  StopsResponse,
  LegsResponse,
} from '../types/pb';
import type { StopPatch, LegPatch } from '../lib/pb-stops';
import { StopRow } from './StopRow';
import { LegRow } from './LegRow';

interface Props {
  trip: TripsResponse;
  days: DaysResponse[];
  stops: StopsResponse[];
  legs: LegsResponse[];
  result: CascadeResult | null;
  onToggleRail: () => void;
  onToggleRight: () => void;
  onAddStop: (dayId: string) => void;
  onDeleteStop: (stopId: string) => void;
  onUpdateStop: (stopId: string, patch: StopPatch) => void;
  onUpdateLeg: (legId: string, patch: LegPatch) => void;
}

export function Timeline({
  trip,
  days,
  stops,
  legs,
  result,
  onToggleRail,
  onToggleRight,
  onAddStop,
  onDeleteStop,
  onUpdateStop,
  onUpdateLeg,
}: Props) {
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

        {days.map((day, dayIndex) => {
          const dayResult = result?.days.find((d) => d.dayId === day.id);
          const timingByStop = new Map(
            dayResult?.stops.map((s) => [s.stopId, s]) ?? [],
          );
          const dayStops = stops
            .filter((s) => s.day === day.id)
            .sort((a, b) => a.order_index - b.order_index);

          const stopWarnings = new Map<string, Warning[]>();
          const dayLevel: Warning[] = [];
          for (const w of result?.warnings ?? []) {
            if (w.dayId !== day.id) continue;
            if (w.stopId) {
              const list = stopWarnings.get(w.stopId) ?? [];
              list.push(w);
              stopWarnings.set(w.stopId, list);
            } else {
              dayLevel.push(w);
            }
          }

          return (
            <section key={day.id}>
              <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 px-4 py-2 backdrop-blur">
                <h2 className="text-sm font-semibold text-slate-900">
                  Day {dayIndex + 1}
                  {day.title ? ` · ${day.title}` : ''}
                </h2>
                <p className="text-xs text-slate-500">
                  {formatDayDate(trip.start_date, day.order_index)} · {day.kind}
                </p>
                {dayLevel.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    {dayLevel.map((w, i) => (
                      <span key={i} className="mr-2">
                        ⚠ {w.code}
                        {w.deficitMin != null ? ` +${w.deficitMin}m` : ''}
                      </span>
                    ))}
                  </p>
                )}
              </header>

              {dayStops.map((stop, i) => {
                const next = dayStops[i + 1];
                const leg = next
                  ? legs.find(
                      (l) => l.from_stop === stop.id && l.to_stop === next.id,
                    )
                  : undefined;
                return (
                  <Fragment key={`${stop.id}:${stop.updated}`}>
                    <StopRow
                      stop={stop}
                      timing={timingByStop.get(stop.id)}
                      warnings={stopWarnings.get(stop.id) ?? []}
                      onUpdate={(patch) => onUpdateStop(stop.id, patch)}
                      onDelete={() => onDeleteStop(stop.id)}
                    />
                    {next && (
                      <LegRow
                        leg={leg}
                        effectiveDuration={
                          dayResult?.legs[i]?.effectiveDuration
                        }
                        onUpdate={(patch) => leg && onUpdateLeg(leg.id, patch)}
                      />
                    )}
                  </Fragment>
                );
              })}

              <div className="px-4 py-2">
                <button
                  onClick={() => onAddStop(day.id)}
                  className="rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700"
                >
                  + Stop
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
