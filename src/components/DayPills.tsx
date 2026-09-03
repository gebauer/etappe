import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
  /** Insert a new day *before* the day at this index. The trailing `+`
   * appends; these are the gaps between pills. */
  onInsertDay: (atIndex: number) => void;
  onFitTrip: () => void;
  /** False for a `contributor`/`viewer` (WORK 22): no `+` / insert-day. */
  canAddDay?: boolean;
}

// Tailwind's `/<opacity>` modifier doesn't generate a rule for a custom
// token whose value is a plain oklch() string (verified: only the
// opacity-less `.bg-surface-2` ends up in the compiled CSS, so
// `bg-surface-2/[0.88]` silently rendered fully transparent) — the alpha
// has to be baked into the arbitrary value itself instead.
const GLASS =
  'border border-[oklch(0.30_0.012_250)] bg-[oklch(0.20_0.013_250/0.88)] backdrop-blur-[10px]';

/** Four 5×5 L-corners — the standard "frame the content" glyph, replacing
 * the "Fit trip" text button (handoff revision 7, 2026-09-02): an icon
 * button doesn't grow with its label, so it stays a fixed 38px regardless
 * of how many days the rail has to make room for. */
function CornerBracketsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="oklch(0.84 0.008 250)"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1 5V1h4" />
      <path d="M14 5V1h-4" />
      <path d="M1 10v4h4" />
      <path d="M14 10v4h-4" />
    </svg>
  );
}

/**
 * Day dock over the map (handoff revision 7, "Day dock" — supersedes the
 * plain wrapping pill row from the original handoff). A trip long enough to
 * overflow the row used to wrap it onto a second line, pushing the map down
 * underneath it; this is a single row that never wraps, scrolling instead.
 *
 * `DayRail` itself was retired by WORK 12.6; this remains the only day
 * switcher. Rendered by `MapPane` as an absolute overlay, needing the map's
 * own `records` (day/stop counts) and click-through gaps between pills, the
 * same as the existing Nearby toggle.
 */
