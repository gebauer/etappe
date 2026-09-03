/**
 * Per-user routing settings (WORK 19.1).
 *
 * Two independent things:
 *
 * - **Routing engine + key** — which service computes leg durations. Read
 *   from the *trip owner* server-side, so a shared trip shows one set of
 *   numbers and the owner pays the quota. The key itself is a hidden field
 *   the client can never read back; it is written through a hook endpoint.
 * - **Link-out app** — where the `↗` links open. No key, no cost, so it is
 *   genuinely per-user and can differ between members of the same trip.
 */
import type { TypedPocketBase } from '../types/pb';

export interface RoutingEngine {
  id: string;
  label: string;
  /** Whether the user supplies a key (a self-hosted OSRM does not). */
  needsKey: boolean;
  hint: string;
}

export const ROUTING_ENGINES: RoutingEngine[] = [
  {
    id: 'here',
    label: 'HERE',
    needsKey: true,
    hint: 'Closest to real driving times. Free tier, no card. Recommended.',
  },
  {
    id: 'ors',
    label: 'OpenRouteService',
    needsKey: true,
    hint: 'Free, but very conservative on gravel and highland roads.',
  },
  {
    id: 'osrm',
    label: 'Self-hosted OSRM',
    needsKey: false,
    hint: 'Uses the server’s OSRM_URL. No key, no quota.',
  },
];

export interface LinkOutApp {
  id: string;
  label: string;
}

export const LINK_OUT_APPS: LinkOutApp[] = [
  { id: 'google', label: 'Google Maps' },
  { id: 'apple', label: 'Apple Maps' },
  { id: 'here', label: 'HERE WeGo' },
  { id: 'osm', label: 'OpenStreetMap' },
];

export const DEFAULT_LINK_OUT = 'google';

/** The authenticated user's own settings, off the auth record. `routing_keys`
 * is hidden server-side and never appears here — `routing_providers` is the
 * readable list of which engines have a key stored. */
export interface UserSettings {
  routingBackend: string;
  routingProviders: string[];
  linkOut: string;
}

export function readUserSettings(pb: TypedPocketBase): UserSettings {
  const rec = pb.authStore.record as {
    routing_backend?: string;
    routing_providers?: unknown;
    link_out?: string;
  } | null;
  const providers = Array.isArray(rec?.routing_providers)
    ? (rec!.routing_providers as string[])
    : [];
  return {
    routingBackend: rec?.routing_backend ?? '',
    routingProviders: providers,
    linkOut: rec?.link_out || DEFAULT_LINK_OUT,
  };
}

/** Which engine / link-out to use, plain field writes (neither is secret). */
export async function saveUserSettings(
  pb: TypedPocketBase,
  patch: { routing_backend?: string; link_out?: string },
): Promise<void> {
  const id = pb.authStore.record?.id;
  if (!id) return;
  await pb.collection('users').update(id, patch);
}

/**
 * Store or clear one engine's API key. Goes through the hook rather than a
 * record update: `routing_keys` is hidden, so the client cannot read the
 * map to merge a single provider into it. Passing `key: null` clears that
 * provider — the others are kept, so switching engines back and forth
 * doesn't make you re-enter a key (author, 2026-09-03).
 */
export async function saveRoutingKey(
  pb: TypedPocketBase,
  provider: string,
  key: string | null,
): Promise<string[]> {
  const res = await pb.send<{ providers: string[] }>(
    '/api/routing-credentials',
    { method: 'POST', body: { provider, key } },
  );
  return res.providers ?? [];
}
