import { useCallback, useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { loadTripRecords, buildCascadeTrip } from '../lib/pb-trip-doc';
import type { TripRecords } from '../lib/pb-trip-doc';
import { cascade, type CascadeResult } from '../lib/cascade';
import { createSunCalcDaylight } from '../lib/daylight';

function isAbort(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'isAbort' in err && !!err.isAbort;
}

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
    } catch (err) {
      if (isAbort(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to load trip.');
    }
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { records, result, error, reload };
}
