/**
 * A tiny IndexedDB cache of the last-synced trip, for read-only offline
 * use (WORK 10.3). The app has no TanStack Query, so this is the
 * hand-rolled equivalent of BUILD §10's "persistQueryClient keeps the
 * active trip in IndexedDB": every successful load writes the whole
 * `TripRecords` here, and `useTripEditor` reads it back when the network
 * is gone so the plan still renders — editing is paused, not the view.
 *
 * Everything is best-effort: a private window, a blocked store or a quota
 * error just means no offline copy, never a thrown error into the app.
 */
import type { TripRecords } from './pb-trip-doc';

const DB_NAME = 'etappe-cache';
const STORE = 'trips';

export interface CachedTrip {
  records: TripRecords;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no indexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTripCache(
  tripId: string,
  records: TripRecords,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(
        { records, savedAt: Date.now() } satisfies CachedTrip,
        tripId,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* no offline copy this time — not fatal */
  }
}

export async function loadTripCache(
  tripId: string,
): Promise<CachedTrip | null> {
  try {
    const db = await openDb();
    const value = await new Promise<CachedTrip | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const get = tx.objectStore(STORE).get(tripId);
        get.onsuccess = () => resolve(get.result as CachedTrip | undefined);
        get.onerror = () => reject(get.error);
      },
    );
    db.close();
    return value ?? null;
  } catch {
    return null;
  }
}
