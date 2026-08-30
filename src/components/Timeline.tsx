import { Fragment, useEffect, useRef, useState } from 'react';
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
  onRerouteLeg: (legId: string) => void;
  onSetManualLeg: (legId: string, durationMin: number) => void;
  onPlaceAccessPoint: (stopId: string) => void;
  onClearAccessPoint: (stopId: string) => void;
  onMoveStop: (
    stopId: string,
    targetDayId: string,
    targetIndex: number,
  ) => void;
  selectedStopIds: Set<string>;
  onSelectStop: (stopId: string, additive: boolean) => void;
  onOpenSearch: () => void;
  scrollToDayId: string | null;
  scrollToStopId: string | null;
  hoveredStopId: string | null;
  onHoverStop: (stopId: string | null) => void;
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
  onRerouteLeg,
  onSetManualLeg,
  onPlaceAccessPoint,
  onClearAccessPoint,
  onMoveStop,
  selectedStopIds,
  onSelectStop,
  onOpenSearch,
  scrollToDayId,
  scrollToStopId,
  hoveredStopId,
  onHoverStop,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollToDayId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-day="${scrollToDayId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollToDayId]);

  useEffect(() => {
    if (!scrollToStopId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-stop="${scrollToStopId}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [scrollToStopId]);

  function indexInDay(dayId: string, beforeStopId?: string): number {
    const list = stops
      .filter((s) => s.day === dayId && s.id !== dragId)
      .sort((a, b) => a.order_index - b.order_index);
    if (!beforeStopId) return list.length; // append
    const i = list.findIndex((s) => s.id === beforeStopId);
    return i < 0 ? list.length : i;
  }

  function dropBefore(targetStopId: string, targetDayId: string) {
    if (dragId && dragId !== targetStopId) {
      onMoveStop(dragId, targetDayId, indexInDay(targetDayId, targetStopId));
    }
    setDragId(null);
  }

  function dropOnDay(dayId: string) {
    if (dragId) onMoveStop(dragId, dayId, indexInDay(dayId));
    setDragId(null);
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-slate-50">
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
          onClick={onOpenSearch}
          className="rounded border border-slate-300 px-2 py-1 text-xs"
          title="Search places (⌘K)"
        >
          🔍 Search
        </button>
        <span
          className="hidden cursor-help text-xs text-slate-400 min-[900px]:inline"
          title={
            'Keyboard:\nn  new stop\nd  new day\n⌥↑ / ⌥↓  move selected stop\nclick / ⌘-click  select / multi-select\nDel  delete selected stop(s)\nShift↑ / Shift↓  shift selected anchors ±5 min\nEsc  clear selection'
          }
        >
          ⌨
        </span>
        <button
          onClick={onToggleRight}
          className="rounded border border-slate-300 px-2 py-1 text-xs min-[1280px]:hidden"
        >
          Map &amp; details
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
            <section key={day.id} data-day={day.id}>
              <header
                onDragOver={(e) => dragId && e.preventDefault()}
                onDrop={() => dropOnDay(day.id)}
                className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 px-4 py-2 backdrop-blur"
              >
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
                    <div
                      data-stop={stop.id}
                      onDragOver={(e) => dragId && e.preventDefault()}
                      onDrop={() => dropBefore(stop.id, day.id)}
                      className={dragId === stop.id ? 'opacity-40' : ''}
                    >
                      <StopRow
                        stop={stop}
                        timing={timingByStop.get(stop.id)}
                        warnings={stopWarnings.get(stop.id) ?? []}
                        selected={selectedStopIds.has(stop.id)}
                        hovered={hoveredStopId === stop.id}
                        onSelect={(additive) => onSelectStop(stop.id, additive)}
                        onHover={(h) => onHoverStop(h ? stop.id : null)}
                        dragHandle={
                          <span
                            draggable
                            onDragStart={() => setDragId(stop.id)}
                            onDragEnd={() => setDragId(null)}
                            className="cursor-grab select-none pt-1 text-slate-300 hover:text-slate-500"
                            title="Drag to reorder"
                          >
                            ⠿
                          </span>
                        }
                        onUpdate={(patch) => onUpdateStop(stop.id, patch)}
                        onDelete={() => onDeleteStop(stop.id)}
                      />
                    </div>
                    {next && (
                      <LegRow
                        leg={leg}
                        effectiveDuration={
                          dayResult?.legs[i]?.effectiveDuration
                        }
                        from={{
                          id: stop.id,
                          title: stop.title,
                          hasAccessPoint: !!(
                            stop.access_lat && stop.access_lon
                          ),
                        }}
                        to={
                          next && {
                            id: next.id,
                            title: next.title,
                            hasAccessPoint: !!(
                              next.access_lat && next.access_lon
                            ),
                          }
                        }
                        onUpdate={(patch) => leg && onUpdateLeg(leg.id, patch)}
                        onReroute={() => leg && onRerouteLeg(leg.id)}
                        onSetManual={(durationMin) =>
                          leg && onSetManualLeg(leg.id, durationMin)
                        }
                        onPlaceAccessPoint={onPlaceAccessPoint}
                        onClearAccessPoint={onClearAccessPoint}
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
