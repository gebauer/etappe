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
    <section className="mx-auto mt-10 flex w-full max-w-2xl flex-col gap-6">
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <label className="flex flex-col text-sm text-slate-600">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm text-slate-600">
          Start date
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          New trip
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="rounded border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
        >
          Import a trip
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showImport && (
        <ImportTripDialog
          onClose={() => setShowImport(false)}
          onImported={(tripId) => {
            setShowImport(false);
            onOpen(tripId);
          }}
        />
      )}

      <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {trips.length === 0 && (
          <li className="px-4 py-6 text-center text-slate-400">
            No trips yet.
          </li>
        )}
        {trips.map((trip) => (
          <li key={trip.id}>
            <button
              onClick={() => onOpen(trip.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{trip.title}</span>
              <span className="text-sm text-slate-500">
                {trip.start_date.slice(0, 10)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
