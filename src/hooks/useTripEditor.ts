import { useCallback, useEffect, useState } from 'react';
import { pb, isAbortError } from '../lib/pb';
import { loadTripRecords, buildCascadeTrip } from '../lib/pb-trip-doc';
import type { TripRecords } from '../lib/pb-trip-doc';
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
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to load trip.');
    }
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { records, result, error, reload };
}
