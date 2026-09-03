import { useState, type KeyboardEvent } from 'react';
import { formatDuration } from '../lib/format';
import { legUrl, type LinkOut } from '../lib/geo-links';
import { BACKEND_LABEL, isRoutingBackend, routingPoint } from '../lib/routing';
import { parseBufferOverride } from '../lib/leg-buffer';
import type { LegTiming } from '../lib/cascade';
import type { LegsResponse, StopsResponse } from '../types/pb';
import type { LegPatch } from '../lib/pb-stops';

interface Props {
  leg?: LegsResponse;
  /** The cascade's split of this leg: routed (or overridden) base, buffer,
   * total. Split so the row can show the arithmetic (WORK 19.5). */
  timing?: LegTiming;
  /** The trip's `car_buffer_pct`, for the buffer field's placeholder — what
   * you get if you leave it empty. */
  tripBufferPct: number;
  onUpdate: (patch: LegPatch) => void;
  onReroute: () => void;
  /** Minutes, or 0 to drop the override and go back to the engine. */
  onSetDuration: (durationMin: number) => void;
  /** The stops this leg connects — for the "open in a routing app" link
   * (WORK 10.4). Routing follows the access point when one is set, since
   * that is what the cascade routes through. */
  from?: StopsResponse | null;
  to?: StopsResponse | null;
  /** Which map app the ↗ opens, and a one-time-hint callback (WORK 19.4). */
  linkOut?: LinkOut;
  onLinkOut?: () => void;
}

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

const FIELD =
  'h-7 rounded-md border border-border-strong bg-field px-2 text-[11.5px] text-text outline-none focus:border-accent';

const BADGE =
  'rounded-[5px] border px-1 py-px text-[10px] font-medium leading-[14px]';

/**
 * The connector between two stops in the itinerary column (design handoff,
 * "Leg row"): a hairline and `18 min · 21 km`, nothing more.
 *
 * The handoff gives leg editing — duration, surface, buffer, re-route — no
 * home at all (the card is stop-only), so rather than drop working
 * capability those controls stay, revealed by clicking the row. Same
 * progressive-disclosure shape as the card's own edit region, and the
 * collapsed row still matches the spec.
 *
 * The collapsed row shows the buffer as arithmetic — `2h19 + 7 = 2h26` —
 * rather than one total (WORK 19.5). The routed time is worth trusting now
 * that a real engine produces it; the padding on top is a planning choice,
 * and folding the two into one number made them impossible to tell apart.
 */
