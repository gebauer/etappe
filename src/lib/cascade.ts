/**
 * The cascade engine (BUILD §3). Pure: no imports from React, PocketBase or the
 * network. It takes a normalised trip document and returns, per day, each
 * stop's arrival/departure and each leg's effective duration, plus a flat list
 * of warnings. Editor, share view, PDF and import preview all call this.
 *
 * All clock arithmetic is in integer minutes from local midnight, so two
 * callers cannot drift by a minute on the same input. Daylight is injected (see
 * DaylightProvider) rather than computed here, so tests are deterministic.
 */

// ---------------------------------------------------------------------------
// Input types (normalised; not PocketBase records, so import preview can use it)
// ---------------------------------------------------------------------------

export interface CascadeActivity {
  duration_min: number;
  kind: 'activity' | 'break';
}

export interface CascadeStop {
  id: string;
  kind: string;
  is_accommodation: boolean;
  lat?: number | null;
  lon?: number | null;
  /** "HH:MM" pinning the stop to the clock; empty/absent means unpinned. */
  anchor_time?: string | null;
  anchor_type?: 'arrival' | 'departure' | null;
  /** Minutes; null means "sum of activities, else the taxonomy default". */
  dwell_override?: number | null;
  activities: CascadeActivity[];
  /**
   * `'waypoint'` marks a stop that exists only to steer the route — a
   * mountain pass, a detour, a junction you want the leg to pass through —
   * not a place worth spending time at. Its dwell is always zero, whatever
   * `dwell_override` or its activities say, because a waypoint being there
   * at all is what "force the route through here" means; a delay layered on
   * top would be a second, unrelated feature.
   * `'stop'` (or absent, for every row that predates this) is the ordinary
   * case: a real destination, timed as it always has been.
   */
  routing_kind?: 'stop' | 'waypoint' | null;
}

export interface CascadeLeg {
  id?: string;
  mode: 'car' | 'walk' | 'flight' | 'ferry' | 'bike' | 'other';
  /**
   * Recorded for the F-road season warning and for the planner's own
   * reference. **Not** a multiplier: a routing engine already slows down
   * for gravel, and multiplying its answer again double-counted the same
   * fact (WORK 19.5).
   */
  surface?: 'paved' | 'gravel' | 'froad' | null;
  /** What the routing engine said, before any buffer. */
  duration_min: number;
  /** "This leg takes N minutes, whatever the engine says." Replaces
   * `duration_min` as the base; the geometry and distance stay the
   * engine's, so the route still draws (WORK 19.5). */
  duration_override_min?: number | null;
  /** Per-leg buffer, in percent or in flat minutes — at most one of the
   * two. Both null falls back to the trip's `car_buffer_pct`. */
  buffer_pct?: number | null;
  buffer_min?: number | null;
}

export interface CascadeDay {
  id: string;
  order_index: number;
  kind: 'travel' | 'rest';
  stops: CascadeStop[];
  /** legs[i] connects stops[i] -> stops[i+1]; length is stops.length - 1. */
  legs: CascadeLeg[];
  /** WORK 13.1: the point you leave in the morning — normally the previous
   * day's accommodation, referenced (not copied) via `days.start_stop`.
   * Coordinates feed the leading leg's map line; identity feeds the ghost
   * timeline row. `null`/absent = island day (day 1, or a cleared pointer). */
  startPoint?: { id: string; lat: number | null; lon: number | null } | null;
  /** WORK 13.1: the routed drive from `startPoint` to `stops[0]`. Its
   * effective duration lands before `stops[0].arrival`, so 09:00 (or a
   * back-derived first anchor) is when you *leave the start point*.
   * `null`/absent whenever there's no start point or it isn't routed yet. */
  leadingLeg?: CascadeLeg | null;
}

export interface CascadeTrip {
  /** YYYY-MM-DD; the only absolute date in the system. */
  start_date: string;
  car_buffer_pct: number;
  default_dwell: Record<string, number>;
  days: CascadeDay[];
}

