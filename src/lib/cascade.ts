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
}

export interface CascadeLeg {
  id?: string;
  mode: 'car' | 'walk' | 'flight' | 'ferry' | 'bike' | 'other';
  surface?: 'paved' | 'gravel' | 'froad' | null;
  /** Raw duration before buffer/surface multipliers. */
  duration_min: number;
  /** null falls back to the trip's car_buffer_pct. */
  buffer_override_pct?: number | null;
}

export interface CascadeDay {
  id: string;
  order_index: number;
  kind: 'travel' | 'rest';
  stops: CascadeStop[];
  /** legs[i] connects stops[i] -> stops[i+1]; length is stops.length - 1. */
  legs: CascadeLeg[];
}

export interface CascadeTrip {
  /** YYYY-MM-DD; the only absolute date in the system. */
  start_date: string;
  car_buffer_pct: number;
  surface_multipliers: Record<string, number>;
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
  effectiveDuration: number;
}

export interface DayResult {
  dayId: string;
  date: string;
  stops: StopTiming[];
  legs: LegTiming[];
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
  if (stop.dwell_override != null) return stop.dwell_override;
  if (stop.activities.length > 0) {
    return stop.activities.reduce((sum, a) => sum + a.duration_min, 0);
  }
  return trip.default_dwell[stop.kind] ?? 0;
}

function effectiveDuration(leg: CascadeLeg, trip: CascadeTrip): number {
  if (leg.mode !== 'car') return leg.duration_min;
  const surface = leg.surface
    ? (trip.surface_multipliers[leg.surface] ?? 1)
    : 1;
  const bufferPct = leg.buffer_override_pct ?? trip.car_buffer_pct;
  // Round once, after both multipliers — never the intermediate (BUILD §3.4).
  return roundHalfUp(leg.duration_min * surface * (1 + bufferPct / 100));
}

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
        daylight,
        elapsedMin: 0,
      },
      warnings,
    };
  }

  const dwell = stops.map((s) => resolveDwell(s, trip));
  const legEff = stops.map((_, i) =>
    i < stops.length - 1 && day.legs[i]
      ? effectiveDuration(day.legs[i] as CascadeLeg, trip)
      : 0,
  );

  // Baseline: the arrival of stop 0. Derive it from the first anchor by walking
  // backwards, so the forward pass reproduces that anchor exactly. With no
  // anchor anywhere, start the day at the default time.
  const anchor = firstAnchor(stops);
  let arrival0 = DAY_DEFAULT_START;
  if (anchor) {
    const targetAtAnchor =
      anchor.type === 'arrival'
        ? anchor.minutes
        : anchor.minutes - dwell[anchor.index]!;
    let prefix = 0;
    for (let i = 0; i < anchor.index; i++) prefix += dwell[i]! + legEff[i]!;
    arrival0 = targetAtAnchor - prefix;
  }

  const timings: StopTiming[] = [];
  let prevDeparture = 0;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]!;
    let arrival = i === 0 ? arrival0 : prevDeparture + legEff[i - 1]!;
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
    legs.push({ legId: day.legs[i]?.id, effectiveDuration: legEff[i]! });
  }

  collectDayWarnings(day, timings, date, daylight, warnings);

  const first = timings[0]!;
  const last = timings[timings.length - 1]!;
  const elapsedMin = last.arrival - first.arrival;

  return {
    result: { dayId: day.id, date, stops: timings, legs, daylight, elapsedMin },
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

  const last = timings[timings.length - 1]!;
  const first = timings[0]!;
  if (last.arrival - first.arrival > LONG_DAY_MIN) {
    warnings.push({ code: 'LONG_DAY', dayId: day.id });
  }

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