export function DayPills({
  days,
  stops,
  activeDayId,
  onSelectDay,
  onHoverDay,
  onAddDay,
  onInsertDay,
  onFitTrip,
  canAddDay = true,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef(new Map<string, HTMLButtonElement>());
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  // Both fades and both chevrons come off the same measurement — recomputed
  // on scroll, on mount (the day count is already known then) and on
  // resize (the map/itinerary split can change the dock's own width).
  function measure() {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  useLayoutEffect(() => {
    measure();
  }, [days.length]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function scrollBy(dx: number) {
    scrollerRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  }

  /** A pill within 92px of either edge scrolls the days beyond it into
   * view — never `scrollIntoView`, which moves the whole app shell, not
   * just this rail. Also what the routine day-select (click, keyboard, or
   * a day activated from elsewhere) uses to keep the active pill on
   * screen. */
  function revealDay(dayId: string) {
    const el = scrollerRef.current;
    const pill = pillRefs.current.get(dayId);
    if (!el || !pill) return;
    const margin = 92;
    const pillLeft = pill.offsetLeft;
    const pillRight = pillLeft + pill.offsetWidth;
    if (pillLeft - margin < el.scrollLeft) {
      el.scrollTo({
        left: Math.max(0, pillLeft - margin),
        behavior: 'smooth',
      });
    } else if (pillRight + margin > el.scrollLeft + el.clientWidth) {
      el.scrollTo({
        left: pillRight + margin - el.clientWidth,
        behavior: 'smooth',
      });
    }
  }

  // Drag-to-scroll: a pointer-drag anywhere on the rail pans it. A plain
  // click still has to work, so a small movement threshold marks the
  // gesture as a drag and suppresses the click underneath — otherwise
  // every pan ends in an accidental day switch.
  //
  // `setPointerCapture` is deliberately deferred to the *move* handler, only
  // once the drag threshold is actually crossed — capturing on pointerdown
  // (the usual pattern) retargets the compatibility click event to the
  // capturing element too, so every plain pill click stopped reaching its
  // button and no day was ever selectable. Caught by an end-to-end replay:
  // clicking any pill, dragged or not, left the active day unchanged.
  const drag = useRef<{
    startX: number;
    startScroll: number;
    dragging: boolean;
  } | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    // Primary button only — a right-click or a two-finger tap must not arm
    // the drag, or its missing pointerup strands `drag.current` (see below).
    if (!el || e.button !== 0) return;
    drag.current = {
      startX: e.clientX,
      startScroll: el.scrollLeft,
      dragging: false,
    };
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    const d = drag.current;
    if (!el || !d) return;
    // The "mouse gets caught" bug: if a pointerup ever lands somewhere this
    // handler can't see (released over the map, or off-window, before the
    // 4px threshold armed pointer capture), `drag.current` stays set with a
    // stale `startX`, and the next hover move reads a large `dx` and starts
    // panning on movement alone. A plain hover carries no buttons — treat
    // that as the lost pointerup and disarm.
    if (e.buttons === 0) {
      drag.current = null;
      return;
    }
    const dx = e.clientX - d.startX;
    if (!d.dragging && Math.abs(dx) > 4) {
      d.dragging = true;
      el.style.scrollBehavior = 'auto';
      el.setPointerCapture(e.pointerId);
    }
    if (d.dragging) el.scrollLeft = d.startScroll - dx;
  }
  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    const wasDragging = drag.current?.dragging ?? false;
    if (el) {
      el.style.scrollBehavior = 'smooth';
      if (el.hasPointerCapture(e.pointerId))
        el.releasePointerCapture(e.pointerId);
    }
    if (!wasDragging) {
      // A plain click: clear now. `selectDay` reads `dragging` as false
      // either way, so there is nothing to keep alive.
      drag.current = null;
      return;
    }
    // A real drag: the compatibility click fires right after this handler on
    // the same target, so keep `dragging` truthy for one tick to suppress
    // the day switch, then clear the whole record.
    setTimeout(() => {
      drag.current = null;
    }, 0);
  }
  function selectDay(dayId: string) {
    if (drag.current?.dragging) return;
    onSelectDay(dayId);
    revealDay(dayId);
  }

  return (
    // right-[54px], not right-3: the pill container is flex-1 and used to
    // stretch under MapLibre's own zoom control (top-right, ~40px footprint)
    // once it had room to grow into — the old auto-width row never reached
    // that far, so this only became visible once the dock could overflow.
    <div className="pointer-events-none absolute left-3 right-[54px] top-3 z-10 flex items-stretch gap-2 font-sans">
      <button
        onClick={onFitTrip}
        title="Fit trip"
        aria-label="Fit trip"
        className={`pointer-events-auto flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] ${GLASS}`}
      >
        <CornerBracketsIcon />
      </button>

      <div
        onMouseLeave={() => onHoverDay?.(null)}
        className={`pointer-events-auto flex min-w-0 flex-1 items-stretch gap-0 rounded-[11px] p-[5px] ${GLASS}`}
      >
        <span
          className="flex-none select-none pr-1.5 text-[9px] uppercase tracking-[0.16em] text-[oklch(0.58_0.01_250)]"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Days
        </span>
        <span className="mr-1.5 w-px flex-none bg-[oklch(0.30_0.012_250)]" />

        {!atStart && (
          <button
            onClick={() => scrollBy(-180)}
            aria-label="Scroll to earlier days"
            className="z-10 flex w-[22px] flex-none items-center justify-center text-[16px] text-[oklch(0.80_0.008_250)]"
          >
            ‹
          </button>
        )}

        <div className="relative min-w-0 flex-1">
          {!atStart && (
            <span className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[26px] bg-gradient-to-r from-[oklch(0.20_0.013_250/0.88)] to-transparent transition-opacity duration-[140ms]" />
          )}
          <div
            ref={scrollerRef}
            onScroll={measure}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="flex min-w-0 items-stretch gap-1.5 overflow-x-auto"
            style={{
              scrollbarWidth: 'none',
              cursor: 'grab',
              touchAction: 'pan-x',
            }}
          >
            {days.map((day, i) => {
              const count = stops.filter((s) => s.day === day.id).length;
              const meta =
                count === 0
                  ? 'empty'
                  : count === 1
                    ? '1 stop'
                    : `${count} stops`;
              const active = day.id === activeDayId;
              return (
                <Fragment key={day.id}>
                  {i > 0 && canAddDay && (
                    <button
                      onClick={() => onInsertDay(i)}
                      aria-label={`Insert a day before Day ${i + 1}`}
                      title={`Insert a day before Day ${i + 1}`}
                      // A hairline that only shows itself on approach: the
                      // gaps between pills are dead space otherwise, and a
                      // day is inserted rarely enough that a permanent
                      // control for every gap would read as clutter.
                      className="group relative -mx-[3px] h-7 w-[11px] flex-none"
                    >
                      <span className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-accent group-focus-visible:bg-accent" />
                      <span className="absolute inset-0 hidden items-center justify-center text-[13px] leading-none text-accent group-hover:flex group-focus-visible:flex">
                        +
                      </span>
                    </button>
                  )}
                  <button
                    ref={(el) => {
                      if (el) pillRefs.current.set(day.id, el);
                      else pillRefs.current.delete(day.id);
                    }}
                    onClick={() => selectDay(day.id)}
                    onMouseEnter={() => onHoverDay?.(day.id)}
                    onFocus={() => onHoverDay?.(day.id)}
                    onBlur={() => onHoverDay?.(null)}
                    className={`flex h-7 flex-none items-center gap-1.5 rounded-lg px-[11px] ${
                      active
                        ? 'bg-accent text-on-accent'
                        : 'text-[oklch(0.78_0.008_250)] hover:bg-white/5'
                    }`}
                  >
                    {/* A leading dot so a bare number still reads as a day
                        token now that the repeated word "Day" has moved to
                        the container label (handoff (9), trip overview). */}
                    <span
                      className={`h-[5px] w-[5px] flex-none rounded-full ${
                        active
                          ? 'bg-[oklch(0.16_0.02_240/0.55)]'
                          : 'bg-[oklch(0.46_0.01_250)]'
                      }`}
                    />
                    <span className="font-mono text-[13px] font-semibold">
                      {i + 1}
                    </span>
                    <span className="font-mono text-[10.5px] opacity-70">
                      {meta}
                    </span>
                  </button>
                </Fragment>
              );
            })}
          </div>
          {!atEnd && (
            <span className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[26px] bg-gradient-to-l from-[oklch(0.20_0.013_250/0.88)] to-transparent transition-opacity duration-[140ms]" />
          )}
        </div>

        {!atEnd && (
          <button
            onClick={() => scrollBy(180)}
            aria-label="Scroll to later days"
            className="z-10 flex w-[22px] flex-none items-center justify-center text-[16px] text-[oklch(0.80_0.008_250)]"
          >
            ›
          </button>
        )}

        {canAddDay && (
          <>
            <span className="mx-1.5 w-px flex-none bg-[oklch(0.30_0.012_250)]" />
            <button
              onClick={onAddDay}
              aria-label="Add day"
              title="Add day"
              className="h-7 w-7 flex-none rounded-lg border border-dashed border-[oklch(0.36_0.012_250)] text-[oklch(0.78_0.008_250)] hover:border-[oklch(0.46_0.012_250)] hover:text-text"
            >
              +
            </button>
          </>
        )}
      </div>
    </div>
  );
}
