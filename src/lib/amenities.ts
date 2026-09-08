/**
 * The closed set of accommodation amenities (WORK 33). Like the stop
 * taxonomy, this is a fixed list: adding one is a one-line change here plus
 * an icon, never a schema change. `stops.amenities` stores a JSON array of
 * these keys; a key in the list means "provided", absent means "bring your
 * own / don't know" — the planner packs it either way, so there is no third
 * state.
 *
 * Pure: no React, no icons imported here (the SVG paths are plain strings the
 * `AmenityIcons` component renders). Order is the order they show on a card.
 */

export const AMENITIES = [
  { key: 'linen', label: 'Bed linen' },
  { key: 'towels', label: 'Towels' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'private_bath', label: 'Private bath' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'wifi', label: 'Wi-Fi' },
] as const;

export type AmenityKey = (typeof AMENITIES)[number]['key'];

/** The keys alone, for a Zod enum at the import boundary. */
export const AMENITY_KEYS = AMENITIES.map((a) => a.key) as AmenityKey[];

const KEYS = new Set<string>(AMENITY_KEYS);

export function isAmenityKey(value: unknown): value is AmenityKey {
  return typeof value === 'string' && KEYS.has(value);
}

/**
 * Normalise whatever PocketBase handed back for `stops.amenities` (a JSON
 * column: `null`, an array, or in principle anything) into a clean, ordered,
 * de-duplicated list of known keys. Unknown entries are dropped rather than
 * carried — a renamed amenity should disappear, not linger untyped.
 */
export function readAmenities(raw: unknown): AmenityKey[] {
  if (!Array.isArray(raw)) return [];
  const have = new Set(raw.filter(isAmenityKey));
  return AMENITIES.map((a) => a.key).filter((k) => have.has(k));
}

/** Add or remove one key, returning a fresh normalised list. */
export function toggleAmenity(
  current: AmenityKey[],
  key: AmenityKey,
  on: boolean,
): AmenityKey[] {
  const have = new Set(current);
  if (on) have.add(key);
  else have.delete(key);
  return readAmenities([...have]);
}

/**
 * 16×16 icon geometry per amenity, drawn with `currentColor` so the caller
 * tints it green (provided) or muted-red (not). Kept as raw path data rather
 * than a component so `amenities.ts` stays React-free and the same glyphs can
 * be inlined into the print stylesheet if that is ever wanted.
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
