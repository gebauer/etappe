import { useEffect, useState, type FormEvent } from 'react';
import { listMyTrips, createTrip } from '../lib/pb-trips';
import { isAbortError } from '../lib/pb';
import type { TripsResponse } from '../types/pb';
import { ImportTripDialog } from './ImportTripDialog';

export function TripList({ onOpen }: { onOpen: (id: string) => void }) {
  const [trips, setTrips] = useState<TripsResponse[]>([]);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);

  async function refresh() {
    try {
      setTrips(await listMyTrips());
    } catch (err) {
      if (isAbortError(err)) return; // benign under StrictMode double-render
      setError(err instanceof Error ? err.message : 'Failed to load trips.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTrip({ title, start_date: startDate });
      setTitle('');
      setStartDate('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto mt-10 flex w-full max-w-2xl flex-col gap-6 font-sans text-text">
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border-strong bg-surface-2 p-4"
      >
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.08em] text-text-4">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-[38px] rounded-lg border border-border-strong bg-field px-3 text-[13px] text-text outline-none [color-scheme:dark] focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.08em] text-text-4">
          Start date
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-[38px] rounded-lg border border-border-strong bg-field px-3 text-[13px] text-text outline-none [color-scheme:dark] focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-[38px] rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent disabled:opacity-50"
        >
          New trip
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="h-[38px] rounded-lg border border-border-strong px-3 text-[13px] font-medium text-text-2 hover:bg-control hover:text-text"
        >
          Import a trip
        </button>
      </form>

      {error && <p className="text-[13px] text-danger-text">{error}</p>}

      {showImport && (
        <ImportTripDialog
          onClose={() => setShowImport(false)}
          onImported={(tripId) => {
            setShowImport(false);
            onOpen(tripId);
          }}
        />
      )}

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border-strong bg-surface-2">
        {trips.length === 0 && (
          <li className="px-4 py-6 text-center text-[13px] text-text-4">
            No trips yet.
          </li>
        )}
        {trips.map((trip) => (
          <li key={trip.id}>
            <button
              onClick={() => onOpen(trip.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-control"
            >
              <span className="font-medium text-text">{trip.title}</span>
              <span className="font-mono text-[12px] text-text-4">
                {trip.start_date.slice(0, 10)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
