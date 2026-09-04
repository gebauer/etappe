import { useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { setTripStartDate, setTripHeroPoi } from '../lib/pb-trips';
import { invertTripRoute } from '../lib/pb-stops';
import { createPocketBaseRouting } from '../lib/routing';
import { listWishlist } from '../lib/pb-pois';
import { blocksFor, firstPhotoUrl } from '../lib/pb-blocks';
import { categoryColor } from '../lib/map-colors';
import type { TripsResponse, PoisResponse, BlocksResponse } from '../types/pb';

/**
 * Per-trip settings reachable from the selection screen (WORK 23): shift the
 * whole trip to different dates, run the route the other way round, and
 * choose which saved place is the card's hero photo.
 */
export function TripSettingsDialog({
  trip,
  dayCount,
  onClose,
  onChanged,
}: {
  trip: TripsResponse;
  dayCount: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(trip.start_date.slice(0, 10));
  const [pois, setPois] = useState<PoisResponse[]>([]);
  const [blocks, setBlocks] = useState<BlocksResponse[]>([]);
  const [heroId, setHeroId] = useState<string>(trip.hero_poi || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmInvert, setConfirmInvert] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [w, b] = await Promise.all([
          listWishlist(pb, trip.id),
          pb.collection('blocks').getFullList<BlocksResponse>({
            filter: pb.filter('trip = {:t}', { t: trip.id }),
            requestKey: null,
          }),
        ]);
        setPois(w);
        setBlocks(b);
      } catch {
        /* the hero picker just stays empty */
      }
    })();
  }, [trip.id]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  const SECTION = 'text-[10.5px] uppercase tracking-[0.08em] text-text-4';
  const GHOST =
    'h-9 rounded-lg border border-border-strong px-3 text-[12.5px] text-text-2 hover:bg-control hover:text-text disabled:opacity-40';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[oklch(0.12_0.015_250/0.6)] p-6 font-sans"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border-strong bg-surface-2 p-5 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold">{trip.title} — settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-4 hover:text-text-2"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-danger-border px-3 py-2 text-[12.5px] text-danger-text">
            {error}
          </p>
        )}

        {/* Move the trip */}
        <div className={`mt-5 ${SECTION}`}>Move the trip</div>
        <p className="mt-1 text-[11.5px] leading-snug text-text-4">
          Every day&rsquo;s date is derived from the first one, so this shifts
          the whole itinerary. Times of day stay put.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-border-strong bg-field px-2.5 font-mono text-[13px] text-text outline-none [color-scheme:dark] focus:border-accent"
          />
          <button
            onClick={() => act(() => setTripStartDate(trip.id, date))}
            disabled={busy || date === trip.start_date.slice(0, 10)}
            className={GHOST}
          >
            Move
          </button>
        </div>

        {/* Reverse the route */}
        <div className={`mt-5 ${SECTION}`}>Route direction</div>
        <p className="mt-1 text-[11.5px] leading-snug text-text-4">
          Run the whole trip the other way round — a clockwise ring becomes the
          same ring counter-clockwise. Day order and each day&rsquo;s stops
          reverse, every leg is re-routed, and start points move to the new
          previous day. Dates are unchanged. No undo, but it inverts back.
        </p>
        {confirmInvert ? (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                act(async () => {
                  await invertTripRoute(
                    pb,
                    createPocketBaseRouting(pb, trip.id),
                    trip.id,
                  );
                  setConfirmInvert(false);
                })
              }
              disabled={busy}
              className="h-9 flex-1 rounded-lg bg-accent px-3 text-[12.5px] font-semibold text-on-accent disabled:opacity-40"
            >
              {busy ? 'Reversing…' : 'Reverse now'}
            </button>
            <button
              onClick={() => setConfirmInvert(false)}
              disabled={busy}
              className={GHOST}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmInvert(true)}
            disabled={busy || dayCount < 1}
            className={`mt-2 ${GHOST}`}
          >
            ↺ Reverse the route
          </button>
        )}

        {/* Hero photo */}
        <div className={`mt-5 ${SECTION}`}>Card photo</div>
        <p className="mt-1 text-[11.5px] leading-snug text-text-4">
          Which saved place shows on this trip&rsquo;s card. Defaults to the
          first starred one.
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <HeroTile
            label="Auto"
            selected={!heroId}
            onClick={() =>
              act(async () => {
                await setTripHeroPoi(trip.id, null);
                setHeroId('');
              })
            }
          />
          {pois.map((poi) => (
            <HeroTile
              key={poi.id}
              label={poi.title}
              url={firstPhotoUrl(pb, blocksFor(blocks, 'poi', poi.id))}
              color={categoryColor(poi.kind)}
              selected={heroId === poi.id}
              onClick={() =>
                act(async () => {
                  await setTripHeroPoi(trip.id, poi.id);
                  setHeroId(poi.id);
                })
              }
            />
          ))}
        </div>
        {pois.length === 0 && (
          <p className="mt-1 text-[11.5px] text-text-5">
            No saved places yet — add some from the wishlist.
          </p>
        )}

        <div className="mt-6 flex justify-end border-t border-border pt-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-on-accent disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroTile({
  label,
  url,
  color,
  selected,
  onClick,
}: {
  label: string;
  url?: string | null;
  color?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative aspect-square overflow-hidden rounded-[8px] border-2 ${
        selected ? 'border-accent' : 'border-transparent'
      }`}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center text-[9px] text-[oklch(0.16_0.02_250)]"
          style={{ background: color ?? 'oklch(0.26 0.012 250)' }}
        >
          {!color && 'Auto'}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-[oklch(0.13_0.02_250/0.7)] px-1 text-[8.5px] text-[oklch(0.95_0.01_250)]">
        {label}
      </span>
    </button>
  );
}
