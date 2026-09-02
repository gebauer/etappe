import { useState } from 'react';
import { parseTripDoc } from '../lib/import-trip-doc';
import type { ImportDoc } from '../lib/import-cascade';
import { TRIP_PROMPT_TEMPLATE } from '../lib/import-trip-prompt';
import {
  commitTripImport,
  abandonTripImport,
  type TripImportResult,
  type TripImportProgress,
} from '../lib/import-trip-commit';
import { createPocketBaseRouting } from '../lib/routing';
import { pb } from '../lib/pb';

interface Props {
  onClose: () => void;
  /** A trip now exists — open it. */
  onImported: (tripId: string) => void;
}

type Step =
  | { kind: 'paste'; errors?: string[] }
  | { kind: 'preview'; doc: ImportDoc }
  | { kind: 'importing'; progress: TripImportProgress | null }
  | { kind: 'done'; result: TripImportResult }
  | { kind: 'failed'; message: string };

/**
 * Import a whole trip document as a brand-new trip (BUILD §8, WORK 8.2) —
 * the counterpart to a Highlights import, which only ever adds to a
 * wishlist. Same paste → validate → preview → commit shape as
 * `HighlightsImportDialog`, and the same versioning: `parseTripDoc`
 * (WORK 16.3) reads whatever version the pasted document declares and
 * always hands back the current `ImportDoc` shape, so an export from an
 * older version of the app — or an older version of this format, once
 * there is one — still opens.
 *
 * Not built: geocoding with map confirmation and ambiguity flags (BUILD
 * §8.2's fuller vision). This resolves a `place_hint` to Photon's first
 * match silently, same simplification as the Highlights importer, for the
 * same reason — see `resolvePlaceHint`. A stop that comes out without
 * coordinates is named in the summary; its Latitude/Longitude can be set
 * by hand afterward in All details.
 */