// ---------------------------------------------------------------------------
// Daylight (injected)
// ---------------------------------------------------------------------------

/** Times as minutes from local midnight. */
export interface Daylight {
  sunrise: number;
  sunset: number;
  dusk: number;
}

/** Returns daylight for a date/place, or null when it does not apply (e.g. a
 * polar day with no sunset). Supplied by the app (SunCalc) or a test stub. */
export type DaylightProvider = (
  dateISO: string,
  lat: number,
  lon: number,
) => Daylight | null;

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type WarningCode =
  | 'MISSED_ANCHOR'
  | 'NO_ACCOMMODATION'
  | 'AFTER_DARK'
  | 'LONG_DAY'
  | 'FROAD_SEASON'
  | 'UNCATEGORIZED';

export interface Warning {
  code: WarningCode;
  dayId: string;
  stopId?: string;
  legId?: string;
  /** Minutes by which a bound was missed (MISSED_ANCHOR, AFTER_DARK). */
  deficitMin?: number;
}

export interface StopTiming {
  stopId: string;
  arrival: number;
  departure: number;
  dwell: number;
}

export interface LegTiming {
  legId?: string;
  /** What the itinerary actually spends: `baseDuration + bufferMin`. */
  effectiveDuration: number;
  /** The routed time, or the planner's override when one is set — the
   * number the buffer is added *to*. Surfaced so the row can show the
   * arithmetic instead of one opaque total (WORK 19.5). */
  baseDuration: number;
  bufferMin: number;
  /** True when `baseDuration` is a planner's override, not the engine's. */
  overridden: boolean;
}

export interface DayResult {
  dayId: string;
  date: string;
  stops: StopTiming[];
  legs: LegTiming[];
  /** WORK 13.1: the morning drive from the day's start point to `stops[0]`,
   * or null when the day is an island. Its `effectiveDuration` is already
   * baked into `stops[0].arrival` and `elapsedMin`; it's surfaced separately
   * so the timeline and map can render the leading leg row/line. */
  leadingLeg: LegTiming | null;
  daylight: Daylight | null;
  elapsedMin: number;
}

