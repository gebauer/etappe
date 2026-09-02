import { useEffect, useMemo, useRef, useState } from 'react';
import { photonSearch, type PlaceResult } from '../lib/photon';
import { sniffPaste } from '../lib/paste-sniff';
import { resolveLink } from '../lib/pb-capture';
import { pb } from '../lib/pb';

interface Props {
  onPick: (place: PlaceResult, sourceUrl?: string) => void;
  onClose: () => void;
  /** Prefills the input — used by the share target and wishlist "+ Idea",
   * which arrive already holding a query rather than starting from empty. */
  initialQuery?: string;
}

function coordPlace(lat: number, lon: number): PlaceResult {
  return { name: 'Pasted location', lat, lon, kind: 'uncategorized' };
}

/** ⌘K capture: Photon typeahead for names, and a paste sniffer for pasted
 * coordinates / Google Maps or Komoot URLs (BUILD §6). */
export function SearchPalette({ onPick, onClose, initialQuery }: Props) {
  const [q, setQ] = useState(initialQuery ?? '');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sniff = useMemo(() => (q.trim() ? sniffPaste(q) : null), [q]);
  const isPaste = sniff !== null && sniff.kind !== 'address';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isPaste || !q.trim()) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        setResults(await photonSearch(q, { signal: ctrl.signal }));
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Search failed.');
        }
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, isPaste]);

  async function resolveShortlink(url: string) {
    setBusy(true);
    setError(null);
    try {
      const { lat, lon } = await resolveLink(pb, url);
      if (lat != null && lon != null) onPick(coordPlace(lat, lon), url);
      else setError('No coordinates found in that link.');
    } catch {
      setError('Could not resolve that link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-scrim pt-24 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border-strong bg-surface-2 text-text shadow-[0_24px_60px_oklch(0.10_0.01_250/0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Transparent on the panel, not an inner white field — the reported
            contrast failure was a light-grey placeholder on white, and the
            typed query must never read lighter than the placeholder. */}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Search a place, or paste coordinates / a Maps link…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-[16px] text-text placeholder:text-text-4 focus:outline-none"
        />
        {error && <p className="px-4 py-2 text-xs text-danger-text">{error}</p>}

        <ul className="max-h-80 overflow-y-auto">
          {sniff?.kind === 'coords' && (
            <PasteAction
              label={`📍 Add at ${sniff.lat.toFixed(5)}, ${sniff.lon.toFixed(5)}`}
              onClick={() => onPick(coordPlace(sniff.lat, sniff.lon))}
            />
          )}
          {sniff?.kind === 'mapUrl' && (
            <PasteAction
              label={`📍 Add from Google Maps (${sniff.lat.toFixed(4)}, ${sniff.lon.toFixed(4)})`}
              onClick={() =>
                onPick(coordPlace(sniff.lat, sniff.lon), sniff.url)
              }
            />
          )}
          {sniff?.kind === 'shortlink' && (
            <PasteAction
              label={busy ? 'Resolving link…' : '🔗 Resolve & add Google link'}
              onClick={() => resolveShortlink(sniff.url)}
            />
          )}
          {sniff?.kind === 'url' && (
            <li className="px-4 py-3 text-[13px] text-text-4">
              That link has no coordinates — paste a place name instead.
            </li>
          )}

          {!isPaste && busy && results.length === 0 && (
            <li className="px-4 py-3 text-[13px] text-text-4">Searching…</li>
          )}
          {!isPaste &&
            !busy &&
            q.trim() !== '' &&
            results.length === 0 &&
            !error && (
              <li className="px-4 py-3 text-[13px] text-text-4">No results.</li>
            )}
          {!isPaste &&
            results.map((place, i) => (
              <li key={i}>
                {/* The 2px accent left edge marks keyboard position without
                    relying on the hover background alone. */}
                <button
                  onClick={() => onPick(place)}
                  className="flex h-11 w-full items-center justify-between gap-2 border-l-2 border-transparent px-4 text-left text-text-2 outline-none hover:bg-control hover:text-text focus-visible:border-accent focus-visible:bg-control focus-visible:text-text"
                >
                  <span className="min-w-0 truncate text-[15px] font-medium">
                    {place.name}
                  </span>
                  <span className="shrink-0 rounded-md bg-field px-2 py-0.5 text-[11px] text-text-4">
                    {place.kind}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function PasteAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full border-l-2 border-transparent px-4 py-3 text-left text-[13.5px] font-medium text-accent outline-none hover:bg-control focus-visible:border-accent focus-visible:bg-control"
      >
        {label}
      </button>
    </li>
  );
}
