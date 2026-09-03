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
      className="fixed inset-0 z-30 flex items-start justify-center bg-scrim pt-24 font-sans"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border-strong bg-surface-2 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <p className="truncate text-[13px] font-medium text-text">
            Place &ldquo;{candidate.name}&rdquo;
          </p>
          <p className="text-xs text-text-4">
            Ranked by added drive time — pick a row, or Escape to cancel.
          </p>
        </div>

        {options === null ? (
          <p className="px-4 py-6 text-center text-[13px] text-text-4">
            Routing every gap…
          </p>
        ) : options.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-text-4">
            No days to place it in yet — add a day first.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {options.map((o, i) => (
              <li key={i}>
                <button
                  onClick={() => onPick(o)}
                  className="flex w-full items-center justify-between gap-3 border-l-2 border-transparent px-4 py-2.5 text-left text-[13px] hover:bg-control focus-visible:border-accent focus-visible:bg-control"
                >
                  <span className="min-w-0 truncate text-text-2">
                    Day {o.dayIndex + 1} · {describeGap(o)}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      o.addedMin == null
                        ? 'bg-field text-text-4'
                        : 'bg-accent-surface text-accent'
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

        <div className="border-t border-border px-4 py-2 text-right">
          <button
            onClick={onCancel}
            className="text-xs text-text-4 hover:text-text-2 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
