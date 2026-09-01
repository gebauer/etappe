import { useState } from 'react';
import {
  parseHighlightsDoc,
  type HighlightsDoc,
} from '../lib/import-highlights';
import { HIGHLIGHTS_PROMPT_TEMPLATE } from '../lib/import-highlights-prompt';
import {
  importHighlights,
  type HighlightImportResult,
  type HighlightDecision,
} from '../lib/import-highlights-commit';
import {
  findDuplicate,
  type DuplicateDecision,
  type DuplicateMatch,
  type ExistingPlace,
} from '../lib/import-dedupe';
import type { BlocksResponse } from '../types/pb';
import { pb } from '../lib/pb';
import { TAXONOMY, type Kind } from '../lib/taxonomy';

interface Props {
  tripId: string;
  /** Everything already in this trip — wishlist and itinerary alike — so an
   * incoming highlight can be recognised as one of them (WORK 16.4). */
  existing: ExistingPlace[];
  blocks: BlocksResponse[];
  onClose: () => void;
  onImported: () => void;
}

type Step =
  | { kind: 'paste' }
  | { kind: 'paste'; errors: string[] }
  | {
      kind: 'preview';
      doc: HighlightsDoc;
      /** Index → the record this highlight looks like a second copy of. */
      matches: Map<number, DuplicateMatch>;
    }
  | { kind: 'importing'; total: number; done: number; current: string }
  | { kind: 'done'; results: HighlightImportResult[] };

/** Paste → validate → preview → commit (BUILD §8's wizard shape, applied to
 * the lighter Highlights format): pasting an LLM-produced list of POIs lands
 * them in the wishlist as ideas, each with its description/links/photos as
 * blocks. Never touches days/stops/legs. */
