import { useEffect, useRef, useState } from 'react';
import { photonSearch, type PlaceResult } from '../lib/photon';

interface Props {
  onPick: (place: PlaceResult) => void;
  onClose: () => void;
}

/** ⌘K place search: Photon typeahead. Picking a result adds a stop to the
 * focused day (BUILD §6). */
export function SearchPalette({ onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        setResults(await photonSearch(query, { signal: ctrl.signal }));
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
  }, [q]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Search places…"
          className="w-full border-b border-slate-200 px-4 py-3 text-sm focus:outline-none"
        />
        {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}
        <ul className="max-h-80 overflow-y-auto">
          {busy && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-400">Searching…</li>
          )}
          {!busy && q.trim() !== '' && results.length === 0 && !error && (
            <li className="px-4 py-3 text-sm text-slate-400">No results.</li>
          )}
          {results.map((place, i) => (
            <li key={i}>
              <button
                onClick={() => onPick(place)}
                className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="min-w-0 truncate font-medium text-slate-900">
                  {place.name}
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
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
