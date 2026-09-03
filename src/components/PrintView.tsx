import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { pb } from '../lib/pb';
import { blockFileUrl } from '../lib/pb-blocks';
import { asLineString } from '../lib/map-features';
import { renderDayMaps, type DayMapSpec } from '../lib/print-map';
import { formatClock, type CascadeResult } from '../lib/cascade';
import { formatDayDate, formatDuration } from '../lib/format';
import { warningText } from '../lib/warnings';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import type {
  BlocksResponse,
  DaysResponse,
  LegsResponse,
  StopsResponse,
  TripsResponse,
} from '../types/pb';

interface Props {
  trip: TripsResponse;
  days: DaysResponse[];
  stops: StopsResponse[];
  legs: LegsResponse[];
  blocks: BlocksResponse[];
  result: CascadeResult | null;
  /** Personal copies may include `private` blocks; the share context never
   * can (BUILD §10). When false, the checkbox is not even shown. */
  allowPrivate: boolean;
  onClose: () => void;
}

/**
 * The print view (WORK 9.3): a light, one-page-per-day document rendered
 * straight into `window.print()` — no server PDF, no headless Chrome. Each
 * day carries its stop timeline, a client-rendered static map, and its
 * public/trip (and optionally private) note, link and photo blocks with
 * Commons attribution.
 *
 * Portalled to `<body>` so the print stylesheet can hide the live app with
 * one `:not(.print-portal)` rule rather than threading a print class
 * through the whole tree.
 */
