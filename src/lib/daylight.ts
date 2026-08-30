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
import type { Daylight, DaylightProvider } from './cascade';

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
