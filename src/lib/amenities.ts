/**
 * The closed set of accommodation amenities (WORK 33). Like the stop
 * taxonomy, this is a fixed list: adding one is a one-line change here plus
 * an icon, never a schema change.
 *
 * `stops.amenities` is a JSON map from key to state:
 *
 *   - **absent**  — not provided / not known. The planner packs it either
 *     way, so the app does not distinguish the two.
 *   - `'yes'`     — provided.
 *   - `'book'`    — available but has to be booked / paid for ahead. Only
 *     `bookable` amenities (breakfast) ever carry this; the UI never offers
 *     it for the rest (WORK 34).
 *
 * The earlier shape was a plain array of provided keys; `readAmenities`
 * still accepts that and reads every entry as `'yes'`.
 *
 * Pure: no React, no icons imported here (the SVG paths are plain strings the
 * `AmenityIcons` component renders). Order is the order they show on a card.
 */

export const AMENITIES = [
  { key: 'linen', label: 'Bed linen' },
  { key: 'towels', label: 'Towels' },
  { key: 'breakfast', label: 'Breakfast', bookable: true },
  { key: 'private_bath', label: 'Private bath' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'wifi', label: 'Wi-Fi' },
] as const;

export type AmenityKey = (typeof AMENITIES)[number]['key'];
export type AmenityState = 'yes' | 'book';
export type AmenityMap = Partial<Record<AmenityKey, AmenityState>>;

/** The keys alone, for a Zod enum at the import boundary. */
export const AMENITY_KEYS = AMENITIES.map((a) => a.key) as AmenityKey[];

const KEYS = new Set<string>(AMENITY_KEYS);
const BOOKABLE = new Set<string>(
  AMENITIES.filter((a) => 'bookable' in a && a.bookable).map((a) => a.key),
);

export function isAmenityKey(value: unknown): value is AmenityKey {
  return typeof value === 'string' && KEYS.has(value);
}

/** Can this amenity be in the `'book'` state? (Only breakfast, today.) */
export function isBookable(key: AmenityKey): boolean {
  return BOOKABLE.has(key);
}

/**
 * Normalise whatever PocketBase handed back for `stops.amenities` — a JSON
 * column, so `null`, the legacy `['linen','wifi']` array, or the current
 * `{ linen: 'yes', breakfast: 'book' }` map — into a clean map keyed by
 * known amenities only. `'book'` survives only for a `bookable` amenity;
 * anything else truthy reads as `'yes'`.
 */
export function readAmenities(raw: unknown): AmenityMap {
  const out: AmenityMap = {};
  if (Array.isArray(raw)) {
    for (const k of raw) if (isAmenityKey(k)) out[k] = 'yes';
    return out;
  }
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!isAmenityKey(k) || !v) continue;
      out[k] = v === 'book' && isBookable(k) ? 'book' : 'yes';
    }
  }
  return out;
}

/** Set (or clear, with `null`) one amenity, returning a fresh normalised
 * map. `'book'` on a non-bookable amenity is coerced to `'yes'`. */
export function setAmenity(
  current: AmenityMap,
  key: AmenityKey,
  state: AmenityState | null,
): AmenityMap {
  const next = { ...current };
  if (state === null) delete next[key];
  else next[key] = state === 'book' && isBookable(key) ? 'book' : 'yes';
  return readAmenities(next);
}

/** `'no' | 'yes' | 'book'` for one key — the flat form the UI switches on. */
export function amenityState(
  map: AmenityMap,
  key: AmenityKey,
): AmenityState | 'no' {
  return map[key] ?? 'no';
}

/**
 * 16×16 icon geometry per amenity, drawn with `currentColor` so the caller
 * tints it green (provided), amber (bookable) or muted-red (not). Kept as
 * raw path data rather than a component so `amenities.ts` stays React-free
 * and the same glyphs can be inlined into the print stylesheet if wanted.
 */
export const AMENITY_ICON_PATHS: Record<AmenityKey, string> = {
  // bed
  linen:
    'M2 6v9M2 11h18a2 2 0 0 1 2 2v2M22 15v-2M6 11V9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  // stacked folded towels
  towels: 'M4 7h16M4 12h16M4 17h16',
  // coffee cup
  breakfast:
    'M4 8h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8zM17 9h2a2 2 0 0 1 0 4h-2M7 3v2M11 3v2',
  // shower head over a tray — an en-suite of your own
  private_bath:
    'M6 3v5M4 8h8M8 8v2M6 13h.01M9 15h.01M12 13h.01M15 15h.01M18 13h.01M4 21h16',
  // pot / lid
  kitchen: 'M4 9h16M6 9v7a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9M9 9V6h6v3M12 3v3',
  // wifi arcs
  wifi: 'M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01',
};
