import { pb } from '../lib/pb';
import { firstPhotoUrl } from '../lib/pb-blocks';
import type { BlocksResponse, PoisResponse } from '../types/pb';
import { TAXONOMY, type Kind } from '../lib/taxonomy';

interface Props {
  items: PoisResponse[];
  blocks: BlocksResponse[];
  open: boolean;
  onToggle: () => void;
  selectedId?: string | null;
  onAdd: () => void;
  onImport: () => void;
  onPreview: (item: PoisResponse) => void;
}

/**
 * The wishlist surface docked bottom-left over the map (design handoff,
 * "Wishlist panel") — captures without a slot (`pois`, status "idea").
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
  onAdd,
  onImport,
  onPreview,
}: Props) {
  const shown = open ? items.slice(0, 4) : [];

  return (
    <div className="w-[236px] overflow-hidden rounded-xl border border-[oklch(0.30_0.012_250)] bg-[oklch(0.20_0.013_250/0.88)] font-sans text-text backdrop-blur-[10px]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2.5 px-[11px] py-[9px] text-xs uppercase tracking-[0.08em] text-[oklch(0.86_0.006_250)]"
      >
        <span>Wishlist · {items.length}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>

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
            return (
              <button
                key={item.id}
                onClick={() => onPreview(item)}
                className={`flex w-full items-center gap-2.5 px-[11px] py-2 text-left ${
                  selectedId === item.id
                    ? 'bg-accent-surface'
                    : 'hover:bg-white/5'
                }`}
              >
                <span className="h-[34px] w-[34px] flex-none overflow-hidden rounded-[7px] border border-border-strong bg-control">
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
              </button>
            );
          })}
          {items.length > shown.length && (
            <p className="px-[11px] pb-1.5 pt-0.5 font-mono text-[10.5px] text-text-5">
              +{items.length - shown.length} more on the map
            </p>
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
