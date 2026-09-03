import { useCallback, useEffect, useRef, useState } from 'react';
import { pb, isAbortError } from '../lib/pb';
import { loadTripRecords, buildCascadeTrip } from '../lib/pb-trip-doc';
import type { TripRecords } from '../lib/pb-trip-doc';
import { fetchPhotoFile, pendingPhotoBlocks } from '../lib/pb-photo-fetch';
import { cascade, type CascadeResult } from '../lib/cascade';
import { createSunCalcDaylight } from '../lib/daylight';
import { saveTripCache, loadTripCache } from '../lib/trip-cache';

export interface TripEditorState {
  records: TripRecords | null;
  result: CascadeResult | null;
  error: string | null;
  /** No connection to PocketBase. The editor stays mounted and everything
   * renders from the last sync; every write is refused with a notice
   * until this clears (WORK 10.3). */
  offline: boolean;
  /** What's on screen is the cached copy, not a fresh fetch. */
  stale: boolean;
  /** When that cached copy was last written, ms epoch — for "synced 20 min
   * ago". `null` while showing live data. */
  savedAt: number | null;
  reload: () => Promise<void>;
}

function runCascade(recs: TripRecords): CascadeResult {
  return cascade(
    buildCascadeTrip(recs),
    createSunCalcDaylight(recs.trip.timezone),
  );
}

/** Loads a trip's records and the cascade result, and re-runs both on demand.
 * Every mutation in the editor calls reload() so times recompute live. When
 * the network is gone it falls back to the IndexedDB copy and flips to
 * read-only rather than erroring out. */
export function useTripEditor(tripId: string): TripEditorState {
  const [records, setRecords] = useState<TripRecords | null>(null);
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [stale, setStale] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const photoAttemptsRef = useRef<Set<string>>(new Set());
  // The latest records, so the offline-fallback branch can tell a cold
  // start (nothing on screen) from a signal drop mid-session (keep what's
  // there — it's newer than any cache).
  const recordsRef = useRef<TripRecords | null>(null);
  recordsRef.current = records;

  const reload = useCallback(async () => {
    try {
      const recs = await loadTripRecords(pb, tripId);
      setRecords(recs);
      setResult(runCascade(recs));
      setError(null);
      setOffline(false);
      setStale(false);
      setSavedAt(null);
      void saveTripCache(tripId, recs);
      return recs;
    } catch (err) {
      if (isAbortError(err)) return null;
      // A failed fetch here is almost always "no signal", not a real
      // server error. Show the last synced copy read-only if we have one;
      // only surface an error when there is nothing at all to fall back to.
      const cached = recordsRef.current ? null : await loadTripCache(tripId);
      if (recordsRef.current || cached) {
        if (cached) {
          setRecords(cached.records);
          setResult(runCascade(cached.records));
          setSavedAt(cached.savedAt);
        }
        setOffline(true);
        setStale(true);
        setError(null);
        return null;
      }
      setError(err instanceof Error ? err.message : 'Failed to load trip.');
      return null;
    }
  }, [tripId]);

  // Photos that still hotlink can't become map pins: compositing one means
  // reading it back off a canvas, and the hosts these URLs point at send no
  // CORS header, so the browser refuses. 12.8 made the server store the
  // bytes, but only on the import path — anything imported before it, or
  // whose download failed that day, is stuck hotlinking forever and its pin
  // stays a flat colour while the same photo shows fine in the list (an
  // `<img>` needs no CORS). Heal those in the background, once per block per
  // session, and reload if anything landed so the pins can composite.
  const backfillPhotos = useCallback(
    async (recs: TripRecords) => {
      const pending = pendingPhotoBlocks(recs.blocks).filter(
        (b) => !photoAttemptsRef.current.has(b.id),
      );
      if (pending.length === 0) return;
      for (const b of pending) photoAttemptsRef.current.add(b.id);
      let stored = 0;
      for (const b of pending) {
        const outcome = await fetchPhotoFile(pb, b.id);
        if (outcome.fetched) stored += 1;
      }
      if (stored > 0) await reload();
    },
    [reload],
  );

  useEffect(() => {
    photoAttemptsRef.current.clear();
    void reload().then((recs) => {
      if (recs) void backfillPhotos(recs);
    });
  }, [reload, backfillPhotos]);

  // React to the browser's own connectivity signal: drop to read-only the
  // moment it goes, and re-sync when it comes back.
  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => void reload();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true);
    }
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [reload]);

  return {
    records,
    result,
    error,
    offline,
    stale,
    savedAt,
    reload: async () => void (await reload()),
  };
}
