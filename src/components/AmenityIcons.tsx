import {
  AMENITIES,
  AMENITY_ICON_PATHS,
  amenityState,
  readAmenities,
  type AmenityKey,
} from '../lib/amenities';

const TINT: Record<'no' | 'yes' | 'book', string> = {
  yes: 'text-[oklch(0.78_0.13_155)]', // green — provided
  book: 'text-[oklch(0.80_0.15_85)]', // amber — bookable
  no: 'text-[oklch(0.62_0.13_25)]', // muted red — not provided
};

const TITLE: Record<'no' | 'yes' | 'book', (label: string) => string> = {
  yes: (l) => l,
  book: (l) => `${l} — bookable`,
  no: (l) => `${l} — not provided`,
};

/**
 * The amenity row on an accommodation stop's card (WORK 33): the whole closed
 * set, every time, so absence reads as "no" rather than "not entered". Icons
 * only — the label is the hover tooltip (WORK 34); the card is dense and the
 * six glyphs plus colour carry the "do I pack a towel?" check on their own.
 * Green = provided, amber = bookable, muted red = not. Editing is in "All
 * details" (`PinCardExpanded`).
 */
export function AmenityIcons({
  amenities,
  className = '',
}: {
  /** Raw `stops.amenities` (a JSON column — map, legacy array, null). */
  amenities: unknown;
  className?: string;
}) {
  const map = readAmenities(amenities);
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {AMENITIES.map((a) => {
        const state = amenityState(map, a.key as AmenityKey);
        return (
          <span
            key={a.key}
            title={TITLE[state](a.label)}
            className={TINT[state]}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={AMENITY_ICON_PATHS[a.key as AmenityKey]} />
              {state === 'no' && <path d="M4 20 20 4" />}
            </svg>
          </span>
        );
      })}
    </div>
  );
}
