import { useEffect, useState } from 'react';
import { cascade, formatClock } from '../lib/cascade';
import { createSunCalcDaylight } from '../lib/daylight';
import { warningText } from '../lib/warnings';
import { formatDuration, formatDayDate } from '../lib/format';
import {
  shareToCascade,
  type ShareDoc,
  type ShareBlock,
} from '../lib/share-doc';

const API_BASE = ''; // same origin — PocketBase serves the SPA (CLAUDE.md).

/**
 * The public, unauthenticated view of a shared trip (WORK 9.2 / 16.6).
 *
 * Reads `/api/share/{token}` — the server has already dropped anything not
 * marked `visibility: public` (CLAUDE.md rule 5). This component trusts what
 * it receives; it does no further filtering, because a second filter here
 * would be exactly the "call it done" the rule warns against — the only
 * enforcement that matters already happened server-side.
 *
 * Runs the same `cascade()` the editor does, per rule 3, so a share never
 * shows a time the owner's own view wouldn't.
 */
export function ShareView({ token }: { token: string }) {
  const [doc, setDoc] = useState<ShareDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/share/${token}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(res.status === 404 ? 'not-found' : 'error');
        return res.json();
      })
      .then((data: ShareDoc) => {
        if (!cancelled) setDoc(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg px-4 text-center font-sans">
        <p className="text-text-3">
          This link isn&rsquo;t shared, or the trip owner turned sharing off.
        </p>
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg font-sans">
        <p className="text-text-4">Loading…</p>
      </div>
    );
  }

  const result = cascade(
    shareToCascade(doc),
    createSunCalcDaylight(doc.trip.timezone),
  );

  return (
    <div className="min-h-screen bg-bg font-sans text-text">
      <header className="border-b border-border bg-surface-2 px-5 py-4">
        <h1 className="text-xl font-semibold">{doc.trip.title}</h1>
        <p className="text-[13px] text-text-4">
          Shared read-only from Etappe — nothing here can be edited.
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {doc.days.map((day, i) => {
          const dayResult = result.days.find((d) => d.dayId === day.id);
          const dayWarnings = result.warnings.filter(
            (w) => w.dayId === day.id && !w.stopId,
          );
          return (
            <section key={day.id} className="mb-8">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold">
                  Day {i + 1}
                  {day.title ? ` · ${day.title}` : ''}
                </h2>
                <span className="font-mono text-xs text-text-4">
                  {formatDayDate(doc.trip.start_date, day.order_index)}
                </span>
              </div>

              {dayWarnings.map((w, wi) => (
                <p
                  key={wi}
                  className="mb-2 rounded-lg border border-warn-border bg-warn-bg px-3 py-1.5 text-xs text-warn-text"
                >
                  {warningText(w)}
                </p>
              ))}

              <ol className="divide-y divide-border rounded-xl border border-border-strong bg-surface-2">
                {day.stops.map((stop, si) => {
                  const timing = dayResult?.stops.find(
                    (t) => t.stopId === stop.id,
                  );
                  return (
                    <li key={stop.id} className="flex gap-3 px-4 py-3">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-control text-xs font-medium text-text-2">
                        {si + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">
                            {stop.title}
                          </span>
                          {timing && (
                            <span className="flex-none font-mono text-xs text-text-4">
                              {formatClock(timing.arrival)}–
                              {formatClock(timing.departure)}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-text-4">
                          {stop.kind}
                          {timing ? ` · ${formatDuration(timing.dwell)}` : ''}
                          {stop.is_accommodation ? ' · overnight' : ''}
                        </div>
                        {publicBlocksOf(stop.blocks)}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {publicBlocksOf(day.blocks)}
            </section>
          );
        })}

        <footer className="mt-10 text-center text-xs text-text-4">
          Made with Etappe.
        </footer>
      </main>
    </div>
  );
}

function publicBlocksOf(blocks: ShareBlock[]) {
  if (blocks.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {blocks.map((b) => {
        if (b.kind === 'link' && b.url) {
          return (
            <a
              key={b.id}
              href={b.url}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-accent underline"
            >
              {b.title?.trim() || b.url}
            </a>
          );
        }
        if (b.kind === 'photo' && b.file) {
          return (
            <img
              key={b.id}
              src={b.file}
              alt={b.title ?? ''}
              className="mt-1 max-h-40 rounded-lg"
            />
          );
        }
        if (b.kind === 'note' && b.body) {
          return (
            <p key={b.id} className="text-xs text-text-2">
              {b.body}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
