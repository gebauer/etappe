import { useRef } from 'react';
import { formatDayDate, formatDuration } from '../lib/format';
import { formatClock, type CascadeResult } from '../lib/cascade';
import { daySpanLabel } from '../lib/day-totals';
import { blocksFor, firstPhotoUrl } from '../lib/pb-blocks';
import { costsFor, formatMoney, stopCostBand } from '../lib/costs';
import { swipeStep } from '../lib/stop-step';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import { pb } from '../lib/pb';
import { TripOverview } from './TripOverview';
import type {
  BlocksResponse,
  CostsResponse,
  DaysResponse,
  StopsResponse,
  TripsResponse,
} from '../types/pb';

interface Props {
  trip: TripsResponse;
  day: DaysResponse | null;
  dayIndex: number;
  days: DaysResponse[];
  stops: StopsResponse[];
  blocks: BlocksResponse[];
  costs: CostsResponse[];
  result: CascadeResult | null;
  /** No day selected: the drawer carries the day list instead of a stop. */
  overview?: boolean;
  onSelectDay: (dayId: string) => void;
  /** Handle plus header line only — the map has the rest of the screen. */
  collapsed: boolean;
  onToggle: () => void;
  /** Which stop of the day the card is showing, clamped by the caller. */
  stopIndex: number;
  onStepStop: (direction: -1 | 1) => void;
  onOpenStop: (stop: StopsResponse) => void;
  /** The role banner, when there is one (WORK 22). */
  banner?: string;
}

/**
 * The phone itinerary (design handoff rev 12, "Phone"): a drawer sized by
 * its content, never a pane that splits the screen.
 *
 * The first phone build stacked three surfaces — day dock, day header
 * block, scrolling stop list — and left the map about a third of the
 * screen, which is the wrong third: the map is why someone opens this on a
 * phone. So the rule here is one surface at a time, stepped horizontally.
 * The day's stops are a single card you thumb through rather than a list
 * you scroll, and the drawer collapses to one line the moment a stop is
 * selected, because the detail sheet is then the surface that matters.
 *
 * Desktop keeps `Timeline` — the two are different enough (drag-reorder,
 * leg rows, start/end points, in-place editing) that sharing one component
 * would mean a phone branch around nearly every row.
 */
