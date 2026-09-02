/**
 * Daylight providers for the cascade engine (WORK 2.3). The engine never
 * imports SunCalc; it receives a DaylightProvider so tests stay deterministic.
 *
 * The engine works in minutes from local midnight, where "local" is the trip's
 * timezone — but the provider signature carries only date and coordinates. So
 * the SunCalc provider is built per-trip, closing over the IANA timezone, and
 * converts SunCalc's absolute instants to wall-clock minutes in that zone.
 */

import SunCalc from 'suncalc';
import { formatClock, type Daylight, type DaylightProvider } from './cascade';

/** Absolute instant -> minutes from midnight in `timeZone`, or null if the
 * instant is invalid (SunCalc returns an Invalid Date when an event does not
 * occur — e.g. no sunset during a polar day). */
function minutesInZone(instant: Date, timeZone: string): number | null {
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour % 24) * 60 + minute;
}

/**
 * A DaylightProvider backed by SunCalc for the given IANA timezone. Returns
 * null when the day has no sunset (polar day) so the daylight band and the
 * AFTER_DARK check simply do not apply.
 */
export function createSunCalcDaylight(timeZone: string): DaylightProvider {
  return (dateISO, lat, lon) => {
    // Noon UTC anchors the request safely inside the calendar day.
    const noon = new Date(`${dateISO.slice(0, 10)}T12:00:00Z`);
    const times = SunCalc.getTimes(noon, lat, lon);
    const sunset = minutesInZone(times.sunset, timeZone);
    if (sunset == null) return null;
    const sunrise = minutesInZone(times.sunrise, timeZone) ?? 0;
    const dusk = minutesInZone(times.dusk, timeZone) ?? sunset;
    return { sunrise, sunset, dusk };
  };
}

/** A fixed provider for tests: always returns the same daylight (or null). */
export function stubDaylight(daylight: Daylight | null): DaylightProvider {
  return () => daylight;
}

// ---------------------------------------------------------------------------
// Phrasing (WORK 17.4)
//
// The daylight line reads against dawn before noon and dusk after it. A 09:00
// stop told "Daylight until 23:57 · well clear" is technically true and
// useless — what a morning arrival wants is how far past first light it is.
// Dawn ( = the engine's `sunrise`) and dusk come straight from the cascade
// output; only the sentence is the design's.

const NOON = 12 * 60;

/** "4 h 48 m" / "45 m" — the spaced form the handoff prose uses, distinct
 * from `format.ts`'s compact `formatDuration`. */
function spacedHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} m` : `${h} h ${m} m`;
}

/** Signed "H:MM" offset for the expanded card's mono token, e.g. `+4:48`,
 * `−8:52` (real minus sign). */
function signedHM(min: number): string {
  const sign = min < 0 ? '−' : '+';
  const abs = Math.abs(min);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

export interface DaylightPhrase {
  /** The card line, e.g. `4 h 48 m after dawn · dawn 04:12` or
   * `Daylight until 23:57 · well clear`. */
  line: string;
  /** The expanded card's computed-strip token: `dawn +4:48` before noon,
   * `dusk −8:52` from noon on. */
  token: string;
}

/**
 * Phrase a stop's daylight situation from its arrival (minutes past local
 * midnight) and the day's daylight band. `afterDark` — the cascade's
 * AFTER_DARK verdict for this stop — overrides the afternoon margin copy
 * when the arrival is already past usable light.
 */
export function describeDaylight(
  daylight: Daylight,
  arrivalMin: number,
  afterDark = false,
): DaylightPhrase {
  if (arrivalMin < NOON) {
    const dawn = daylight.sunrise;
    const delta = arrivalMin - dawn;
    const token = `dawn ${signedHM(delta)}`;
    if (delta < 0) {
      return { line: `Before dawn · dawn ${formatClock(dawn)}`, token };
    }
    const firstLight = delta < 45 ? ' · first light' : '';
    return {
      line: `${spacedHM(delta)} after dawn · dawn ${formatClock(dawn)}${firstLight}`,
      token,
    };
  }

  const remaining = daylight.sunset - arrivalMin;
  const margin =
    afterDark || remaining <= 0
      ? 'after dark'
      : remaining > 180
        ? 'well clear'
        : `${spacedHM(remaining)} left`;
  return {
    line: `Daylight until ${formatClock(daylight.sunset)} · ${margin}`,
    token: `dusk ${signedHM(arrivalMin - daylight.dusk)}`,
  };
}
