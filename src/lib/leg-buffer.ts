/**
 * The per-leg buffer override (WORK 19.5).
 *
 * One field, two units. `"12%"` is twelve percent of the leg's own time;
 * `"12"` is twelve minutes flat. Both are useful and neither subsumes the
 * other: a percentage is right for a long drive, where the uncertainty
 * scales with the distance, and a flat figure is right for a short one,
 * where 5 % of eight minutes rounds away to nothing but "give me ten
 * minutes for parking" does not.
 *
 * Stored verbatim in `legs.buffer_override` so the row reads back exactly
 * what was typed. Empty means "use the trip's `car_buffer_pct`".
 */

export type BufferOverride =
  | { unit: 'pct'; value: number }
  | { unit: 'min'; value: number };

/** `null` = no override (use the trip default). `'invalid'` = the input is
 * not a buffer at all, and the caller should refuse it rather than guess. */
export function parseBufferOverride(
  raw: string | null | undefined,
): BufferOverride | null | 'invalid' {
  const text = (raw ?? '').trim();
  if (text === '') return null;

  const pct = text.endsWith('%');
  const digits = pct ? text.slice(0, -1).trim() : text;
  // `Number('')` is 0, so a bare "%" would otherwise read as a real zero.
  if (digits === '') return 'invalid';
  const num = Number(digits);
  if (!Number.isFinite(num) || num < 0) return 'invalid';

  return { unit: pct ? 'pct' : 'min', value: num };
}

/** Back to the stored/typed form. */
export function formatBufferOverride(o: BufferOverride | null): string {
  if (!o) return '';
  return o.unit === 'pct' ? `${o.value}%` : String(o.value);
}

/** How the row labels a buffer that is in force — `+ 7 min` reads as
 * arithmetic beside the routed time, which is the point. */
export function describeBuffer(minutes: number): string {
  return minutes > 0 ? `+ ${minutes} min` : '';
}
