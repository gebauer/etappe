import { addDays } from './cascade';

/** Shift an "HH:MM" clock time by a signed minute offset, clamped to the day. */
export function shiftClock(hhmm: string, deltaMin: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const total = Math.max(
    0,
    Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + deltaMin),
  );
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Minutes as "1h 55m" / "45m" / "0m". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Straight-line distance for a compact chip: "260 m" / "1.1 km". */
export function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** The derived calendar date for a day, formatted for display. Dates are never
 * stored — this is trip.start_date + order_index (BUILD §2). */
export function formatDayDate(startDate: string, orderIndex: number): string {
  const iso = addDays(startDate, orderIndex);
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}
