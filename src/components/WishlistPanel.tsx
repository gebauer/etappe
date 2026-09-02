import { pb } from '../lib/pb';
import { firstPhotoUrl } from '../lib/pb-blocks';
import type { BlocksResponse, PoisResponse } from '../types/pb';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import { ContributorChip } from './ContributorMark';

interface Props {
  items: PoisResponse[];
  blocks: BlocksResponse[];
  open: boolean;
  onToggle: () => void;
  selectedId?: string | null;
  /** Shared hover-highlight id (WORK 12.10) — a hovered row lifts its map
   * pin, matching the carousel. Highlight only, no selection. */
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  onAdd: () => void;
  onImport: () => void;
  onPreview: (item: PoisResponse) => void;
  /** Opens the wishlist carousel (WORK 12.10). */
  onBrowseAll: () => void;
  /** How wishlist pins draw on the map (WORK 18.11) — photo thumbnails or
   * the kind's icon. The toggle sits in this header because the panel is
   * the wishlist's own control surface. */
  pinMode: 'photo' | 'icon';
  onTogglePinMode: () => void;
}

/**
 * The wishlist surface docked bottom-left over the map (design handoff,
 * "Wishlist panel") — captures without a slot (`pois`, no day/order_index).
 * Deliberately the *fallback* list, not the primary surface: the pins on
 * the map are (WORK 12.4), so this shows only the first few and collapses.
 *
 * A row opens the unified card (WORK 12.2) rather than placing directly, so
 * a look always comes before a commit; placing from there still reuses the
 * phase 6.3 ranked picker. Reject moved to the card's action bar with the
 * rest — this list no longer has its own hover ✕.
 */
export function WishlistPanel({
  items,
  blocks,
  open,
  onToggle,
  selectedId,
  hoveredId,
  onHover,
  onAdd,
  onImport,
  onPreview,
  onBrowseAll,
  pinMode,
  onTogglePinMode,
}: Props) {
  const shown = open ? items.slice(0, 4) : [];

  return (
    <div className="w-[236px] overflow-hidden rounded-xl border border-[oklch(0.30_0.012_250)] bg-[oklch(0.20_0.013_250/0.88)] font-sans text-text backdrop-blur-[10px]">
      <div className="flex w-full items-center gap-1.5 px-[11px] py-[9px] text-xs uppercase tracking-[0.08em] text-[oklch(0.86_0.006_250)]">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2.5 text-left"
        >
          <span>Wishlist · {items.length}</span>
        </button>
        {items.length > 0 && (
          <button
            onClick={onTogglePinMode}
            title={
              pinMode === 'photo'
                ? 'Map pins: photos — switch to kind icons'
                : 'Map pins: kind icons — switch to photos'
            }
            aria-label="Toggle wishlist pin style"
            className="flex h-[18px] w-[22px] flex-none items-center justify-center rounded border border-border-strong text-[10px] normal-case text-text-3 hover:text-text"
          >
            {pinMode === 'photo' ? '▦' : '❖'}
          </button>
        )}
        <button onClick={onToggle} aria-label="Collapse" className="flex-none">
          <span>{open ? '▾' : '▸'}</span>
        </button>
      </div>

      {open && (
        <>
          {items.length === 0 && (
            <p className="px-[11px] pb-2.5 text-[12.5px] text-text-4">
              Nothing on the wishlist yet.
            </p>
          )}
          {shown.map((item) => {
            const itemBlocks = blocks.filter(
              (b) => b.parent_type === 'poi' && b.parent_id === item.id,
            );
            const thumb = firstPhotoUrl(pb, itemBlocks);
            const hovered = hoveredId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPreview(item)}
                onMouseEnter={() => onHover?.(item.id)}
                onMouseLeave={() => onHover?.(null)}
                className={`flex w-full items-center gap-2.5 px-[11px] py-2 text-left ${
                  selectedId === item.id
                    ? 'bg-accent-surface'
                    : hovered
                      ? 'bg-control'
                      : ''
                }`}
              >
                <span
                  className={`h-[34px] w-[34px] flex-none overflow-hidden rounded-[7px] border bg-control ${
                    hovered ? 'border-wishlist' : 'border-border-strong'
                  }`}
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {item.title}
                  </span>
                  <span className="block truncate text-[11.5px] text-[oklch(0.64_0.01_250)]">
                    {TAXONOMY[item.kind as Kind]?.label ?? item.kind}
                  </span>
                </span>
                <ContributorChip poi={item} />
              </button>
            );
          })}
          {items.length > 0 && (
            <button
              onClick={onBrowseAll}
              className="w-full px-[11px] py-[9px] text-left text-[12.5px] text-text-2 hover:bg-[oklch(0.25_0.013_250)]"
            >
              Browse all {items.length} ›
            </button>
          )}

          <div className="flex gap-1.5 border-t border-[oklch(0.28_0.012_250)] px-[11px] py-2">
            <button
              onClick={onAdd}
              className="h-7 flex-1 rounded-[7px] border border-dashed border-border-strong text-xs text-text-2 hover:border-text-5 hover:text-text"
            >
              + Idea
            </button>
            <button
              onClick={onImport}
              title="Import highlights from pasted JSON"
              className="h-7 flex-1 rounded-[7px] border border-dashed border-border-strong text-xs text-text-2 hover:border-text-5 hover:text-text"
            >
              Import
            </button>
          </div>
        </>
      )}
    </div>
  );
}
