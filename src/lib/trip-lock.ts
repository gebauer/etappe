/**
 * Trip lock (author request 2026-09-09) — an accident guard, not a
 * permission. Roles (WORK 22) answer "may this person edit?"; the lock
 * answers "did I ask for this trip to be left alone?", and the person it
 * stops is the same one who set it and can clear it in a click.
 *
 * Two levels because they protect against different mistakes: `days` stops
 * the structural edit that is expensive to undo (inserting or deleting a
 * day reindexes every day below it and shifts date-derived blocks), while
 * `all` freezes the itinerary outright once a trip is settled.
 *
 * The wishlist is deliberately never locked: it is the scratchpad you use
 * *because* the itinerary is finished, and losing an idea you spotted is a
 * worse outcome than an accidental edit to a list of ideas.
 */

/** Stored on `trips.locked`. PocketBase writes `''` for an unset select. */
export type TripLock = '' | 'days' | 'all';

/** What a mutation touches, so the guard knows which lock covers it. */
export type LockScope = 'itinerary' | 'wishlist' | 'days';

export function isTripLock(value: unknown): value is TripLock {
  return value === '' || value === 'days' || value === 'all';
}

/** Normalises whatever the record holds — an older row has no field at
 * all, and PocketBase hands back `''` rather than null for an unset
 * select. */
export function tripLockOf(trip: { locked?: string } | null): TripLock {
  const raw = trip?.locked ?? '';
  return isTripLock(raw) ? raw : '';
}

/** Does `lock` block a mutation of this `scope`? */
export function lockBlocks(lock: TripLock, scope: LockScope): boolean {
  if (lock === '') return false;
  if (scope === 'wishlist') return false;
  return lock === 'all' || scope === 'days';
}

/** The header chip's text. `null` when the trip is open — there is no chip,
 * only the outline padlock that opens the menu. */
export function lockChipLabel(lock: TripLock): string | null {
  if (lock === 'days') return 'Days locked';
  if (lock === 'all') return 'Locked';
  return null;
}

/**
 * Why a mutation was refused, naming the way out. The remedy is half the
 * message on purpose: the failure mode this feature has to avoid is
 * someone forgetting they locked the trip and reading the refusal as the
 * app being broken.
 */
export function lockRefusalMessage(lock: TripLock, scope: LockScope): string {
  const where = 'Click the 🔒 in the header to unlock.';
  if (lock === 'days' && scope === 'days') {
    return `Days are locked, so they can't be added or removed. ${where}`;
  }
  return `This trip is locked. ${where}`;
}
