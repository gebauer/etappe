import type { StopsResponse } from '../types/pb';
import type { Kind } from '../lib/taxonomy';
import { Drawer } from './Drawer';
import { KindPicker } from './KindPicker';

interface Props {
  stops: StopsResponse[];
  onUpdateKind: (stopId: string, kind: Kind) => void;
  onSelectStop: (stopId: string) => void;
  onClose: () => void;
}

/** BUILD §7: "the trip header shows an uncategorized counter; clicking it
 * opens a list of just those stops with the icon grid inline, so twenty get
 * cleared in a couple of minutes." Every row's grid is already expanded —
 * no click-to-open step, since being on this list means every row needs a
 * kind. A row drops off the list on its own once its kind changes: `stops`
 * is the live uncategorized filter from the caller, not a snapshot. */
export function UncategorizedReview({
  stops,
  onUpdateKind,
  onSelectStop,
  onClose,
}: Props) {
  return (
    <Drawer side="right" width="w-96" onClose={onClose}>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          {stops.length} uncategorized
        </h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {stops.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-400">
            All caught up.
          </li>
        )}
        {stops.map((stop) => (
          <li key={stop.id} className="p-3">
            <button
              onClick={() => onSelectStop(stop.id)}
              title="Select this stop"
              className="mb-2 block max-w-full truncate text-left text-sm font-medium text-slate-900 hover:underline"
            >
              {stop.title}
            </button>
            <KindPicker
              value={stop.kind as Kind}
              onChange={(kind) => onUpdateKind(stop.id, kind)}
            />
          </li>
        ))}
      </ul>
    </Drawer>
  );
}
