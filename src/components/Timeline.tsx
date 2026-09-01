import { Fragment, useEffect, useRef, useState } from 'react';
import { formatDayDate } from '../lib/format';
import { formatClock, type CascadeResult } from '../lib/cascade';
import { warningText } from '../lib/warnings';
import { blocksFor, blockFileUrl } from '../lib/pb-blocks';
import { pb } from '../lib/pb';
import type {
  BlocksResponse,
  DaysResponse,
  StopsResponse,
  LegsResponse,
} from '../types/pb';
import type { TripsResponse } from '../types/pb';
import type { LegPatch } from '../lib/pb-stops';
import { StopRow } from './StopRow';
import { LegRow } from './LegRow';

interface Props {
  trip: TripsResponse;
  day: DaysResponse | null;
  dayIndex: number;
  stops: StopsResponse[];
  legs: LegsResponse[];
  blocks: BlocksResponse[];
  result: CascadeResult | null;
  onAddStop: (dayId: string) => void;
  onUpdateLeg: (legId: string, patch: LegPatch) => void;
  onRerouteLeg: (legId: string) => void;
  onSetManualLeg: (legId: string, durationMin: number) => void;
  onMoveStop: (
    stopId: string,
    targetDayId: string,
    targetIndex: number,
  ) => void;
  selectedStopIds: Set<string>;
  onSelectStop: (stopId: string, additive: boolean) => void;
  scrollToStopId: string | null;
  hoveredStopId: string | null;
  onHoverStop: (stopId: string | null) => void;
  /** Day-start continuity (WORK 13.3): the stop this day leaves from
   * (`days.start_stop`, normally the previous day's accommodation) resolved
   * to a record, plus its routed leading leg. Null when the day is an
   * island. `startPointCandidate` is the stop the "+ Start point" button
   * would point at — null on day 1 or when nothing earlier qualifies. */
  startPointStop?: StopsResponse | null;
  startPointLeg?: LegsResponse;
  startPointCandidate?: StopsResponse | null;
  onSetStartPoint?: () => void;
  onClearStartPoint?: () => void;
}

/**
 * The itinerary column (design handoff, "Itinerary column"): the focused
 * day only, matching the day pills that swap it — not every day stacked,
 * the way the old centre-column timeline did.
 *
 * That costs cross-day drag-and-drop (there's no other day on screen to
 * drop onto); the expanded card's "Move to day…" (WORK 12.3) is the
 * replacement, and reordering *within* the day still drags.
 */