export function PrintView({
  trip,
  days,
  stops,
  legs,
  blocks,
  result,
  allowPrivate,
  onClose,
}: Props) {
  const [includePrivate, setIncludePrivate] = useState(allowPrivate);
  const [maps, setMaps] = useState<Record<string, string>>({});

  const ordered = useMemo(
    () => [...days].sort((a, b) => a.order_index - b.order_index),
    [days],
  );

  const dayStops = (dayId: string) =>
    stops
      .filter((s) => s.day === dayId)
      .sort((a, b) => a.order_index - b.order_index);

  // Build one map spec per day: its stops, its start point, and every routed
  // leg geometry (leading leg included).
  useEffect(() => {
    const specs: DayMapSpec[] = ordered.map((day) => {
      const ds = dayStops(day.id);
      const points: [number, number][] = ds
        .filter((s) => s.lat && s.lon)
        .map((s) => [s.lon, s.lat]);
      const startId = day.start_stop;
      const start = startId ? stops.find((s) => s.id === startId) : null;
      if (start?.lat && start?.lon) points.push([start.lon, start.lat]);

      const routes: number[][][] = [];
      for (let i = 0; i < ds.length - 1; i++) {
        const a = ds[i]!;
        const b = ds[i + 1]!;
        const leg = legs.find(
          (l) => l.from_stop === a.id && l.to_stop === b.id,
        );
        const line = asLineString(leg?.geometry);
        if (line) routes.push(line.coordinates);
        // A manual or unrouted leg still gets a straight connector so the
        // day's shape reads on the map.
        else if (a.lat && a.lon && b.lat && b.lon) {
          routes.push([
            [a.lon, a.lat],
            [b.lon, b.lat],
          ]);
        }
      }
      if (start && ds[0]) {
        const lead = legs.find(
          (l) => l.from_stop === start.id && l.to_stop === ds[0]!.id,
        );
        const line = asLineString(lead?.geometry);
        if (line) routes.push(line.coordinates);
        // Fall back to a straight connector so the start point is in frame
        // even on a manual/unrouted leading leg.
        else if (start.lat && start.lon && ds[0].lat && ds[0].lon) {
          routes.push([
            [start.lon, start.lat],
            [ds[0].lon, ds[0].lat],
          ]);
        }
      }
      return { dayId: day.id, points, routes };
    });

    const ctrl = new AbortController();
    void renderDayMaps(
      specs,
      (id, png) => setMaps((m) => ({ ...m, [id]: png })),
      ctrl.signal,
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.classList.add('printing');
    return () => document.body.classList.remove('printing');
  }, []);

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const span =
    first && last
      ? first === last
        ? formatDayDate(trip.start_date, first.order_index)
        : `${formatDayDate(trip.start_date, first.order_index)} – ${formatDayDate(
            trip.start_date,
            last.order_index,
          )}`
      : '';

  const visibleBlocks = (parentType: 'day' | 'stop', parentId: string) =>
    blocks
      .filter((b) => b.parent_type === parentType && b.parent_id === parentId)
      .filter((b) => includePrivate || b.visibility !== 'private')
      .sort(
        (a, b) =>
          (a.order_index ?? 0) - (b.order_index ?? 0) ||
          a.created.localeCompare(b.created),
      );

  const mapsDone = ordered.every((d) => d.id in maps);

  return createPortal(
    <div className="print-portal">
      <style>{PRINT_CSS}</style>

      <div className="no-print pv-toolbar">
        <button onClick={onClose} className="pv-btn pv-btn-ghost">
          ← Back
        </button>
        {allowPrivate && (
          <label className="pv-check">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(e) => setIncludePrivate(e.target.checked)}
            />
            Include private notes
          </label>
        )}
        <span className="pv-hint">
          {mapsDone ? 'Maps ready.' : 'Rendering day maps…'}
        </span>
        <button
          onClick={() => window.print()}
          disabled={!mapsDone}
          className="pv-btn pv-btn-primary"
        >
          Print
        </button>
      </div>

      <div className="pv-doc">
        <h1 className="pv-title">{trip.title}</h1>
        <p className="pv-sub">
          {ordered.length} {ordered.length === 1 ? 'day' : 'days'}
          {span ? ` · ${span}` : ''}
        </p>

        {ordered.map((day, i) => {
          const ds = dayStops(day.id);
          const dayResult = result?.days.find((d) => d.dayId === day.id);
          const timing = new Map(
            dayResult?.stops.map((t) => [t.stopId, t]) ?? [],
          );
          const dayWarnings = (result?.warnings ?? []).filter(
            (w) => w.dayId === day.id && !w.stopId,
          );
          const leadMin = dayResult?.leadingLeg?.effectiveDuration ?? 0;
          const startStop = day.start_stop
            ? stops.find((s) => s.id === day.start_stop)
            : null;
          const png = maps[day.id];

          return (
            <section key={day.id} className="pv-day">
              <h2 className="pv-day-h">
                <span>
                  Day {i + 1}
                  {day.title ? ` · ${day.title}` : ''}
                </span>
                <span className="pv-day-date">
                  {formatDayDate(trip.start_date, day.order_index)} · {day.kind}
                </span>
              </h2>

              {png === undefined ? (
                <div className="pv-map pv-map-empty">rendering…</div>
              ) : png === '' ? (
                <div className="pv-map pv-map-empty">
                  No located stops on this day.
                </div>
              ) : (
                <img className="pv-map" src={png} alt={`Day ${i + 1} map`} />
              )}

              {dayWarnings.map((w, wi) => (
                <p key={wi} className="pv-warn">
                  {warningText(w)}
                </p>
              ))}

              {startStop && (
                <p className="pv-lead">
                  Leaves from <strong>{startStop.title}</strong>
                  {leadMin ? ` — ${formatDuration(leadMin)} drive` : ''}
                </p>
              )}

              {ds.length === 0 ? (
                <p className="pv-empty">No stops on this day.</p>
              ) : (
                <ol className="pv-stops">
                  {ds.map((stop, si) => {
                    const t = timing.get(stop.id);
                    const next = ds[si + 1];
                    const legT = dayResult?.legs[si];
                    const stopWarnings = (result?.warnings ?? []).filter(
                      (w) => w.stopId === stop.id,
                    );
                    return (
                      <li key={stop.id} className="pv-stop">
                        <div className="pv-stop-row">
                          <span className="pv-seq">{si + 1}</span>
                          <span className="pv-stop-name">{stop.title}</span>
                          <span className="pv-stop-time">
                            {t
                              ? `${formatClock(t.arrival)}${
                                  t.departure !== t.arrival
                                    ? `–${formatClock(t.departure)}`
                                    : ''
                                }`
                              : ''}
                          </span>
                        </div>
                        <div className="pv-stop-meta">
                          {TAXONOMY[stop.kind as Kind]?.label ?? stop.kind}
                          {t?.dwell ? ` · ${formatDuration(t.dwell)}` : ''}
                          {stop.is_accommodation ? ' · overnight' : ''}
                        </div>
                        {stopWarnings.map((w, wi) => (
                          <div key={wi} className="pv-stop-warn">
                            {warningText(w)}
                          </div>
                        ))}
                        <PrintBlocks blocks={visibleBlocks('stop', stop.id)} />
                        {next && (
                          <div className="pv-leg">
                            ↓{' '}
                            {legT
                              ? formatDuration(legT.effectiveDuration)
                              : 'drive'}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              <PrintBlocks blocks={visibleBlocks('day', day.id)} />
            </section>
          );
        })}

        <p className="pv-foot">Made with Etappe.</p>
      </div>
    </div>,
    document.body,
  );
}

function PrintBlocks({ blocks }: { blocks: BlocksResponse[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="pv-blocks">
      {blocks.map((b) => {
        if (b.kind === 'note' && b.body?.trim()) {
          return (
            <p key={b.id} className="pv-note">
              {b.title?.trim() ? <strong>{b.title}: </strong> : null}
              {b.body}
            </p>
          );
        }
        if (b.kind === 'link' && b.url) {
          return (
            <p key={b.id} className="pv-link">
              {b.title?.trim() || 'Link'}: {b.url}
            </p>
          );
        }
        if (b.kind === 'photo') {
          const src = blockFileUrl(pb, b, '640x0');
          if (!src) return null;
          return (
            <figure key={b.id} className="pv-fig">
              <img src={src} alt={b.title ?? ''} />
              {(b.title?.trim() || b.attribution_author) && (
                <figcaption>
                  {b.title?.trim()}
                  {b.attribution_author
                    ? `${b.title?.trim() ? ' — ' : ''}© ${b.attribution_author}${
                        b.attribution_licence
                          ? ` (${b.attribution_licence})`
                          : ''
                      }`
                    : ''}
                </figcaption>
              )}
            </figure>
          );
        }
        return null;
      })}
    </div>
  );
}

const PRINT_CSS = `
.print-portal {
  position: fixed; inset: 0; z-index: 200; overflow: auto;
  background: #fff; color: #14171c;
  font-family: "Instrument Sans", system-ui, sans-serif;
}
.pv-toolbar {
  position: sticky; top: 0; display: flex; align-items: center; gap: 14px;
  padding: 10px 16px; border-bottom: 1px solid #d8dbe0; background: #f4f5f7;
}
.pv-btn { height: 32px; padding: 0 12px; border-radius: 8px; font-size: 13px; cursor: pointer; }
.pv-btn-ghost { border: 1px solid #c7cbd1; background: #fff; }
.pv-btn-primary { border: 0; background: #1f6feb; color: #fff; font-weight: 600; }
.pv-btn-primary:disabled { opacity: .45; cursor: default; }
.pv-check { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.pv-hint { margin-left: auto; font-size: 12px; color: #6b7280; }
.pv-doc { max-width: 720px; margin: 0 auto; padding: 28px 24px 60px; }
.pv-title { margin: 0; font-size: 26px; font-weight: 700; }
.pv-sub { margin: 4px 0 0; font-size: 13px; color: #6b7280; }
.pv-day { margin-top: 26px; }
.pv-day-h {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin: 0 0 8px; font-size: 17px; font-weight: 700;
  border-bottom: 2px solid #14171c; padding-bottom: 4px;
}
.pv-day-date { font-family: ui-monospace, monospace; font-size: 12px; color: #6b7280; font-weight: 400; }
.pv-map { width: 100%; height: 300px; object-fit: cover; border: 1px solid #d8dbe0; border-radius: 6px; }
.pv-map-empty { display: flex; align-items: center; justify-content: center; background: #f4f5f7; color: #9aa0a6; font-size: 12px; }
.pv-warn { margin: 8px 0 0; padding: 6px 10px; border: 1px solid #d9a441; background: #fdf3e2; border-radius: 6px; font-size: 12.5px; color: #8a5a12; }
.pv-lead { margin: 8px 0 0; font-size: 12.5px; color: #4b5563; }
.pv-empty { margin: 8px 0 0; font-size: 13px; color: #9aa0a6; }
.pv-stops { list-style: none; margin: 10px 0 0; padding: 0; }
.pv-stop { padding: 8px 0; border-top: 1px solid #e5e7eb; }
.pv-stop:first-child { border-top: 0; }
.pv-stop-row { display: flex; align-items: baseline; gap: 8px; }
.pv-seq { flex: none; width: 20px; height: 20px; border-radius: 50%; background: #14171c; color: #fff; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; }
.pv-stop-name { flex: 1; font-weight: 600; font-size: 14px; }
.pv-stop-time { flex: none; font-family: ui-monospace, monospace; font-size: 12px; color: #4b5563; }
.pv-stop-meta { margin-left: 28px; font-size: 11.5px; color: #6b7280; }
.pv-stop-warn { margin: 3px 0 0 28px; font-size: 11px; color: #8a5a12; }
.pv-leg { margin: 6px 0 0 28px; font-family: ui-monospace, monospace; font-size: 11px; color: #9aa0a6; }
.pv-blocks { margin: 6px 0 0 28px; }
.pv-note { margin: 4px 0 0; font-size: 12.5px; color: #1f2937; white-space: pre-wrap; }
.pv-link { margin: 4px 0 0; font-size: 11.5px; color: #1f6feb; word-break: break-all; }
.pv-fig { margin: 6px 0 0; }
.pv-fig img { max-width: 100%; max-height: 220px; border-radius: 4px; }
.pv-fig figcaption { font-size: 10.5px; color: #6b7280; margin-top: 2px; }
.pv-foot { margin-top: 40px; text-align: center; font-size: 11px; color: #9aa0a6; }

@media print {
  @page { margin: 14mm; }
  body.printing > *:not(.print-portal) { display: none !important; }
  .print-portal { position: static !important; overflow: visible !important; }
  .no-print { display: none !important; }
  .pv-doc { max-width: none; padding: 0; }
  .pv-day { break-inside: avoid; }
  .pv-day + .pv-day { break-before: page; }
  .pv-map { height: 260px; }
  a { color: inherit; text-decoration: none; }
}
`;
