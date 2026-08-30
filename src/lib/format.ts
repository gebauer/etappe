import { addDays } from './cascade';

/** Minutes as "1h 55m" / "45m" / "0m". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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
