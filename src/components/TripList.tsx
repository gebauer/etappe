import { useEffect, useState, type FormEvent } from 'react';
import { createTrip } from '../lib/pb-trips';
import { pb, isAbortError } from '../lib/pb';
import { loadTripCards, type TripCard } from '../lib/trip-card';
import { TripCardView } from './TripCard';
import { ImportTripDialog } from './ImportTripDialog';

/**
 * The screen after sign-in (WORK 21 / handoff "Trip selection"). Each trip is
 * a photo card, not a row; `New trip` and `Import` live in the header and the
 * title/date form opens on demand rather than being the resting state.
 */
export function TripList({ onOpen }: { onOpen: (id: string) => void }) {
  const [cards, setCards] = useState<TripCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setCards(await loadTripCards(pb));
    } catch (err) {
      if (isAbortError(err)) return;
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
      setShowNew(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip.');
    } finally {
      setBusy(false);
    }
  }

  const upcoming = (cards ?? []).filter(
    (c) => c.status.kind === 'upcoming',
  ).length;

  const GHOST =
    'h-[34px] rounded-lg border border-border-strong px-3 text-[12.5px] font-medium text-text-2 hover:bg-control hover:text-text';
  const ACCENT =
    'h-[34px] rounded-lg bg-accent px-3.5 text-[12.5px] font-semibold text-on-accent hover:brightness-110';

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 font-sans text-text">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
            Your trips
          </h1>
          {cards && (
            <span className="font-mono text-[12px] text-text-5">
              {cards.length} {cards.length === 1 ? 'trip' : 'trips'}
              {upcoming > 0 && ` · ${upcoming} upcoming`}
            </span>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">
          <button onClick={() => setShowImport(true)} className={GHOST}>
            Import a trip
          </button>
          <button onClick={() => setShowNew((v) => !v)} className={ACCENT}>
            New trip
          </button>
        </div>
      </div>

      {showNew && (
        <form
          onSubmit={submit}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border-strong bg-surface-2 p-4"
        >
          <label className="flex flex-1 flex-col gap-1 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
            Title
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-[38px] rounded-lg border border-border-strong bg-field px-3 text-[13px] text-text outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
            Start date
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-[38px] rounded-lg border border-border-strong bg-field px-3 text-[13px] text-text outline-none [color-scheme:dark] focus:border-accent"
            />
          </label>
          <button type="submit" disabled={busy} className={ACCENT}>
            {busy ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setShowNew(false)}
            className={GHOST}
          >
            Cancel
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-lg border border-danger-border px-3 py-2 text-[13px] text-danger-text">
          {error}
        </p>
      )}

      {showImport && (
        <ImportTripDialog
          onClose={() => setShowImport(false)}
          onImported={(tripId) => {
            setShowImport(false);
            onOpen(tripId);
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        {cards === null ? (
          <p className="py-10 text-center text-[13px] text-text-4">
            Loading trips…
          </p>
        ) : cards.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-border-strong px-4 py-10 text-center text-[13px] text-text-4">
            No trips yet — start one with{' '}
            <strong className="text-text-2">New trip</strong>, or import a JSON
            itinerary.
          </p>
        ) : (
          cards.map((card) => (
            <TripCardView
              key={card.trip.id}
              card={card}
              onOpen={() => onOpen(card.trip.id)}
            />
          ))
        )}

        {cards && cards.length > 0 && (
          <button
            onClick={() => setShowNew(true)}
            className="flex h-[62px] items-center justify-center gap-2 rounded-[14px] border border-dashed border-[oklch(0.34_0.012_250)] text-[13.5px] text-text-3 hover:border-[oklch(0.46_0.012_250)] hover:text-text"
          >
            <span className="text-[16px] leading-none">+</span> Plan a new trip
          </button>
        )}
      </div>
    </section>
  );
}
