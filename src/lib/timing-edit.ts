/**
 * Turns an edit of a stop's ARRIVE / DEPART / DWELL cell into the record
 * changes that produce it (WORK 16.1).
 *
 * The three cells a planner reads are cascade *output*: arrival and departure
 * are derived from an anchor, a dwell and the routed legs above them. Only
 * two things are stored — `anchor_time`/`anchor_type` and `dwell_override` —
 * so typing into a computed cell has to be translated back into one of them.
 *
 * The settled rule (WORK 16.1, author 2026-09-01): **dwell is held, the other
 * clock moves.** Editing either clock anchors that side and lets the cascade
 * recompute the other from the dwell. Arrive 09:00 with a 1 h dwell, type
 * 11:00 into Depart, and the stop is departure-anchored at 11:00 with arrival
 * recomputed to 10:00. Dwell only ever changes when you type into Dwell.
 * (Pinning *both* clocks and deriving dwell from the span needs a second
 * anchor per stop, which the schema doesn't have — GitHub issue #1.)
 *
 * The interesting case is anchoring a stop that something upstream already
 * governs. The cascade lets the later anchor win and files an `anchorMiss`
 * warning for the gap, which is silent and throws away the fact that the gap
 * is *slack you could spend*. So this returns a conflict for the caller to
 * put to the user, with the two things they might actually mean: move the
 * whole chain, or spend the slack as dwell on the stop before.
 *
 * Pure — no React, no PocketBase. The caller owns the prompt and the writes.
 */

export type TimingCell = 'arrival' | 'departure' | 'dwell';

/** One stop of a day, as stored plus as computed. */
export interface TimingStop {
  id: string;
  title: string;
  anchorTime: string | null;
  /** Effective dwell in minutes (the override, or the taxonomy default). */
  dwell: number;
  /** Computed clock, minutes from midnight. */
  arrival: number;
  departure: number;
}

/** The subset of a stop patch this module ever produces. */
export interface TimingPatch {
  anchor_time?: string;
  anchor_type?: 'arrival' | 'departure';
  dwell_override?: number;
}

export interface TimingEditInput {
  /** The day's stops in itinerary order. */
  stops: TimingStop[];
  /** Index into `stops` of the one being edited. */
  index: number;
  cell: TimingCell;
  /** `HH:MM` for a clock cell, minutes for dwell. Empty clears. */
  value: string;
}

/** A write the caller should make, described well enough to name in a prompt. */
export interface TimingChange {
  stopId: string;
  title: string;
  patch: TimingPatch;
  /** Human-readable before → after, for the confirmation text. */
  from: string;
  to: string;
}

export type TimingEditPlan =
  | { kind: 'noop' }
  | { kind: 'apply'; changes: TimingChange[] }
  | {
      kind: 'conflict';
      /** Anchoring the edited stop — part of whichever branch is chosen. */
      anchor: TimingChange;
      /** How much later (+) or earlier (−) than the computed time. */
      deltaMin: number;
      /** The anchor already governing this stop from above. */
      upstreamTitle: string;
      /** Shift the whole chain: move that upstream anchor by the delta. */
      shift: TimingChange;
      /** Spend the slack on the preceding stop's dwell. Null when there is
       * no slack to spend (the new time is earlier) or nothing above to
       * spend it on. */
      absorb: TimingChange | null;
    };

const DAY = 24 * 60;

/** `HH:MM` to minutes from midnight, or null if it isn't one. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes from midnight to `HH:MM`, wrapping past midnight. */
export function formatClock(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function formatDwell(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The nearest anchored stop above `index`, or null. */
function upstreamAnchorIndex(
  stops: TimingStop[],
  index: number,
): number | null {
  for (let i = index - 1; i >= 0; i--) {
    if (parseClock(stops[i]?.anchorTime) !== null) return i;
  }
  return null;
}

export function planTimingEdit(input: TimingEditInput): TimingEditPlan {
  const { stops, index, cell, value } = input;
  const stop = stops[index];
  if (!stop) return { kind: 'noop' };

  if (cell === 'dwell') {
    const trimmed = value.trim();
    // Blank means "no override" — the taxonomy default takes back over. The
    // stored 0 is what the rest of the app already reads as unset.
    const minutes = trimmed === '' ? 0 : Number(trimmed);
    if (!Number.isFinite(minutes) || minutes < 0) return { kind: 'noop' };
    if (minutes === stop.dwell) return { kind: 'noop' };
    return {
      kind: 'apply',
      changes: [
        {
          stopId: stop.id,
          title: stop.title,
          patch: { dwell_override: minutes },
          from: formatDwell(stop.dwell),
          to: minutes === 0 ? 'the default' : formatDwell(minutes),
        },
      ],
    };
  }

  const anchorType = cell;
  const current = cell === 'arrival' ? stop.arrival : stop.departure;

  // Clearing a clock cell releases the anchor; the stop floats again.
  if (value.trim() === '') {
    if (parseClock(stop.anchorTime) === null) return { kind: 'noop' };
    return {
      kind: 'apply',
      changes: [
        {
          stopId: stop.id,
          title: stop.title,
          patch: { anchor_time: '' },
          from: stop.anchorTime ?? '',
          to: 'not pinned',
        },
      ],
    };
  }

  const target = parseClock(value);
  if (target === null) return { kind: 'noop' };

  const anchor: TimingChange = {
    stopId: stop.id,
    title: stop.title,
    patch: { anchor_time: formatClock(target), anchor_type: anchorType },
    from: formatClock(current),
    to: formatClock(target),
  };

  // Shortest signed distance, so 23:50 → 00:10 reads as +20 rather than
  // -1420. A day plan never legitimately moves by more than half a day.
  let deltaMin = target - current;
  if (deltaMin > DAY / 2) deltaMin -= DAY;
  if (deltaMin < -DAY / 2) deltaMin += DAY;

  const upstream = deltaMin === 0 ? null : upstreamAnchorIndex(stops, index);
  if (upstream === null) return { kind: 'apply', changes: [anchor] };

  const up = stops[upstream]!;
  const upMinutes = parseClock(up.anchorTime)!;
  const shift: TimingChange = {
    stopId: up.id,
    title: up.title,
    patch: { anchor_time: formatClock(upMinutes + deltaMin) },
    from: formatClock(upMinutes),
    to: formatClock(upMinutes + deltaMin),
  };

  // Slack can only be absorbed *above* the edited stop: its own dwell runs
  // after it arrives, so growing that would not move its arrival at all.
  // Author's call (WORK 16.1): all of it onto the stop immediately before,
  // not spread across the run — one number changes, which is the version a
  // traveller can undo.
  const prev = index > 0 ? stops[index - 1] : undefined;
  const absorb: TimingChange | null =
    deltaMin > 0 && prev
      ? {
          stopId: prev.id,
          title: prev.title,
          patch: { dwell_override: prev.dwell + deltaMin },
          from: formatDwell(prev.dwell),
          to: formatDwell(prev.dwell + deltaMin),
        }
      : null;

  return {
    kind: 'conflict',
    anchor,
    deltaMin,
    upstreamTitle: up.title,
    shift,
    absorb,
  };
}
