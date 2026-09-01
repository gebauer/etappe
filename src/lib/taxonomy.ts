/**
 * The closed stop taxonomy (BUILD §7).
 *
 * Adding a member means adding its icon to the sprite build (phase 5.1) and a
 * default dwell here — the enum never accepts a free-text kind. `dwell` is in
 * minutes; `null` marks accommodation kinds whose dwell comes from activities
 * or the overnight rather than a fixed default. `icon` is a Maki/Temaki icon
 * id; the sprite build validates every id and fails if one is missing.
 */

export type TaxonomyEntry = {
  label: string;
  /** Default dwell in minutes, or null for accommodation (no fixed default). */
  dwell: number | null;
  /** Maki/Temaki icon id, rasterised by the sprite build. */
  icon: string;
};

export const TAXONOMY = {
  waterfall: { label: 'Waterfall', dwell: 45, icon: 'waterfall' },
  canyon: { label: 'Canyon', dwell: 60, icon: 'valley' },
  glacier: { label: 'Glacier', dwell: 90, icon: 'snow' },
  hot_spring: { label: 'Hot spring', dwell: 120, icon: 'hot-spring' },
  volcano: { label: 'Volcano', dwell: 90, icon: 'volcano' },
  cave: { label: 'Cave', dwell: 60, icon: 'entrance' },
  lake: { label: 'Lake', dwell: 30, icon: 'water' },
  coast: { label: 'Coast', dwell: 45, icon: 'beach' },
  viewpoint: { label: 'Viewpoint', dwell: 20, icon: 'viewpoint' },
  hike: { label: 'Hike', dwell: 180, icon: 'pedestrian' },
  museum: { label: 'Museum', dwell: 90, icon: 'museum' },
  monument: { label: 'Monument', dwell: 30, icon: 'monument' },
  church: { label: 'Church', dwell: 20, icon: 'religious-christian' },
  town: { label: 'Town', dwell: 90, icon: 'town' },
  restaurant: { label: 'Restaurant', dwell: 60, icon: 'restaurant' },
  hotel: { label: 'Hotel', dwell: null, icon: 'lodging' },
  campsite: { label: 'Campsite', dwell: null, icon: 'campsite' },
  airport: { label: 'Airport', dwell: 60, icon: 'airport' },
  ferry: { label: 'Ferry', dwell: 30, icon: 'ferry' },
  fuel: { label: 'Fuel', dwell: 15, icon: 'fuel' },
  shop: { label: 'Shop', dwell: 30, icon: 'shop' },
  pool: { label: 'Pool', dwell: 90, icon: 'swimming' },
  wildlife: { label: 'Wildlife', dwell: 45, icon: 'zoo' },
  parking: { label: 'Parking', dwell: 5, icon: 'parking' },
  other: { label: 'Other', dwell: 30, icon: 'marker' },
  // Deliberately a hollow circle with no glyph (BUILD §7): reads as "needs
  // attention", not as a legitimate kind.
  uncategorized: { label: 'Uncategorized', dwell: 30, icon: 'circle-stroked' },
} as const satisfies Record<string, TaxonomyEntry>;

/** The closed set of stop kinds. */
export type Kind = keyof typeof TAXONOMY;

export const KINDS = Object.keys(TAXONOMY) as Kind[];

export function isKind(value: unknown): value is Kind {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(TAXONOMY, value)
  );
}

/** Taxonomy default dwell in minutes; null for accommodation kinds. */
export function defaultDwell(kind: Kind): number | null {
  return TAXONOMY[kind].dwell;
}

/**
 * Is this a kind you sleep at? The taxonomy already encodes it — an
 * accommodation kind is exactly the one with no fixed dwell, because its
 * dwell comes from the overnight rather than a default (see `dwell`
 * above). Naming it keeps callers from re-deriving `dwell === null` and
 * guessing at what that means.
 */
export function isAccommodationKind(kind: Kind): boolean {
  return TAXONOMY[kind].dwell === null;
}

export function iconFor(kind: Kind): string {
  return TAXONOMY[kind].icon;
}

/**
 * Seed for `trips.default_dwell` (BUILD §2): the taxonomy default minutes per
 * kind. Accommodation kinds (null dwell) are omitted — their dwell comes from
 * activities, not a fixed default.
 */
export function defaultDwellSeed(): Record<string, number> {
  const seed: Record<string, number> = {};
  for (const kind of KINDS) {
    const dwell = TAXONOMY[kind].dwell;
    if (dwell !== null) seed[kind] = dwell;
  }
  return seed;
}