export interface CascadeResult {
  days: DayResult[];
  warnings: Warning[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_DEFAULT_START = 9 * 60; // 09:00 when a day has no anchor at all
const LONG_DAY_MIN = 12 * 60;
// F-road season: 15 Jun – 10 Sep inclusive (BUILD §3).
const FROAD_START = { month: 6, day: 15 };
const FROAD_END = { month: 9, day: 10 };

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/** Round half up, once. Deterministic across implementations. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/** "HH:MM" -> minutes from midnight, or null if malformed/empty. */
function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Add whole days to a YYYY-MM-DD date in UTC (no timezone drift). */
export function addDays(dateISO: string, days: number): string {
  const base = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function inFroadSeason(dateISO: string): boolean {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const afterStart =
    month > FROAD_START.month ||
    (month === FROAD_START.month && day >= FROAD_START.day);
  const beforeEnd =
    month < FROAD_END.month ||
    (month === FROAD_END.month && day <= FROAD_END.day);
  return afterStart && beforeEnd;
}

/** HH:MM for display (wraps past midnight). Exported for consumers. */
export function formatClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Dwell and leg resolution
// ---------------------------------------------------------------------------

function resolveDwell(stop: CascadeStop, trip: CascadeTrip): number {
  if (stop.routing_kind === 'waypoint') return 0;
  if (stop.dwell_override != null) return stop.dwell_override;
  if (stop.activities.length > 0) {
    return stop.activities.reduce((sum, a) => sum + a.duration_min, 0);
  }
  return trip.default_dwell[stop.kind] ?? 0;
}

/**
 * A leg's time, split into the parts the row shows (WORK 19.5).
 *
 * The buffer is rounded to whole minutes *before* being added, so the
 * arithmetic on screen — `2h19 + 7 = 2h26` — is the arithmetic the cascade
 * did. Rounding the product instead can leave the displayed parts a minute
 * short of the displayed total.
 *
 * Buffer is a car idea: it stands for traffic, fuel stops and photographs,
 * none of which apply to a ferry crossing with a timetable.
 */
function legTiming(
  leg: CascadeLeg,
  trip: CascadeTrip,
): Omit<LegTiming, 'legId'> {
  const override = leg.duration_override_min;
  const overridden = override != null && override > 0;
  const baseDuration = overridden ? override : leg.duration_min;

  if (leg.mode !== 'car') {
    return {
      effectiveDuration: baseDuration,
      baseDuration,
      bufferMin: 0,
      overridden,
    };
  }

  const bufferMin =
    leg.buffer_min != null
      ? roundHalfUp(leg.buffer_min)
      : roundHalfUp(
          (baseDuration * (leg.buffer_pct ?? trip.car_buffer_pct)) / 100,
        );

  return {
    effectiveDuration: baseDuration + bufferMin,
    baseDuration,
    bufferMin,
    overridden,
  };
}

const NO_LEG: Omit<LegTiming, 'legId'> = {
  effectiveDuration: 0,
  baseDuration: 0,
  bufferMin: 0,
  overridden: false,
};

interface Anchor {
  index: number;
  minutes: number;
  type: 'arrival' | 'departure';
}

function firstAnchor(stops: CascadeStop[]): Anchor | null {
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop) continue;
    const minutes = parseClock(stop.anchor_time);
    if (minutes != null) {
      return { index: i, minutes, type: stop.anchor_type ?? 'arrival' };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-day cascade
// ---------------------------------------------------------------------------

function computeDay(
  day: CascadeDay,
  trip: CascadeTrip,
  daylightProvider: DaylightProvider,
): { result: DayResult; warnings: Warning[] } {
  const date = addDays(trip.start_date, day.order_index);
  const stops = day.stops;
  const warnings: Warning[] = [];

  const firstStop = stops[0];
  const daylight =
    firstStop && firstStop.lat != null && firstStop.lon != null
      ? daylightProvider(date, firstStop.lat, firstStop.lon)
      : null;

  if (stops.length === 0) {
    return {
      result: {
        dayId: day.id,
        date,
        stops: [],
        legs: [],
        leadingLeg: null,
        daylight,
        elapsedMin: 0,
      },
      warnings,
    };
  }

  const dwell = stops.map((s) => resolveDwell(s, trip));
  const legEff = stops.map((_, i) =>
    i < stops.length - 1 && day.legs[i]
      ? legTiming(day.legs[i] as CascadeLeg, trip)
      : NO_LEG,
  );

  // The morning drive from the day's start point to stops[0] (WORK 13.1).
  // Zero when the day is an island or the leading leg isn't routed yet.
  const lead = day.leadingLeg ? legTiming(day.leadingLeg, trip) : NO_LEG;
  const leadEff = lead.effectiveDuration;

  // Baseline: the arrival of stop 0. Derive it from the first anchor by walking
  // backwards, so the forward pass reproduces that anchor exactly. With no
  // anchor anywhere, start the day at the default time — which is now the
  // moment you *leave the start point*, so stop 0's arrival is that plus the
  // leading leg. An anchor pins a stop's own clock, so it back-derives the
  // same as before: the leading leg only shifts the (untimed) departure from
  // the start point, not any stop.
  const anchor = firstAnchor(stops);
  let arrival0 = DAY_DEFAULT_START + leadEff;
  if (anchor) {
    const targetAtAnchor =
      anchor.type === 'arrival'
        ? anchor.minutes
        : anchor.minutes - dwell[anchor.index]!;
    let prefix = 0;
    for (let i = 0; i < anchor.index; i++)
      prefix += dwell[i]! + legEff[i]!.effectiveDuration;
    arrival0 = targetAtAnchor - prefix;
  }

  const timings: StopTiming[] = [];
  let prevDeparture = 0;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]!;
    let arrival =
      i === 0 ? arrival0 : prevDeparture + legEff[i - 1]!.effectiveDuration;
    let departure = arrival + dwell[i]!;

    const pinned = parseClock(stop.anchor_time);
    if (pinned != null) {
      const type = stop.anchor_type ?? 'arrival';
      if (type === 'arrival') {
        if (arrival > pinned) {
          warnings.push(anchorMiss(day.id, stop.id, arrival - pinned));
        }
        arrival = pinned; // anchor wins for everything below it
        departure = arrival + dwell[i]!;
      } else {
        const naturalDeparture = arrival + dwell[i]!;
        if (naturalDeparture > pinned) {
          warnings.push(anchorMiss(day.id, stop.id, naturalDeparture - pinned));
        }
        departure = pinned;
      }
    }

    timings.push({ stopId: stop.id, arrival, departure, dwell: dwell[i]! });
    prevDeparture = departure;
  }

  const legs: LegTiming[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    legs.push({ legId: day.legs[i]?.id, ...legEff[i]! });
  }
  const leadingLeg: LegTiming | null = day.leadingLeg
    ? { legId: day.leadingLeg.id, ...lead }
    : null;

  const first = timings[0]!;
  const last = timings[timings.length - 1]!;
  // Elapsed counts the morning drive: a short day of stops after a long
  // transfer is still a long day (WORK 13.1).
  const elapsedMin = last.arrival - first.arrival + leadEff;

  collectDayWarnings(day, timings, date, daylight, elapsedMin, warnings);

  return {
    result: {
      dayId: day.id,
      date,
      stops: timings,
      legs,
      leadingLeg,
      daylight,
      elapsedMin,
    },
    warnings,
  };
}

function anchorMiss(
  dayId: string,
  stopId: string,
  deficitMin: number,
): Warning {
  return { code: 'MISSED_ANCHOR', dayId, stopId, deficitMin };
}

function collectDayWarnings(
  day: CascadeDay,
  timings: StopTiming[],
  date: string,
  daylight: Daylight | null,
  elapsedMin: number,
  warnings: Warning[],
): void {
  for (const stop of day.stops) {
    if (stop.kind === 'uncategorized') {
      warnings.push({ code: 'UNCATEGORIZED', dayId: day.id, stopId: stop.id });
    }
  }

  if (!inFroadSeason(date)) {
    for (const leg of day.legs) {
      if (leg.surface === 'froad') {
        warnings.push({ code: 'FROAD_SEASON', dayId: day.id, legId: leg.id });
      }
    }
  }

  const lastStop = day.stops[day.stops.length - 1];
  if (lastStop && !lastStop.is_accommodation) {
    warnings.push({
      code: 'NO_ACCOMMODATION',
      dayId: day.id,
      stopId: lastStop.id,
    });
  }

  if (elapsedMin > LONG_DAY_MIN) {
    warnings.push({ code: 'LONG_DAY', dayId: day.id });
  }

  const last = timings[timings.length - 1]!;
  if (daylight && last.arrival > daylight.sunset) {
    warnings.push({
      code: 'AFTER_DARK',
      dayId: day.id,
      stopId: last.stopId,
      deficitMin: last.arrival - daylight.sunset,
    });
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function cascade(
  trip: CascadeTrip,
  daylightProvider: DaylightProvider,
): CascadeResult {
  const days: DayResult[] = [];
  const warnings: Warning[] = [];
  for (const day of trip.days) {
    const { result, warnings: dayWarnings } = computeDay(
      day,
      trip,
      daylightProvider,
    );
    days.push(result);
    warnings.push(...dayWarnings);
  }
  return { days, warnings };
}
