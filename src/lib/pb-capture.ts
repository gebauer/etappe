/**
 * Capture helpers (WORK 6.2): resolve a short link server-side (CORS-blocked in
 * the browser) and keep a pasted URL as a link block on the created stop.
 */

import type { TypedPocketBase } from '../types/pb';

export async function resolveLink(
  pb: TypedPocketBase,
  url: string,
): Promise<{ lat: number | null; lon: number | null }> {
  return pb.send('/api/resolve-link', { method: 'POST', body: { url } });
}

export async function addLinkBlock(
  pb: TypedPocketBase,
  tripId: string,
  stopId: string,
  url: string,
  title = '',
): Promise<void> {
  const user = pb.authStore.record;
  if (!user) return;
  await pb.collection('blocks').create({
    trip: tripId,
    parent_type: 'stop',
    parent_id: stopId,
    kind: 'link',
    visibility: 'trip',
    url,
    title,
    creator: user.id,
  });
}
