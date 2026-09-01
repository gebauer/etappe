import type { DaysResponse, StopsResponse } from '../types/pb';

interface Props {
  days: DaysResponse[];
  stops: StopsResponse[];
  activeDayId: string | null;
  onSelectDay: (dayId: string) => void;
  /** Pointing at a day highlights its route on the map — see MapPane's
   * `legs-hover-halo`. Fires with null when the pointer leaves. */
  onHoverDay?: (dayId: string | null) => void;
  onAddDay: () => void;
  onFitTrip: () => void;
}

// Tailwind's `/<opacity>` modifier doesn't generate a rule for a custom
// token whose value is a plain oklch() string (verified: only the
// opacity-less `.bg-surface-2` ends up in the compiled CSS, so
// `bg-surface-2/[0.88]` silently rendered fully transparent) — the alpha
// has to be baked into the arbitrary value itself instead.
const GLASS =
  'border border-[oklch(0.30_0.012_250)] bg-[oklch(0.20_0.013_250/0.88)] backdrop-blur-[10px]';

/**
 * Day pills docked over the map (design handoff, "Day pills") — takes over
 * the day rail's role for the map-dominant shell — `DayRail` itself was
 * retired by WORK 12.6, this is the only day switcher now.
 * Rendered by `MapPane` as an absolute overlay, not a standalone panel — it
 * needs the map's own `records` (day/stop counts) and click-through gaps
 * between pills, the same as the existing Nearby toggle.
 *
 * The "whole trip" pill floated for this row (show every day at once,
 * design TBD — see WORK.md "Noticed") isn't built here.
 */
export function DayPills({
  days,
  stops,
  activeDayId,
  onSelectDay,
  onHoverDay,
  onAddDay,
  onFitTrip,
}: Props) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 font-sans">
      <div
        onMouseLeave={() => onHoverDay?.(null)}
        className={`pointer-events-auto flex items-center gap-1.5 rounded-[11px] p-[5px] ${GLASS}`}
      >
        {days.map((day, i) => {
          const count = stops.filter((s) => s.day === day.id).length;
          const meta =
            count === 0 ? 'empty' : count === 1 ? '1 stop' : `${count} stops`;
          const active = day.id === activeDayId;
          return (
            <button
              key={day.id}
              onClick={() => onSelectDay(day.id)}
              onMouseEnter={() => onHoverDay?.(day.id)}
              onFocus={() => onHoverDay?.(day.id)}
              onBlur={() => onHoverDay?.(null)}
              className={`flex h-7 flex-col items-start justify-center rounded-lg px-3 leading-[13px] ${
                active
                  ? 'bg-accent text-on-accent'
                  : 'text-[oklch(0.78_0.008_250)] hover:bg-white/5'
              }`}
            >
              <span className="text-[12.5px] font-semibold">Day {i + 1}</span>
              <span className="font-mono text-[10.5px] leading-[11px] opacity-70">
                {meta}
              </span>
            </button>
          );
        })}
        <button
          onClick={onAddDay}
          aria-label="Add day"
          title="Add day"
          className="h-7 w-7 rounded-lg border border-dashed border-[oklch(0.36_0.012_250)] text-[oklch(0.78_0.008_250)] hover:border-[oklch(0.46_0.012_250)] hover:text-text"
        >
          +
        </button>
      </div>
      <button
        onClick={onFitTrip}
        className={`pointer-events-auto h-[38px] whitespace-nowrap rounded-[11px] px-3.5 text-[12.5px] text-text-2 hover:bg-[oklch(0.25_0.014_250/0.94)] ${GLASS}`}
      >
        Fit trip
      </button>
    </div>
  );
}
