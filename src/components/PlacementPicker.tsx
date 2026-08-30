import { useEffect, useState } from 'react';
import {
  rankPlacements,
  describeGap,
  type PlacementOption,
} from '../lib/placement';
import { formatDuration } from '../lib/format';
import type { TripRecords } from '../lib/pb-trip-doc';
import type { RoutingProvider } from '../lib/routing';

export interface PlacementCandidate {
  name: string;
  lat: number;
  lon: number;
}

interface Props {
  candidate: PlacementCandidate;
  records: TripRecords;
  provider: RoutingProvider;
  onPick: (option: PlacementOption) => void;
  onCancel: () => void;
}

/** WORK 6.3 / BUILD §6: "rather than asking which slot, route the candidate
 * into every gap in the day[s] and rank by added time." Ranks once against
 * the trip as captured at open time — a background reload mid-pick (e.g.
 * from an unrelated edit) shouldn't restart the routing pass underneath the
 * user. */
export function PlacementPicker({
  candidate,
  records,
  provider,
  onPick,
  onCancel,
}: Props) {
  const [options, setOptions] = useState<PlacementOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    rankPlacements(
      records,
      { lat: candidate.lat, lon: candidate.lon },
      provider,
    ).then((opts) => {
      if (!cancelled) setOptions(opts);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 pt-24"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="truncate text-sm font-medium text-slate-900">
            Place &ldquo;{candidate.name}&rdquo;
          </p>
          <p className="text-xs text-slate-500">
            Ranked by added drive time — pick a row, or Escape to cancel.
          </p>
        </div>

        {options === null ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            Routing every gap…
          </p>
        ) : options.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            No days to place it in yet — add a day first.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {options.map((o, i) => (
              <li key={i}>
                <button
                  onClick={() => onPick(o)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate text-slate-700">
                    Day {o.dayIndex + 1} · {describeGap(o)}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                      o.addedMin == null
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {o.addedMin == null
                      ? 'no route'
                      : `+${formatDuration(Math.max(0, o.addedMin))}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-200 px-4 py-2 text-right">
          <button
            onClick={onCancel}
            className="text-xs text-slate-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