export function LegRow({
  leg,
  timing,
  tripBufferPct,
  onUpdate,
  onReroute,
  onSetDuration,
  from,
  to,
  linkOut = 'google',
  onLinkOut,
}: Props) {
  const [open, setOpen] = useState(false);
  const [bufferText, setBufferText] = useState(leg?.buffer_override ?? '');
  const isCar = leg?.mode === 'car';
  // `manual` is a leg that was never routed — no road near a trailhead, or a
  // ferry. Distinct from an overridden duration, which keeps its route.
  const unrouted = leg?.routing_source === 'manual';
  const km = leg?.distance_m ? Math.round(leg.distance_m / 1000) : null;
  const overridden = timing?.overridden ?? false;

  // What the engine itself said, and which engine (WORK 19.6). Always on
  // screen rather than behind a click: the point of the whole 19.x thread
  // was that the routed number needed checking against reality, and an
  // override otherwise hides it completely.
  const engine = isRoutingBackend(leg?.routing_source)
    ? BACKEND_LABEL[leg.routing_source]
    : null;
  const bufferBad = parseBufferOverride(bufferText) === 'invalid';

  const a = routingPoint(from);
  const b = routingPoint(to);
  const routeHref = a && b ? legUrl(linkOut, a, b, leg?.mode) : null;

  return (
    <div className="py-[3px] pl-[22px] pr-3">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          title={leg ? 'Leg settings' : undefined}
          disabled={!leg}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <span className="h-4 w-px flex-none bg-[oklch(0.34_0.012_250)]" />
          <span className="truncate font-mono text-[11px] text-text-5">
            {timing ? (
              timing.bufferMin > 0 ? (
                <>
                  {formatDuration(timing.baseDuration)}
                  <span className="text-text-4"> + {timing.bufferMin} = </span>
                  <span className="text-text-3">
                    {formatDuration(timing.effectiveDuration)}
                  </span>
                </>
              ) : (
                formatDuration(timing.effectiveDuration)
              )
            ) : (
              '—'
            )}
            {km != null ? ` · ${km} km` : ''}
          </span>
        </button>
        {engine && leg && (
          <span
            title={`Raw answer from the ${engine} routing API, before any buffer or override`}
            className="flex-none truncate font-mono text-[10.5px] text-text-5 opacity-70"
          >
            {engine} API: {formatDuration(leg.duration_min)}
          </span>
        )}
        {overridden && (
          <span
            title="Time set by hand — the routed road is kept"
            className={`${BADGE} flex-none border-warn-border bg-warn-bg text-warn-text`}
          >
            set
          </span>
        )}
        {unrouted && (
          <span
            title="Not routed — no road found, or a mode the router doesn't handle"
            className={`${BADGE} flex-none border-border-strong text-text-5`}
          >
            unrouted
          </span>
        )}
        {routeHref && (
          <a
            href={routeHref}
            onClick={onLinkOut}
            target="_blank"
            rel="noreferrer"
            title="Open this leg in your map app"
            className="flex-none px-1 text-[11px] text-text-5 hover:text-accent"
          >
            ↗
          </a>
        )}
      </div>

      {open && leg && (
        <div className="ml-[9px] mt-1.5 flex flex-wrap items-center gap-2 border-l border-[oklch(0.34_0.012_250)] py-1 pl-3">
          {isCar ? (
            <>
              <label
                className="flex items-center gap-1 text-[11.5px] text-text-4"
                title={
                  unrouted
                    ? 'How long this leg takes. Nothing routed it, so this is the only number there is.'
                    : `How long this leg takes. Overrides the engine and keeps the road; empty means the routed ${formatDuration(
                        leg.duration_min,
                      )}.`
                }
              >
                takes
                <input
                  type="number"
                  min={0}
                  defaultValue={leg.duration_override_min || ''}
                  placeholder={
                    leg.duration_min ? String(leg.duration_min) : 'min'
                  }
                  onBlur={(e) => onSetDuration(Number(e.target.value) || 0)}
                  onKeyDown={commitOnEnter}
                  className={`${FIELD} w-16 font-mono ${
                    overridden ? 'border-warn-border' : ''
                  }`}
                />
                min
              </label>

              <label
                className="flex items-center gap-1 text-[11.5px] text-text-4"
                title="Extra time on top. A bare number is minutes; add % for a percentage of the leg. Empty uses the trip default."
              >
                buffer
                <input
                  type="text"
                  value={bufferText}
                  placeholder={`${tripBufferPct}%`}
                  onChange={(e) => setBufferText(e.target.value)}
                  onBlur={() => {
                    if (bufferBad) {
                      setBufferText(leg.buffer_override ?? '');
                      return;
                    }
                    onUpdate({ buffer_override: bufferText.trim() });
                  }}
                  onKeyDown={commitOnEnter}
                  className={`${FIELD} w-16 font-mono ${
                    bufferBad ? 'border-danger-border' : ''
                  }`}
                />
              </label>

              {overridden && (
                <button
                  onClick={() => onSetDuration(0)}
                  title={`Back to the routed ${formatDuration(leg.duration_min)}`}
                  className="h-7 rounded-md border border-border-strong px-2 text-[11.5px] text-text-2 hover:bg-control"
                >
                  ↩ routed
                </button>
              )}
              {unrouted && (
                <button
                  onClick={onReroute}
                  className="h-7 rounded-md border border-border-strong px-2 text-[11.5px] text-text-2 hover:bg-control"
                >
                  ⟳ route
                </button>
              )}

              <select
                defaultValue={leg.surface || ''}
                onChange={(e) =>
                  onUpdate({ surface: e.target.value as LegPatch['surface'] })
                }
                title="Recorded for the F-road season warning. It no longer scales the time — the routing engine already knows what the road is."
                className={FIELD}
              >
                <option value="">surface…</option>
                <option value="paved">paved</option>
                <option value="gravel">gravel</option>
                <option value="froad">F-road</option>
              </select>
            </>
          ) : (
            <span className="text-[11.5px] text-text-4">
              A {leg.mode} leg carries a typed duration and takes no buffer.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
