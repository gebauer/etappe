import { useState, type KeyboardEvent } from 'react';
import { formatDuration } from '../lib/format';
import { legDirectionsUrl } from '../lib/geo-links';
import type { LegsResponse, StopsResponse } from '../types/pb';
import type { LegPatch } from '../lib/pb-stops';

interface Props {
  leg?: LegsResponse;
  effectiveDuration?: number;
  onUpdate: (patch: LegPatch) => void;
  onReroute: () => void;
  onSetManual: (durationMin: number) => void;
  /** The stops this leg connects — for the "open in a routing app" link
   * (WORK 10.4). Routing follows the access point when one is set, since
   * that is what the cascade routes through. */
  from?: StopsResponse | null;
  to?: StopsResponse | null;
}

/** The point routing actually leaves from / arrives at: the access point
 * when set, otherwise the stop itself. */
function routingPoint(
  s: StopsResponse | null | undefined,
): { lat: number; lon: number } | null {
  if (!s) return null;
  if (s.access_lat && s.access_lon) {
    return { lat: s.access_lat, lon: s.access_lon };
  }
  if (s.lat && s.lon) return { lat: s.lat, lon: s.lon };
  return null;
}

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

const FIELD =
  'h-7 rounded-md border border-border-strong bg-field px-2 text-[11.5px] text-text outline-none focus:border-accent';

/**
 * The connector between two stops in the itinerary column (design handoff,
 * "Leg row"): a hairline and `18 min · 21 km`, nothing more.
 *
 * The handoff gives leg editing — manual duration, surface, buffer, re-route
 * — no home at all (the card is stop-only), so rather than drop working
 * capability those controls stay, revealed by clicking the row. Same
 * progressive-disclosure shape as the card's own edit region, and the
 * collapsed row still matches the spec.
 */
export function LegRow({
  leg,
  effectiveDuration,
  onUpdate,
  onReroute,
  onSetManual,
  from,
  to,
}: Props) {
  const [open, setOpen] = useState(false);
  const isCar = leg?.mode === 'car';
  const isManual = leg?.routing_source === 'manual';
  const km = leg?.distance_m ? Math.round(leg.distance_m / 1000) : null;

  const a = routingPoint(from);
  const b = routingPoint(to);
  const routeUrl = a && b ? legDirectionsUrl(a, b, leg?.mode) : null;

  return (
    <div className="py-[3px] pl-[22px] pr-3">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          title={leg ? 'Leg settings' : undefined}
          disabled={!leg}
          className="flex items-center gap-2 text-left"
        >
          <span className="h-4 w-px flex-none bg-[oklch(0.34_0.012_250)]" />
          <span className="font-mono text-[11px] text-text-5">
            {effectiveDuration != null
              ? formatDuration(effectiveDuration)
              : '—'}
            {km != null ? ` · ${km} km` : ''}
            {isManual ? ' · manual' : ''}
          </span>
        </button>
        {routeUrl && (
          <a
            href={routeUrl}
            target="_blank"
            rel="noreferrer"
            title="Open this leg in Google Maps"
            className="flex-none px-1 text-[11px] text-text-5 hover:text-accent"
          >
            ↗
          </a>
        )}
      </div>

      {open && leg && (
        <div className="ml-[9px] mt-1.5 flex flex-wrap items-center gap-2 border-l border-[oklch(0.34_0.012_250)] py-1 pl-3">
          {isManual ? (
            <label className="flex items-center gap-1 text-[11.5px] text-text-4">
              <input
                type="number"
                min={0}
                defaultValue={leg.duration_min || ''}
                placeholder="min"
                onBlur={(e) =>
                  onUpdate({ duration_min: Number(e.target.value) || 0 })
                }
                onKeyDown={commitOnEnter}
                className={`${FIELD} w-16 font-mono`}
              />
              min
            </label>
          ) : null}

          {isCar && (
            <>
              <button
                onClick={
                  isManual
                    ? onReroute
                    : () => onSetManual(effectiveDuration ?? 0)
                }
                className="h-7 rounded-md border border-border-strong px-2 text-[11.5px] text-text-2 hover:bg-control"
              >
                {isManual ? '⟳ route' : '✎ manual'}
              </button>
              <select
                defaultValue={leg.surface || ''}
                onChange={(e) =>
                  onUpdate({ surface: e.target.value as LegPatch['surface'] })
                }
                className={FIELD}
              >
                <option value="">surface…</option>
                <option value="paved">paved</option>
                <option value="gravel">gravel</option>
                <option value="froad">F-road</option>
              </select>
              <label className="flex items-center gap-1 text-[11.5px] text-text-4">
                buffer%
                <input
                  type="number"
                  defaultValue={leg.buffer_override_pct || ''}
                  onBlur={(e) =>
                    onUpdate({
                      buffer_override_pct: Number(e.target.value) || 0,
                    })
                  }
                  onKeyDown={commitOnEnter}
                  className={`${FIELD} w-14 font-mono`}
                />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}