export function Timeline({
  trip,
  day,
  dayIndex,
  stops,
  legs,
  blocks,
  result,
  onAddStop,
  onUpdateLeg,
  onRerouteLeg,
  onSetManualLeg,
  onMoveStop,
  selectedStopIds,
  onSelectStop,
  scrollToStopId,
  hoveredStopId,
  onHoverStop,
  startPointStop,
  startPointLeg,
  startPointCandidate,
  onSetStartPoint,
  onClearStartPoint,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollToStopId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-stop="${scrollToStopId}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [scrollToStopId]);

  if (!day) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-1 p-6 text-center text-[13px] text-text-4">
        No days yet — add one with the <span className="mx-1 font-mono">+</span>{' '}
        beside the day pills.
      </div>
    );
  }

  const dayStops = stops
    .filter((s) => s.day === day.id)
    .sort((a, b) => a.order_index - b.order_index);
  const dayResult = result?.days.find((d) => d.dayId === day.id);
  const timingByStop = new Map(
    dayResult?.stops.map((s) => [s.stopId, s]) ?? [],
  );
  const dayWarnings = (result?.warnings ?? []).filter(
    (w) => w.dayId === day.id,
  );

  const first = dayResult?.stops[0];
  const last = dayResult?.stops[dayResult.stops.length - 1];
  const span =
    first && last
      ? `${formatClock(first.arrival)} – ${formatClock(last.departure)}`
      : '';

  // Leading leg (WORK 13.3): the morning drive shown above stop 1. "Leave
  // at" = the first stop's arrival minus the leading leg's effective
  // duration (the cascade already baked that duration in — WORK 13.1).
  const leadMin = dayResult?.leadingLeg?.effectiveDuration ?? 0;
  const departFrom =
    first && dayResult?.leadingLeg ? first.arrival - leadMin : null;
  const startThumb = startPointStop
    ? (() => {
        const p = blocksFor(blocks, 'stop', startPointStop.id).find(
          (b) => b.kind === 'photo',
        );
        return p ? blockFileUrl(pb, p, '80x80') : null;
      })()
    : null;

  function indexInDay(beforeStopId?: string): number {
    const list = dayStops.filter((s) => s.id !== dragId);
    if (!beforeStopId) return list.length;
    const i = list.findIndex((s) => s.id === beforeStopId);
    return i < 0 ? list.length : i;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1 font-sans text-text">
      <div className="flex flex-none items-baseline justify-between gap-2.5 border-b border-border px-[15px] pb-[11px] pt-[13px]">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-[-0.01em]">
            Day {dayIndex + 1}
            {day.title ? ` · ${day.title}` : ''}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px] text-text-4">
            {formatDayDate(trip.start_date, day.order_index)} · {day.kind}
          </div>
        </div>
        {span && (
          <span className="flex-none font-mono text-[11.5px] text-text-4">
            {span}
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-[90px] pt-2"
      >
        {dayWarnings
          .filter((w) => !w.stopId)
          .map((w, i) => (
            <div
              key={`day-${i}`}
              className="mb-2 flex items-center gap-2 rounded-[9px] border border-warn-border bg-warn-bg px-3 py-2 text-[12.5px] text-warn-text"
            >
              <span className="h-[7px] w-[7px] flex-none rounded-full bg-wishlist" />
              {warningText(w)}
            </div>
          ))}

        {/* Day-start continuity (WORK 13.3): a greyed "ghost" row for the
            stop this day leaves from, then its leading leg — or, until one
            is set, a button to point it at the previous accommodation. */}
        {dayStops.length > 0 && startPointStop && (
          <>
            <div className="flex items-center gap-2.5 rounded-[10px] px-[11px] py-2 opacity-70">
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-dashed border-text-5 font-mono text-[11px] text-text-5">
                ↑
              </span>
              <span className="h-[38px] w-[38px] flex-none overflow-hidden rounded-lg border border-border bg-control grayscale">
                {startThumb && (
                  <img
                    src={startThumb}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-text-3">
                  {startPointStop.title}
                </span>
                <span className="block font-mono text-[11.5px] text-text-5">
                  start point
                  {departFrom != null
                    ? ` · leave ${formatClock(departFrom)}`
                    : ''}
                </span>
              </span>
              <button
                onClick={onClearStartPoint}
                title="Clear start point"
                className="flex-none px-1 text-text-5 hover:text-text"
              >
                ✕
              </button>
            </div>
            <LegRow
              leg={startPointLeg}
              effectiveDuration={dayResult?.leadingLeg?.effectiveDuration}
              onUpdate={(patch) =>
                startPointLeg && onUpdateLeg(startPointLeg.id, patch)
              }
              onReroute={() => startPointLeg && onRerouteLeg(startPointLeg.id)}
              onSetManual={(min) =>
                startPointLeg && onSetManualLeg(startPointLeg.id, min)
              }
            />
          </>
        )}
        {dayStops.length > 0 && !startPointStop && startPointCandidate && (
          <button
            onClick={onSetStartPoint}
            className="mb-1 h-8 w-full truncate rounded-lg border border-dashed border-[oklch(0.32_0.012_250)] px-3 text-[12px] text-text-4 hover:border-[oklch(0.46_0.012_250)] hover:text-text"
          >
            ↑ Start from {startPointCandidate.title}
          </button>
        )}

        {dayStops.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[oklch(0.32_0.012_250)] px-4 py-8 text-center text-[13px] text-text-4">
            No stops on this day yet.
            <br />
            Click the map or a wishlist pin to add one.
          </div>
        ) : (
          dayStops.map((stop, i) => {
            const next = dayStops[i + 1];
            const leg = next
              ? legs.find(
                  (l) => l.from_stop === stop.id && l.to_stop === next.id,
                )
              : undefined;
            const cover = blocksFor(blocks, 'stop', stop.id).find(
              (b) => b.kind === 'photo',
            );
            const stopWarnings = dayWarnings.filter(
              (w) => w.stopId === stop.id,
            );
            return (
              <Fragment key={`${stop.id}:${stop.updated}`}>
                <div
                  data-stop={stop.id}
                  draggable
                  onDragStart={() => setDragId(stop.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => dragId && e.preventDefault()}
                  onDrop={() => {
                    if (dragId && dragId !== stop.id) {
                      onMoveStop(dragId, day.id, indexInDay(stop.id));
                    }
                    setDragId(null);
                  }}
                  className={dragId === stop.id ? 'opacity-40' : ''}
                >
                  <StopRow
                    stop={stop}
                    seq={i + 1}
                    timing={timingByStop.get(stop.id)}
                    photoUrl={cover ? blockFileUrl(pb, cover, '80x80') : null}
                    selected={selectedStopIds.has(stop.id)}
                    hovered={hoveredStopId === stop.id}
                    onSelect={(additive) => onSelectStop(stop.id, additive)}
                    onHover={(h) => onHoverStop(h ? stop.id : null)}
                  />
                </div>

                {/* A stop's own warnings stay compact — one banner per stop
                    would drown the column (three stops with no kind yet is
                    three identical banners). The full banner treatment is
                    for day-level warnings, which is what the handoff's
                    example (NO_ACCOMMODATION) actually is. */}
                {stopWarnings.map((w, wi) => (
                  <div
                    key={`w-${wi}`}
                    className="mb-0.5 ml-[44px] flex items-center gap-1.5 px-[11px] text-[11.5px] text-warn-text"
                  >
                    <span className="h-[5px] w-[5px] flex-none rounded-full bg-wishlist" />
                    {warningText(w)}
                  </div>
                ))}

                {next && (
                  <LegRow
                    leg={leg}
                    effectiveDuration={dayResult?.legs[i]?.effectiveDuration}
                    onUpdate={(patch) => leg && onUpdateLeg(leg.id, patch)}
                    onReroute={() => leg && onRerouteLeg(leg.id)}
                    onSetManual={(min) => leg && onSetManualLeg(leg.id, min)}
                  />
                )}
              </Fragment>
            );
          })
        )}

        <button
          onClick={() => onAddStop(day.id)}
          onDragOver={(e) => dragId && e.preventDefault()}
          onDrop={() => {
            if (dragId) onMoveStop(dragId, day.id, indexInDay());
            setDragId(null);
          }}
          className="mt-2 h-9 w-full rounded-lg border border-dashed border-[oklch(0.32_0.012_250)] text-[13px] text-text-4 hover:border-[oklch(0.46_0.012_250)] hover:text-text"
        >
          + Stop
        </button>
      </div>
    </div>
  );
}