export function HighlightsImportDialog({
  tripId,
  existing,
  blocks,
  onClose,
  onImported,
}: Props) {
  const [step, setStep] = useState<Step>({ kind: 'paste' });
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  // What to do with each flagged row. Merge is the default: it is the only
  // one of the three that cannot lose anything.
  const [decisions, setDecisions] = useState<Map<number, DuplicateDecision>>(
    new Map(),
  );

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
    const result = parseHighlightsDoc(raw);
    if (!result.ok) {
      setStep({ kind: 'paste', errors: result.errors });
      return;
    }
    const matches = new Map<number, DuplicateMatch>();
    result.doc.highlights.forEach((h, i) => {
      const match = findDuplicate(h, existing);
      if (match) matches.set(i, match);
    });
    setDecisions(new Map([...matches.keys()].map((i) => [i, 'merge'])));
    setStep({ kind: 'preview', doc: result.doc, matches });
  }

  async function commit(
    doc: HighlightsDoc,
    matches: Map<number, DuplicateMatch>,
  ) {
    setStep({
      kind: 'importing',
      total: doc.highlights.length,
      done: 0,
      current: '',
    });
    try {
      const instructions = new Map<number, HighlightDecision>();
      for (const [index, match] of matches) {
        instructions.set(index, {
          decision: decisions.get(index) ?? 'merge',
          existing: match.existing,
          existingBlocks: blocks.filter(
            (b) => b.parent_id === match.existing.id,
          ),
        });
      }
      const results = await importHighlights(
        pb,
        tripId,
        doc,
        (done, total, current) =>
          setStep({ kind: 'importing', total, done, current }),
        instructions,
      );
      setStep({ kind: 'done', results });
      onImported();
    } catch (err) {
      setStep({
        kind: 'paste',
        errors: [err instanceof Error ? err.message : 'Import failed.'],
      });
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(HIGHLIGHTS_PROMPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the textarea below still has the text */
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 pt-16"
      onClick={step.kind === 'importing' ? undefined : onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 text-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Import highlights
          </h2>
          {step.kind !== 'importing' && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {step.kind === 'paste' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Ask an LLM (in your own chat window) for a shortlist of places,
              using the prompt below, then paste its JSON reply here.
            </p>
            <button
              onClick={copyPrompt}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              {copied ? 'Copied ✓' : '📋 Copy prompt'}
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder='{"version": 1, "highlights": [...]}'
              className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs placeholder:text-slate-400"
            />
            {'errors' in step && step.errors.length > 0 && (
              <ul className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {step.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded px-3 py-1.5 text-sm text-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={parse}
                disabled={!text.trim()}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Validate
              </button>
            </div>
          </div>
        )}

        {step.kind === 'preview' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {step.doc.highlights.length} highlight
              {step.doc.highlights.length === 1 ? '' : 's'} ready to import as
              wishlist ideas.
            </p>
            {step.matches.size > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                <strong>
                  {step.matches.size} of {step.doc.highlights.length} are
                  already in this trip.
                </strong>{' '}
                Merge fills only what is missing and adds any new notes, links
                and photos. Replace overwrites the text but keeps the record —
                so a placement or a star survives.
                <span className="mt-1.5 flex items-center gap-1.5">
                  Apply to all:
                  {(['merge', 'replace', 'add'] as DuplicateDecision[]).map(
                    (d) => (
                      <button
                        key={d}
                        onClick={() =>
                          setDecisions(
                            new Map(
                              [...step.matches.keys()].map((i) => [i, d]),
                            ),
                          )
                        }
                        className="rounded border border-amber-300 bg-white px-1.5 py-0.5 capitalize hover:bg-amber-100"
                      >
                        {d === 'add' ? 'add anyway' : d}
                      </button>
                    ),
                  )}
                </span>
              </div>
            )}
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
              {step.doc.highlights.map((h, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-slate-900">
                    {h.title}
                  </span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {TAXONOMY[h.kind as Kind]?.label ?? h.kind}
                  </span>
                  {h.lat === undefined && (
                    <span
                      className="shrink-0 text-xs text-amber-600"
                      title={
                        h.place_hint
                          ? 'Will be geocoded on import'
                          : 'No place_hint — will need coordinates set by hand'
                      }
                    >
                      {h.place_hint ? '📍 geocode' : '⚠ no location'}
                    </span>
                  )}
                  {h.photos.length > 0 && (
                    <span className="shrink-0 text-xs text-slate-400">
                      🖼 {h.photos.length}
                    </span>
                  )}
                  {step.matches.get(i) && (
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className="text-xs text-amber-700"
                        title={
                          step.matches.get(i)!.reason === 'distance'
                            ? `${Math.round(step.matches.get(i)!.distanceM ?? 0)} m from "${step.matches.get(i)!.existing.title}" ${step.matches.get(i)!.existing.where}`
                            : `Same name as "${step.matches.get(i)!.existing.title}" ${step.matches.get(i)!.existing.where}`
                        }
                      >
                        already {step.matches.get(i)!.existing.where}
                      </span>
                      {(['merge', 'replace', 'add'] as DuplicateDecision[]).map(
                        (d) => (
                          <button
                            key={d}
                            onClick={() =>
                              setDecisions(new Map(decisions).set(i, d))
                            }
                            className={`rounded px-1.5 py-0.5 text-[11px] capitalize ${
                              (decisions.get(i) ?? 'merge') === d
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {d}
                          </button>
                        ),
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStep({ kind: 'paste' })}
                className="rounded px-3 py-1.5 text-sm text-slate-500"
              >
                Back
              </button>
              <button
                onClick={() => commit(step.doc, step.matches)}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                Import {step.doc.highlights.length}
              </button>
            </div>
          </div>
        )}

        {step.kind === 'importing' && (
          <div className="space-y-2 py-6 text-center text-sm text-slate-600">
            <p>
              Importing {step.done}/{step.total}
              {step.current ? ` — ${step.current}` : ''}…
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-slate-900 transition-all"
                style={{
                  width: `${step.total ? (step.done / step.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Imported {step.results.length} highlight
              {step.results.length === 1 ? '' : 's'} to the wishlist.
              {step.results.some((r) => r.photosFailed > 0) && (
                <span className="mt-1 block text-amber-700">
                  {step.results.reduce((n, r) => n + r.photosFailed, 0)} photo
                  {step.results.reduce((n, r) => n + r.photosFailed, 0) === 1
                    ? ''
                    : 's'}{' '}
                  couldn't be downloaded — they still show, but won't appear on
                  map pins.
                </span>
              )}
              {step.results.some((r) => !r.located) && (
                <span className="mt-2 block rounded border border-amber-300 bg-amber-50 p-2 text-amber-800">
                  <strong>
                    {step.results.filter((r) => !r.located).length} of{' '}
                    {step.results.length} have no location.
                  </strong>{' '}
                  A place hint like &ldquo;X, near Y, Region&rdquo; often finds
                  nothing — the name on its own usually does better. These are
                  on the wishlist with their notes and links, but they have no
                  map pin and can&rsquo;t be added to a day until they have one:
                  open each from the wishlist and use{' '}
                  <em>Set location on the map</em>.
                  <span className="mt-1 block">
                    {step.results
                      .filter((r) => !r.located)
                      .map((r) => r.title)
                      .join(', ')}
                  </span>
                </span>
              )}
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