export function ImportTripDialog({ onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'paste' });
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  function parse() {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      setStep({
        kind: 'paste',
        errors: [
          'Not valid JSON — check for a stray comma or missing bracket.',
        ],
      });
      return;
    }
    const result = parseTripDoc(raw);
    if (!result.ok) {
      setStep({ kind: 'paste', errors: result.errors });
      return;
    }
    setStep({ kind: 'preview', doc: result.doc });
  }

  async function commit(doc: ImportDoc, startDate: string) {
    setStep({ kind: 'importing', progress: null });
    const routing = createPocketBaseRouting(pb);
    let createdTripId: string | null = null;
    try {
      const result = await commitTripImport(
        pb,
        routing,
        doc,
        startDate,
        (progress) => setStep({ kind: 'importing', progress }),
      );
      createdTripId = result.trip.id;
      setStep({ kind: 'done', result });
    } catch (err) {
      // The cheap rollback described in import-trip-commit.ts: nothing
      // outside the trip references anything created here, so undoing it
      // is one delete rather than leaving a half-built trip in the list.
      if (createdTripId) {
        await abandonTripImport(pb, createdTripId).catch(() => {});
      }
      setStep({
        kind: 'failed',
        message: err instanceof Error ? err.message : 'Import failed.',
      });
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(TRIP_PROMPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the textarea below still has the text */
    }
  }

  const busy = step.kind === 'importing';

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-scrim pt-16 font-sans"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border-strong bg-surface-2 p-5 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text">Import a trip</h2>
          {!busy && (
            <button
              onClick={onClose}
              className="text-text-4 hover:text-text"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {step.kind === 'paste' && (
          <div className="space-y-3">
            <p className="text-[13px] text-text-2">
              Ask an LLM (in your own chat window) for a day-by-day itinerary,
              using the prompt below, then paste its JSON reply here. This
              creates a new trip — it doesn&rsquo;t touch any trip you already
              have.
            </p>
            <button
              onClick={copyPrompt}
              className="h-[30px] rounded-lg border border-border-strong px-2.5 text-[12px] text-text-2 hover:bg-control hover:text-text"
            >
              {copied ? 'Copied ✓' : '📋 Copy prompt'}
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder='{"version": 1, "title": "...", "days": [...]}'
              className="w-full rounded-lg border border-border-strong bg-field px-2.5 py-2 font-mono text-[12px] text-text outline-none placeholder:text-text-4 focus:border-accent"
            />
            {step.errors && step.errors.length > 0 && (
              <ul className="rounded-lg border border-danger-border bg-[oklch(0.26_0.03_25)] p-2.5 text-[12px] text-danger-text">
                {step.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="h-[34px] rounded-lg px-3 text-[13px] text-text-3 hover:text-text"
              >
                Cancel
              </button>
              <button
                onClick={parse}
                disabled={!text.trim()}
                className="h-[34px] rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent disabled:opacity-40"
              >
                Validate
              </button>
            </div>
          </div>
        )}

        {step.kind === 'preview' && (
          <TripPreview
            doc={step.doc}
            onBack={() => setStep({ kind: 'paste' })}
            onCommit={(startDate) => commit(step.doc, startDate)}
          />
        )}

        {step.kind === 'importing' && (
          <div className="space-y-2 py-6 text-center text-[13px] text-text-2">
            <p>
              {step.progress
                ? `Day ${step.progress.dayIndex + 1} of ${step.progress.totalDays} — ${
                    step.progress.phase === 'day'
                      ? 'creating the day'
                      : step.progress.phase === 'stop'
                        ? `placing "${step.progress.label}"`
                        : `routing ${step.progress.label}`
                  }…`
                : 'Starting…'}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-control">
              <div
                className="h-full bg-accent transition-all"
                style={{
                  width: step.progress
                    ? `${Math.round(((step.progress.dayIndex + 1) / step.progress.totalDays) * 100)}%`
                    : '5%',
                }}
              />
            </div>
          </div>
        )}

        {step.kind === 'failed' && (
          <div className="space-y-3">
            <p className="rounded-lg border border-danger-border bg-[oklch(0.26_0.03_25)] p-2.5 text-[13px] text-danger-text">
              {step.message}
            </p>
            <p className="text-[11.5px] text-text-4">
              Nothing was left behind — the partial trip was removed.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setStep({ kind: 'paste' })}
                className="h-[34px] rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="space-y-3">
            <p className="text-[13px] text-text-2">
              Created <strong>{step.result.daysCreated}</strong> day
              {step.result.daysCreated === 1 ? '' : 's'} and{' '}
              <strong>{step.result.stopsCreated}</strong> stop
              {step.result.stopsCreated === 1 ? '' : 's'}.{' '}
              {step.result.legsRouted} leg
              {step.result.legsRouted === 1 ? '' : 's'} routed
              {step.result.legsManual > 0
                ? `, ${step.result.legsManual} left manual`
                : ''}
              .
            </p>
            {step.result.unlocatedStops.length > 0 && (
              <div className="rounded-lg border border-warn-border bg-warn-bg p-2.5 text-[12px] text-warn-text">
                <strong>
                  {step.result.unlocatedStops.length} stop
                  {step.result.unlocatedStops.length === 1 ? '' : 's'}{' '}
                  couldn&rsquo;t be located.
                </strong>{' '}
                Open each from the day it&rsquo;s on and set its Latitude /
                Longitude in All details:
                <ul className="mt-1 list-disc pl-4">
                  {step.result.unlocatedStops.map((s, i) => (
                    <li key={i}>
                      {s.title} (day {s.dayIndex + 1})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => onImported(step.result.trip.id)}
                className="h-[34px] rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent"
              >
                Open the trip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TripPreview({
  doc,
  onBack,
  onCommit,
}: {
  doc: ImportDoc;
  onBack: () => void;
  onCommit: (startDate: string) => void;
}) {
  // The date is the importer's question, not the document's (WORK 18.7):
  // an itinerary is day numbers, so it travels without dates. A document
  // that happens to carry one presets the field; otherwise today does.
  const [startDate, setStartDate] = useState(
    doc.start_date ?? new Date().toISOString().slice(0, 10),
  );
  const stops = doc.days.flatMap((d) => d.stops);
  const legs = doc.days.flatMap((d) => d.legs);
  const uncategorized = stops.filter((s) => s.kind === 'uncategorized').length;
  const needsGeocode = stops.filter(
    (s) => s.lat === undefined && s.place_hint,
  ).length;
  const noLocationAtAll = stops.filter(
    (s) => s.lat === undefined && !s.place_hint,
  ).length;
  const carLegs = legs.filter((l) => l.mode === 'car').length;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text-2">
        <strong className="font-semibold text-text">{doc.title}</strong> —{' '}
        {doc.days.length} day{doc.days.length === 1 ? '' : 's'}, {stops.length}{' '}
        stop{stops.length === 1 ? '' : 's'}.
      </p>

      <label className="block rounded-lg border border-border-strong bg-surface-3 p-3">
        <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
          When does the trip start?
        </span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mt-1.5 h-[34px] w-full rounded-lg border border-border-strong bg-field px-2.5 font-mono text-[13px] text-text outline-none [color-scheme:dark] focus:border-accent"
        />
        <span className="mt-1.5 block text-[11.5px] leading-snug text-text-4">
          {doc.start_date
            ? `Preset from the document (${doc.start_date}). Days carry only their number, so change this freely.`
            : 'The document carried no date — days carry only their number. Every day’s date is derived from this one.'}
        </span>
      </label>

      <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border-strong text-[13px]">
        {doc.days.map((day) => (
          <li key={day.index} className="flex items-center gap-2 px-3 py-2">
            <span className="flex-none font-medium text-text">
              Day {day.index}
            </span>
            {day.title && (
              <span className="min-w-0 flex-1 truncate text-text-3">
                {day.title}
              </span>
            )}
            <span className="ml-auto flex-none text-[11.5px] text-text-4">
              {day.stops.length} stop{day.stops.length === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-1 text-[11.5px] text-text-4">
        {carLegs > 0 && (
          <p>
            {carLegs} car leg{carLegs === 1 ? '' : 's'} will be routed on import
            — this can take a moment for a long trip.
          </p>
        )}
        {needsGeocode > 0 && (
          <p className="text-warn-text">
            {needsGeocode} stop{needsGeocode === 1 ? '' : 's'} will be geocoded
            from its place hint — a rough estimate compared to named
            coordinates.
          </p>
        )}
        {noLocationAtAll > 0 && (
          <p className="text-warn-text">
            {noLocationAtAll} stop{noLocationAtAll === 1 ? '' : 's'} have
            neither coordinates nor a place hint and will need a location set by
            hand after importing.
          </p>
        )}
        {uncategorized > 0 && (
          <p>
            {uncategorized} stop{uncategorized === 1 ? '' : 's'} uncategorized —
            the existing review banner will pick these up once the trip is open.
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onBack}
          className="h-[34px] rounded-lg px-3 text-[13px] text-text-3 hover:text-text"
        >
          Back
        </button>
        <button
          onClick={() => onCommit(startDate)}
          disabled={!/^\d{4}-\d{2}-\d{2}$/.test(startDate)}
          className="h-[34px] rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent disabled:opacity-40"
        >
          Create trip
        </button>
      </div>
    </div>
  );
}
