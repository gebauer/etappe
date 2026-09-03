import { Fragment, useEffect, useRef, useState } from 'react';
import { formatDayDate } from '../lib/format';
import { formatClock, type CascadeResult } from '../lib/cascade';
import { warningText } from '../lib/warnings';
import { blocksFor, blockFileUrl } from '../lib/pb-blocks';
import { costsFor } from '../lib/costs';
import { pb } from '../lib/pb';
import type {
  BlocksResponse,
  CostsResponse,
  DaysResponse,
  StopsResponse,
  LegsResponse,
} from '../types/pb';
import type { TripsResponse } from '../types/pb';
import type { LegPatch } from '../lib/pb-stops';
import { StopRow } from './StopRow';
import { LegRow } from './LegRow';
import { TripOverview } from './TripOverview';
import { routeUrl, type LinkOut } from '../lib/geo-links';
import { routingPoint } from '../lib/routing';

interface Props {
  trip: TripsResponse;
  day: DaysResponse | null;
  dayIndex: number;
  /** Every day, ordered — for the trip-overview day list (WORK 17.6). */
  days: DaysResponse[];
  stops: StopsResponse[];
  legs: LegsResponse[];
  blocks: BlocksResponse[];
  costs: CostsResponse[];
  result: CascadeResult | null;
  onAddStop: (dayId: string) => void;
  /** Delete the focused day and its stops (WORK 16.2). Confirmed here. */
  onDeleteDay: (dayId: string) => void;
  onUpdateLeg: (legId: string, patch: LegPatch) => void;
  onRerouteLeg: (legId: string) => void;
  /** Minutes, or 0 to drop the override and go back to the engine. */
  onSetLegDuration: (legId: string, durationMin: number) => void;
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
  /** Phone only (WORK 17.2): folds the column down to its header line so the
   * map takes the freed height. `onToggleCollapse` is undefined on desktop,
   * where the column is always open and the chevron is not rendered. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Trip overview (WORK 17.6): no day selected. The column becomes a day
   * list; clicking a row selects that day. */
  overview?: boolean;
  onSelectDay?: (dayId: string) => void;
  /** Phone only (WORK 10.1): a horizontal swipe on the day header steps
   * to the previous / next day. Undefined on desktop — the day dock is
   * the switcher there. */
  onStepDay?: (direction: -1 | 1) => void;
  /** Which map app the ↗ links open (WORK 19.4). `onLinkOut` fires on every
   * ↗ click — the one-time "you can change this" hint lives in TripEditor.
   * `truncated` says how many stops the app could not take. */
  linkOut?: LinkOut;
  onLinkOut?: (truncated: number) => void;
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
  days,
  stops,
  legs,
  blocks,
  costs,
  result,
  onAddStop,
  onDeleteDay,
  onUpdateLeg,
  onRerouteLeg,
  onSetLegDuration,
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
  collapsed = false,
  onToggleCollapse,
  overview = false,
  onSelectDay,
  onStepDay,
  linkOut = 'google',
  onLinkOut,
}: Props) {
  const swipe = useRef<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Two-click confirm rather than a dialog: deleting a day takes its stops
  // with it, but it is also the kind of thing you undo by adding one back.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollToStopId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-stop="${scrollToStopId}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [scrollToStopId]);

  if (overview && onSelectDay) {
    return (
      <TripOverview
        trip={trip}
        days={days}
        stops={stops}
        result={result}
        onSelectDay={onSelectDay}
      />
    );
  }

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

  // The whole day as one route (WORK 19.4). The start point leads, since
  // that is where the day actually begins; stops with no coordinates yet
  // are skipped rather than sent as 0,0.
  const dayRoute = routeUrl(
    linkOut,
    [startPointStop, ...dayStops]
      .map(routingPoint)
      .filter((p): p is NonNullable<typeof p> => p !== null),
  );

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
      <div
        onTouchStart={
          onStepDay
            ? (e) => (swipe.current = e.touches[0]?.clientX ?? null)
            : undefined
        }
        onTouchEnd={
          onStepDay
            ? (e) => {
                if (swipe.current == null) return;
                const dx = (e.changedTouches[0]?.clientX ?? 0) - swipe.current;
                swipe.current = null;
                if (Math.abs(dx) > 45) onStepDay(dx < 0 ? 1 : -1);
              }
            : undefined
        }
        className="flex flex-none items-baseline justify-between gap-2.5 border-b border-border px-[15px] pb-[11px] pt-[13px]"
      >
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-[-0.01em]">
            Day {dayIndex + 1}
            {day.title ? ` · ${day.title}` : ''}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px] text-text-4">
            {formatDayDate(trip.start_date, day.order_index)} · {day.kind}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          {span && (
            <span className="font-mono text-[11.5px] text-text-4">{span}</span>
          )}
          {dayRoute && (
            <a
              href={dayRoute.url}
              onClick={() => onLinkOut?.(dayRoute.truncated)}
              target="_blank"
              rel="noreferrer"
              title={
                dayRoute.truncated
                  ? `Open the day in your map app — ${dayRoute.truncated} stop(s) will not fit`
                  : 'Open the whole day in your map app'
              }
              className="flex h-[22px] flex-none items-center rounded-[7px] border border-border-strong px-2 text-[11px] text-text-4 hover:text-text-2"
            >
              ↗ Day{dayRoute.truncated ? ' ⚠' : ''}
            </a>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={
                collapsed ? "Show the day's stops" : "Hide the day's stops"
              }
              aria-label={
                collapsed ? "Show the day's stops" : "Hide the day's stops"
              }
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-border-strong bg-control text-[10px] text-text-3 hover:text-text"
            >
              {collapsed ? '▲' : '▼'}
            </button>
          )}
          <button
            onClick={() =>
              confirmingDelete ? onDeleteDay(day.id) : setConfirmingDelete(true)
            }
            onBlur={() => setConfirmingDelete(false)}
            title={
              confirmingDelete
                ? 'Click again to delete this day and its stops'
                : 'Delete this day'
            }
            className={`h-[22px] whitespace-nowrap rounded-[7px] border px-2 text-[11px] ${
              confirmingDelete
                ? 'border-danger-border bg-[oklch(0.30_0.08_25)] text-danger-text'
                : 'border-border-strong text-text-4 hover:text-text-2'
            }`}
          >
            {confirmingDelete ? 'Delete day?' : '✕'}
          </button>
        </div>
      </div>

      {!collapsed && (
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
                from={startPointStop}
                to={dayStops[0]}
                timing={dayResult?.leadingLeg ?? undefined}
                tripBufferPct={trip.car_buffer_pct ?? 0}
                onUpdate={(patch) =>
                  startPointLeg && onUpdateLeg(startPointLeg.id, patch)
                }
                onReroute={() =>
                  startPointLeg && onRerouteLeg(startPointLeg.id)
                }
                onSetDuration={(min) =>
                  startPointLeg && onSetLegDuration(startPointLeg.id, min)
                }
                linkOut={linkOut}
                onLinkOut={() => onLinkOut?.(0)}
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
                      cost={costsFor(costs, 'stop', stop.id)[0] ?? null}
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
                      from={stop}
                      to={next}
                      timing={dayResult?.legs[i]}
                      tripBufferPct={trip.car_buffer_pct ?? 0}
                      onUpdate={(patch) => leg && onUpdateLeg(leg.id, patch)}
                      onReroute={() => leg && onRerouteLeg(leg.id)}
                      onSetDuration={(min) =>
                        leg && onSetLegDuration(leg.id, min)
                      }
                      linkOut={linkOut}
                      onLinkOut={() => onLinkOut?.(0)}
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
      )}
    </div>
  );
}