export function PhoneDayDrawer({
  trip,
  day,
  dayIndex,
  days,
  stops,
  blocks,
  costs,
  result,
  overview = false,
  onSelectDay,
  collapsed,
  onToggle,
  stopIndex,
  onStepStop,
  onOpenStop,
  banner,
}: Props) {
  const swipeX = useRef<number | null>(null);

  const dayStops = day
    ? stops
        .filter((s) => s.day === day.id)
        .sort((a, b) => a.order_index - b.order_index)
    : [];
  const dayResult = day ? result?.days.find((d) => d.dayId === day.id) : null;
  const timingByStop = new Map(
    dayResult?.stops.map((s) => [s.stopId, s]) ?? [],
  );

  const stop = dayStops[stopIndex];
  const timing = stop ? timingByStop.get(stop.id) : undefined;
  const cost = stop ? costsFor(costs, 'stop', stop.id)[0] : undefined;
  const photoUrl = stop
    ? firstPhotoUrl(pb, blocksFor(blocks, 'stop', stop.id))
    : null;
  const kindLabel = stop
    ? stop.routing_kind === 'waypoint'
      ? 'Routing point'
      : (TAXONOMY[stop.kind as Kind]?.label ?? stop.kind)
    : '';
  const band = cost && cost.amount > 0 ? stopCostBand(cost.amount) : null;

  const title = overview ? 'Whole trip' : `Day ${dayIndex + 1}`;
  const meta = overview
    ? `${days.length} ${days.length === 1 ? 'day' : 'days'}`
    : day
      ? [
          formatDayDate(trip.start_date, day.order_index),
          daySpanLabel(dayResult),
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  return (
    <div className="flex flex-col bg-surface-1 font-sans text-text">
      {banner && (
        <div className="flex-none border-b border-border bg-surface-2 px-3 py-2 text-[11.5px] leading-snug text-text-3">
          {banner}
        </div>
      )}

      {/* The whole top of the drawer is the affordance — a grab handle and
          the line under it, not a chevron in a corner. On a phone the
          thumb is nowhere near the corner. */}
      <button
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Show the day's stops" : "Hide the day's stops"}
        className="flex h-[26px] flex-none items-center justify-center"
      >
        <span className="h-1 w-[46px] rounded-sm bg-[oklch(0.44_0.012_250)]" />
      </button>

      <div
        onClick={onToggle}
        className="flex flex-none items-baseline gap-[9px] px-3 pb-[9px]"
      >
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em]">
          {title}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[oklch(0.62_0.01_250)]">
          {meta}
        </span>
        {collapsed && (
          <span className="flex-none font-mono text-[10.5px] uppercase tracking-[0.06em] text-[oklch(0.55_0.01_250)]">
            tap to open
          </span>
        )}
      </div>

      {!collapsed && overview && (
        // Capped rather than free-growing: the day list is a way back into a
        // day, not the view itself, so it must not push the map off screen.
        <div className="max-h-[40vh] min-h-0 overflow-y-auto overflow-x-hidden">
          <TripOverview
            trip={trip}
            days={days}
            stops={stops}
            result={result}
            onSelectDay={onSelectDay}
          />
        </div>
      )}

      {!collapsed && !overview && dayStops.length === 0 && (
        <div className="mx-2.5 mb-3 rounded-[11px] border border-dashed border-[oklch(0.32_0.012_250)] px-3 py-4 text-center text-[12.5px] text-text-4">
          No stops on this day yet.
        </div>
      )}

      {!collapsed && !overview && stop && (
        <div
          onTouchStart={(e) => {
            swipeX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (swipeX.current == null) return;
            const dx = (e.changedTouches[0]?.clientX ?? 0) - swipeX.current;
            swipeX.current = null;
            const dir = swipeStep(dx);
            if (dir) onStepStop(dir);
          }}
          className="flex-none px-2.5 pb-1.5"
        >
          <div className="flex items-center gap-1.5 rounded-xl border border-[oklch(0.29_0.012_250)] bg-surface-4 p-2">
            <button
              onClick={() => onStepStop(-1)}
              aria-label="Previous stop"
              className="h-11 w-[30px] flex-none rounded-lg text-[17px] text-[oklch(0.72_0.01_250)]"
            >
              ‹
            </button>

            <button
              onClick={() => onOpenStop(stop)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              {/* Accent-filled even before the stop is selected: it is the
                  card's own number, and it matches the pin the map is
                  highlighting as you step. */}
              <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-accent font-mono text-xs text-on-accent">
                {stopIndex + 1}
              </span>
              <span className="h-10 w-10 flex-none overflow-hidden rounded-[9px] border border-border-strong bg-control">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {stop.title}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-[oklch(0.63_0.01_250)]">
                  {kindLabel}
                  {timing ? ` · ${formatDuration(timing.dwell)}` : ''}
                  {band && (
                    <span
                      className="text-wishlist"
                      title={formatMoney(cost!.amount, cost!.currency)}
                    >
                      {` · ${band}`}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex-none text-right font-mono text-[12.5px] text-[oklch(0.84_0.008_250)]">
                <span className="block">
                  {timing ? formatClock(timing.arrival) : '—'}
                </span>
                {timing && timing.departure !== timing.arrival && (
                  <span className="block text-[11px] text-[oklch(0.58_0.01_250)]">
                    {formatClock(timing.departure)}
                  </span>
                )}
              </span>
            </button>

            <button
              onClick={() => onStepStop(1)}
              aria-label="Next stop"
              className="h-11 w-[30px] flex-none rounded-lg text-[17px] text-[oklch(0.72_0.01_250)]"
            >
              ›
            </button>
          </div>

          {/* Where you are in the day, at a glance — the list this replaced
              said that by its own length. */}
          <div
            className="flex items-center justify-center gap-[5px] pb-0.5 pt-2"
            aria-label={`Stop ${stopIndex + 1} of ${dayStops.length}`}
          >
            {dayStops.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-sm transition-[width] duration-[160ms] ${
                  i === stopIndex
                    ? 'w-4 bg-accent'
                    : 'w-1.5 bg-[oklch(0.36_0.012_250)]'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
