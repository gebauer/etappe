import type { PoisResponse } from '../types/pb';

/**
 * Wishlist contributor attribution (WORK 15.2). A wishlist entry carries a
 * small mark for whoever added it — itinerary stops carry none, because the
 * day plan is shared while the candidate list is personal.
 *
 * `name` and `color` are read straight off the `pois` row (snapshotted at
 * create time — see `1788000015`), so there is no `users` lookup here.
 * Nothing renders when the creator is unknown (rows from before the
 * migration, or a since-deleted account left an empty colour).
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

/** Initial-only circular chip — the `WishlistPanel` row's tight right edge. */
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

/** Dot + nickname pill. `variant` sets the metrics for each surface. */
export function ContributorPill({
  poi,
  variant,
}: {
  poi: PoisResponse;
  variant: 'card' | 'carousel' | 'carousel-phone';
}) {
  const c = contributorOf(poi);
  if (!c) return null;

  const cls =
    variant === 'card'
      ? 'h-[22px] max-w-[45%] rounded-[11px] border border-[oklch(0.32_0.012_250)] bg-[oklch(0.25_0.012_250)] px-2 text-[11px] text-text-2'
      : variant === 'carousel'
        ? 'h-[20px] rounded-[10px] bg-[oklch(0.16_0.014_250/0.72)] px-1.5 text-[10.5px] text-text-2 backdrop-blur-[6px]'
        : 'h-[17px] rounded-[10px] bg-[oklch(0.16_0.014_250/0.72)] px-1.5 text-[9.5px] text-text-2 backdrop-blur-[6px]';

  return (
    <span
      title={`Added by ${c.name}`}
      className={`flex min-w-0 flex-none items-center gap-1 ${cls}`}
    >
      <span
        className="h-[7px] w-[7px] flex-none rounded-full"
        style={{ backgroundColor: c.color }}
      />
      <span className="truncate">{c.name}</span>
    </span>
  );
}
