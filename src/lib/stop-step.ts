/**
 * Stepping one stop at a time (design handoff rev 12, "Stop stepping").
 *
 * The phone drawer shows a single stop card rather than the day's list, so
 * moving through the day is a step, not a scroll. Kept here — and pure —
 * because three surfaces step the same way (the drawer card, its `‹ ›`
 * buttons and the detail sheet's swipe) and they must agree on where the
 * end of the day leads.
 */

/** A swipe shorter than this is a tap or a scroll, not a step. */
export const SWIPE_MIN_PX = 40;

/**
 * The next index, wrapping. Stepping past the last stop lands on the first:
 * a day is a loop you can keep thumbing through, and a dead arrow at each
 * end would be two controls that do nothing most of the time.
 */
export function stepIndex(index: number, length: number, dir: -1 | 1): number {
  if (length <= 0) return 0;
  return (((index + dir) % length) + length) % length;
}

/** Keep an index inside a day whose stop count just changed under it. */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * Which way a horizontal drag steps, or null if it was too short to count.
 * Dragging left pulls the next stop in, mirroring how the content moves.
 */
export function swipeStep(dx: number): -1 | 1 | null {
  if (Math.abs(dx) <= SWIPE_MIN_PX) return null;
  return dx < 0 ? 1 : -1;
}
