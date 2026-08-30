import { addDays } from './cascade';

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
