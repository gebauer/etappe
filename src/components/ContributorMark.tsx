import type { PoisResponse } from '../types/pb';

/**
 * Wishlist contributor attribution (WORK 15.2 / 22). A wishlist entry carries
 * a small mark for whoever added it — itinerary stops carry none, because the
 * day plan is shared while the candidate list is personal.
 *
 * `name` and `color` are read straight off the `pois` row (snapshotted at
 * create time — see `1788000015`), so there is no `users` lookup here.
 * Nothing renders when the creator is unknown (rows from before the
 * migration, or a since-deleted account left an empty colour).
 *
 * The name is the account's nickname (WORK 22) or, without one, its email's
 * local part — which can be long, so the pill clips it to 7 characters. The
 * full name is always in the `title`.
 */
interface Contributor {
  name: string;
  color: string;
}

export function contributorOf(poi: {
  creator_name?: string;
  creator_color?: string;
}): Contributor | null {
  const color = poi.creator_color?.trim();
  if (!color) return null;
  return { name: poi.creator_name?.trim() || '?', color };
}

/** A colour-filled name pill, clipped to 7 characters. The primitive the
 * card, the expanded card and the trip cards all use. */
export function NamePill({
  name,
  color,
  title,
}: {
  name: string;
  color: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      className="flex h-[20px] flex-none items-center rounded-[10px] px-2 text-[11px] font-medium text-[oklch(0.16_0.02_250)]"
      style={{ backgroundColor: color }}
    >
      {name.slice(0, 7)}
    </span>
  );
}

/** Just the colour — for tight surfaces like the browse carousel. */
export function ContributorDot({
  poi,
  size = 8,
}: {
  poi: PoisResponse;
  size?: number;
}) {
  const c = contributorOf(poi);
  if (!c) return null;
  return (
    <span
      title={`Added by ${c.name}`}
      className="flex-none rounded-full ring-1 ring-[oklch(0.16_0.02_250/0.55)]"
      style={{ width: size, height: size, backgroundColor: c.color }}
    />
  );
}

/** Initial-in-a-coloured-circle — the `WishlistPanel` row's tight right edge. */
export function ContributorChip({ poi }: { poi: PoisResponse }) {
  const c = contributorOf(poi);
  if (!c) return null;
  return (
    <span
      title={`Added by ${c.name}`}
      className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-semibold uppercase text-[oklch(0.16_0.02_250)]"
      style={{ backgroundColor: c.color }}
    >
      {c.name.slice(0, 1)}
    </span>
  );
}

/** Name pill for a wishlist entry — used on the card and the expanded card. */
export function ContributorPill({ poi }: { poi: PoisResponse }) {
  const c = contributorOf(poi);
  if (!c) return null;
  return (
    <NamePill name={c.name} color={c.color} title={`Added by ${c.name}`} />
  );
}
