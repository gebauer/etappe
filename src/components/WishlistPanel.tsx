import { pb } from '../lib/pb';
import { firstPhotoUrl } from '../lib/pb-blocks';
import type { BlocksResponse, PoisResponse } from '../types/pb';
import { TAXONOMY, type Kind } from '../lib/taxonomy';

interface Props {
  items: PoisResponse[];
  blocks: BlocksResponse[];
  onAdd: () => void;
  onImport: () => void;
  onPreview: (item: PoisResponse) => void;
  onReject: (id: string) => void;
}

/** Left rail, below the day list (BUILD §9): captures without a slot land
 * here (`pois`, status "idea"). A row opens the read-only preview (WORK 8.1
 * follow-up "visual review") rather than placing directly — Place/Reject
 * live there now, so a look always comes before a commit. Placing still
 * reuses the phase 6.3 ranked picker rather than a bespoke drop target —
 * it's a capture like any other, just one that already has a name and
 * coordinates. */
export function WishlistPanel({
  items,
  blocks,
  onAdd,
  onImport,
  onPreview,
  onReject,
}: Props) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Wishlist
        </span>
        <div className="flex gap-1">
          <button
            onClick={onImport}
            title="Import highlights from pasted JSON"
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Import
          </button>
          <button
            onClick={onAdd}
            className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white"
          >
            + Idea
          </button>
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-400">
            Nothing on the wishlist yet.
          </li>
        )}
        {items.map((item) => {
          const itemBlocks = blocks.filter(
            (b) => b.parent_type === 'poi' && b.parent_id === item.id,
          );
          const thumb = firstPhotoUrl(pb, itemBlocks);
          return (
            <li
              key={item.id}
              className="group flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2"
            >
              <button
                onClick={() => onPreview(item)}
                title="Preview before placing or rejecting"
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-slate-900 hover:underline"
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded bg-slate-100" />
                )}
                <span className="min-w-0 truncate">
                  {item.title}
                  <span className="ml-1.5 text-xs text-slate-400">
                    {TAXONOMY[item.kind as Kind]?.label ?? item.kind}
                  </span>
                </span>
              </button>
              <span
                role="button"
                tabIndex={0}
                onClick={() => onReject(item.id)}
                className="shrink-0 rounded px-1 text-xs text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                aria-label={`Remove ${item.title} from the wishlist`}
              >
                ✕
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
