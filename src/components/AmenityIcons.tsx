import {
  AMENITIES,
  AMENITY_ICON_PATHS,
  readAmenities,
  type AmenityKey,
} from '../lib/amenities';

/**
 * The amenity row shown on an accommodation stop's card (WORK 33): the whole
 * closed set, every time, so absence reads as "no" rather than "not entered".
 * Green = provided, muted red = not — the planner's "do I pack a towel?"
 * check at a glance. Editing is in "All details" (`PinCardExpanded`).
 */
export function AmenityIcons({
  amenities,
  className = '',
}: {
  /** Raw `stops.amenities` (a JSON column — array, null, whatever). */
  amenities: unknown;
  className?: string;
}) {
  const have = new Set(readAmenities(amenities));
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {AMENITIES.map((a) => {
        const on = have.has(a.key as AmenityKey);
        return (
          <span
            key={a.key}
            title={on ? a.label : `${a.label} — not provided`}
            className={`flex items-center gap-1 text-[11.5px] ${
              on ? 'text-[oklch(0.78_0.13_155)]' : 'text-[oklch(0.62_0.13_25)]'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={AMENITY_ICON_PATHS[a.key as AmenityKey]} />
              {!on && <path d="M4 20 20 4" />}
            </svg>
            {a.label}
          </span>
        );
      })}
    </div>
  );
}
