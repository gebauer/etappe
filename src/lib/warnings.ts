import type { Warning, WarningCode } from './cascade';

/**
 * Human copy for the engine's warning codes, for the itinerary column's
 * warning banners (design handoff: "Copy comes verbatim from the engine,
 * e.g. `NO_ACCOMMODATION — day ends without a place to stay`" — the code
 * stays visible, the sentence explains it).
 *
 * Presentation only: the engine decides *whether* a warning fires and by
 * how much (`deficitMin`); this only decides how to say it. Kept out of the
 * component so the share view and PDF (phase 9) word it identically.
 */
const TEXT: Record<WarningCode, string> = {
  MISSED_ANCHOR: 'arrives later than its anchor time',
  NO_ACCOMMODATION: 'day ends without a place to stay',
  AFTER_DARK: 'arrives after dark',
  LONG_DAY: 'more than twelve hours on the go',
  FROAD_SEASON: 'F-road leg outside its open season',
  UNCATEGORIZED: 'stop has no kind yet',
};

/** `NO_ACCOMMODATION — day ends without a place to stay`, with the minutes
 * missed appended for the two codes that carry them. */
export function warningText(warning: Warning): string {
  const base = `${warning.code} — ${TEXT[warning.code]}`;
  return warning.deficitMin != null
    ? `${base} by ${warning.deficitMin} min`
    : base;
}
