import { useCallback, useEffect, useRef, useState } from 'react';
import { pb, isAbortError } from '../lib/pb';
import { loadTripRecords, buildCascadeTrip } from '../lib/pb-trip-doc';
import type { TripRecords } from '../lib/pb-trip-doc';
import { fetchPhotoFile, pendingPhotoBlocks } from '../lib/pb-photo-fetch';
import { cascade, type CascadeResult } from '../lib/cascade';
import { createSunCalcDaylight } from '../lib/daylight';

export interface TripEditorState {
  records: TripRecords | null;
  result: CascadeResult | null;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads a trip's records and the cascade result, and re-runs both on demand.
 * Every mutation in the editor calls reload() so times recompute live. */
export function useTripEditor(tripId: string): TripEditorState {
  const [records, setRecords] = useState<TripRecords | null>(null);
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoAttemptsRef = useRef<Set<string>>(new Set());

  const reload = useCallback(async () => {
    try {
      const recs = await loadTripRecords(pb, tripId);
      setRecords(recs);
      setResult(
        cascade(
          buildCascadeTrip(recs),
          createSunCalcDaylight(recs.trip.timezone),
        ),
      );
      return recs;
    } catch (err) {
      if (isAbortError(err)) return null;
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

  return { records, result, error, reload: async () => void (await reload()) };
}
