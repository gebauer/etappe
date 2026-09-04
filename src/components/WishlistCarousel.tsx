import { useMemo, useRef } from 'react';
import { pb } from '../lib/pb';
import { blocksFor, blockFileUrl } from '../lib/pb-blocks';
import { categoryColor } from '../lib/map-colors';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import type { BlocksResponse, PoisResponse } from '../types/pb';
import { ContributorDot } from './ContributorMark';

interface Props {
  items: PoisResponse[];
  /** The cached proximity chain (WORK 12.10) — the same order the card's
   * `‹`/`›` steps through, so scanning the strip matches stepping the pins. */
  order: string[];
  blocks: BlocksResponse[];
  starOnly: boolean;
  onToggleStarOnly: () => void;
  /** Shared hover-highlight id (WORK 12.10) — hovering a card lifts it and
   * grows its map pin, nothing more: no selection, no card, no map move. */
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onToggleStar: (item: PoisResponse, next: boolean) => void;
  /** Click a card → zoom to that place: the carousel closes and its card
   * opens. This is the only thing in here that selects or moves the map. */
  onPick: (item: PoisResponse) => void;
  onClose: () => void;
  /** Phone metering (WORK 17.3): smaller cards, no `‹`/`›` arrows — the
   * strip is touch-scrolled with scroll-snap doing the work. */
  phone?: boolean;
  /** False for a `viewer` (WORK 22): the per-card ★ is not shown. */
  canStar?: boolean;
}

const CARD_STEP = 178 + 12; // card width + strip gap; arrows move three at a time.

/**
 * The wishlist "photo wheel" (design handoff, "Wishlist carousel") — a
 * full-map-width bottom filmstrip on a gradient fade, opened from the
 * panel's `Browse all N ›`. It shares the bottom-left slot with the panel
 * (TripEditor hides the panel while this is up) and is itself hidden behind
 * an open card.
 */
export function WishlistCarousel({
  items,
  order,
  blocks,
  starOnly,
  onToggleStarOnly,
  hoveredId,
  onHover,
  onToggleStar,
  onPick,
  onClose,
  phone = false,
  canStar = true,
}: Props) {
  const stripRef = useRef<HTMLDivElement | null>(null);

  const ordered = useMemo(() => {
    const rank = new Map(order.map((id, i) => [id, i]));
    return items
      .filter((it) => !starOnly || it.starred)
      .slice()
      .sort(
        (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
      );
  }, [items, order, starOnly]);

  const meta = starOnly
    ? `${ordered.length} starred · nearest first`
    : `${ordered.length} ${ordered.length === 1 ? 'place' : 'places'} · nearest first`;

  const scrollBy = (dir: -1 | 1) =>
    stripRef.current?.scrollBy({
      left: dir * CARD_STEP * 3,
      behavior: 'smooth',
    });

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[22] bg-[linear-gradient(180deg,transparent,oklch(0.15_0.014_250/0.86)_42%)] pb-2 pt-10 font-sans">
      <div
        className={`pointer-events-auto flex items-center gap-3 pb-2 ${phone ? 'px-2.5' : 'px-4'}`}
      >
        <button
          onClick={onToggleStarOnly}
          className={`flex h-[30px] items-center gap-1.5 rounded-[15px] px-3 text-[12.5px] ${
            starOnly
              ? 'bg-wishlist text-[oklch(0.20_0.04_80)]'
              : 'border border-[oklch(0.34_0.012_250)] bg-[oklch(0.22_0.013_250/0.9)] text-text-2'
          }`}
        >
          <span>★</span>
          <span className="whitespace-nowrap">Top choices</span>
        </button>
        <span className="truncate font-mono text-[11px] text-text-4">
          {meta}
        </span>
        <button
          onClick={onClose}
          aria-label="Close carousel"
          className="ml-auto flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[oklch(0.16_0.014_250/0.6)] text-[13px] text-text-2 backdrop-blur-[6px] hover:text-text"
        >
          ✕
        </button>
      </div>

      <div className="relative">
        {ordered.length > 3 && !phone && (
          <>
            <button
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
              className="pointer-events-auto absolute left-1.5 top-1/2 z-10 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.20_0.013_250/0.92)] text-text-2 backdrop-blur-[8px] hover:text-text"
            >
              ‹
            </button>
            <button
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
              className="pointer-events-auto absolute right-1.5 top-1/2 z-10 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.20_0.013_250/0.92)] text-text-2 backdrop-blur-[8px] hover:text-text"
            >
              ›
            </button>
          </>
        )}

        <div
          ref={stripRef}
          className={`pointer-events-auto flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-1.5 pt-1 ${
            phone ? 'gap-[9px] px-2.5' : 'gap-3 px-4'
          }`}
        >
          {ordered.length === 0 && (
            <p className="py-6 text-[12.5px] text-text-4">
              {starOnly
                ? 'No starred places yet — tap a card’s ★ to add one.'
                : 'Nothing on the wishlist yet.'}
            </p>
          )}
          {ordered.map((item) => {
            const cover = blocksFor(blocks, 'poi', item.id).find(
              (b) => b.kind === 'photo',
            );
            const url = cover ? blockFileUrl(pb, cover, '640x0') : null;
            const hovered = hoveredId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPick(item)}
                onMouseEnter={() => onHover(item.id)}
                onMouseLeave={() => onHover(null)}
                className={`relative flex-none snap-start overflow-hidden text-left transition-transform ${
                  phone
                    ? 'h-[92px] w-[124px] rounded-[11px]'
                    : 'h-[136px] w-[178px] rounded-[13px]'
                } ${
                  hovered
                    ? '-translate-y-1 shadow-[0_10px_24px_oklch(0.08_0.02_250/0.5)] ring-2 ring-wishlist'
                    : 'shadow-[0_6px_16px_oklch(0.10_0.02_250/0.4)]'
                }`}
                style={{
                  background: categoryColor(item.kind ?? 'uncategorized'),
                }}
              >
                {url && (
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 h-[58%] bg-[linear-gradient(to_top,oklch(0.13_0.015_250/0.88),transparent)]" />
                <span className="absolute bottom-2 left-2.5 right-7">
                  <span className="block truncate text-[13px] font-semibold text-[oklch(0.97_0.004_250)]">
                    {item.title}
                  </span>
                  <span className="block truncate text-[11px] text-[oklch(0.82_0.01_250)]">
                    {TAXONOMY[item.kind as Kind]?.label ?? item.kind}
                  </span>
                </span>
                <span className="absolute bottom-2 right-2.5 flex">
                  <ContributorDot poi={item} size={phone ? 8 : 9} />
                </span>
                {(canStar || item.starred) && (
                  <span
                    role={canStar ? 'button' : undefined}
                    tabIndex={canStar ? 0 : undefined}
                    aria-label={
                      !canStar ? 'Starred' : item.starred ? 'Unstar' : 'Star'
                    }
                    onClick={
                      canStar
                        ? (e) => {
                            e.stopPropagation();
                            onToggleStar(item, !item.starred);
                          }
                        : undefined
                    }
                    onKeyDown={
                      canStar
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onToggleStar(item, !item.starred);
                            }
                          }
                        : undefined
                    }
                    className={`absolute right-1.5 top-1.5 flex items-center justify-center rounded-full text-[13px] ${
                      phone ? 'h-6 w-6' : 'h-7 w-7'
                    } ${
                      item.starred
                        ? 'bg-wishlist text-[oklch(0.20_0.04_80)]'
                        : 'bg-[oklch(0.16_0.014_250/0.6)] text-text backdrop-blur-[4px]'
                    }`}
                  >
                    ★
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
