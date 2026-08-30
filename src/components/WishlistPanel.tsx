import type { PoisResponse } from '../types/pb';
import { TAXONOMY, type Kind } from '../lib/taxonomy';

interface Props {
  items: PoisResponse[];
  onAdd: () => void;
  onPlace: (item: PoisResponse) => void;
  onReject: (id: string) => void;
}

/** Left rail, below the day list (BUILD §9): captures without a slot land
 * here (`pois`, status "idea"). Placing one reuses the phase 6.3 ranked
 * picker rather than a bespoke drop target — it's a capture like any other,
 * just one that already has a name and coordinates. */
export function WishlistPanel({ items, onAdd, onPlace, onReject }: Props) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Wishlist
        </span>
        <button
          onClick={onAdd}
          className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white"
        >
          + Idea
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-400">
            Nothing on the wishlist yet.
          </li>
        )}
        {items.map((item) => {
          const hasCoords = !!item.lat && !!item.lon;
          return (
            <li
              key={item.id}
              className="group flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2"
            >
              <button
                onClick={() => hasCoords && onPlace(item)}
                disabled={!hasCoords}
                title={
                  hasCoords
                    ? 'Place on the itinerary'
                    : 'No coordinates yet — edit it to add some'
                }
                className="min-w-0 flex-1 truncate text-left text-sm text-slate-900 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                {item.title}
                <span className="ml-1.5 text-xs text-slate-400">
                  {TAXONOMY[item.kind as Kind]?.label ?? item.kind}
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
