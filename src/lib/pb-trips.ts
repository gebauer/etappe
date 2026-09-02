import { pb } from './pb';
import { defaultDwellSeed } from './taxonomy';
import type {
  InvitesResponse,
  TripsResponse,
  TripMembersResponse,
  TripMembersRoleOptions,
} from '../types/pb';

export interface NewTripInput {
  title: string;
  /** YYYY-MM-DD; the only absolute date in the system. */
  start_date: string;
  timezone?: string;
  currency?: string;
}

/** Trips the current user belongs to. The API rules already scope this to
 * their memberships, so no explicit filter is needed. */
export async function listMyTrips(): Promise<TripsResponse[]> {
  // requestKey: null opts out of auto-cancellation, which otherwise aborts the
  // first fetch when React 18 StrictMode runs the effect twice in dev.
  return pb
    .collection('trips')
    .getFullList({ sort: '-created', requestKey: null });
}

export async function createTrip(input: NewTripInput): Promise<TripsResponse> {
  const user = pb.authStore.record;
  if (!user) throw new Error('Must be signed in to create a trip.');
  return pb.collection('trips').create({
    title: input.title,
    start_date: `${input.start_date} 00:00:00.000Z`,
    timezone: input.timezone || 'Atlantic/Reykjavik',
    currency: input.currency || 'EUR',
    car_buffer_pct: 15,
    surface_multipliers: { paved: 1.0, gravel: 1.3, froad: 2.0 },
    default_dwell: defaultDwellSeed(),
    owner: user.id,
    share_enabled: false,
  });
}

/** Invite someone by email. If they already have an account the membership is
 * created immediately; otherwise the invite waits for them to register (both
 * handled server-side). */
export async function inviteToTrip(
  tripId: string,
  email: string,
  role: TripMembersRoleOptions,
): Promise<void> {
  const user = pb.authStore.record;
  if (!user) throw new Error('Must be signed in to invite.');
  await pb.collection('invites').create({
    trip: tripId,
    email,
    role,
    invited_by: user.id,
    status: 'pending',
  });
}

export async function listMembers(
  tripId: string,
): Promise<TripMembersResponse[]> {
  return pb.collection('trip_members').getFullList({
    filter: pb.filter('trip = {:trip}', { trip: tripId }),
    sort: 'created',
    requestKey: null,
  });
}

/** Change a member's role (owner-only, enforced by the API rules). */
export async function assignRole(
  memberId: string,
  role: TripMembersRoleOptions,
): Promise<void> {
  await pb.collection('trip_members').update(memberId, { role });
}

/** Pending and past invites for a trip. Readable by every member; only an
 * owner can create or revoke one (migration `1788000002`). */
export async function listInvites(tripId: string): Promise<InvitesResponse[]> {
  return pb.collection('invites').getFullList({
    filter: pb.filter('trip = {:trip}', { trip: tripId }),
    sort: '-created',
    requestKey: null,
  });
}

/** Withdraw an invite that hasn't been taken up. Marked revoked rather than
 * deleted, so re-inviting the same address doesn't collide with the unique
 * (trip, email) index and the history stays visible. */
export async function revokeInvite(inviteId: string): Promise<void> {
  await pb.collection('invites').update(inviteId, { status: 'revoked' });
}

/** Remove someone from a trip. Owner-only by rule; leaving is the same call
 * made against your own membership, which the rules also allow an owner to
 * do — so the UI, not the API, is what stops a trip losing its last owner. */
export async function removeMember(memberId: string): Promise<void> {
  await pb.collection('trip_members').delete(memberId);
}

/** Turn the public link on or off (WORK 16.6). Owner-only by rule. */
export async function setShareEnabled(
  tripId: string,
  enabled: boolean,
): Promise<void> {
  await pb.collection('trips').update(tripId, { share_enabled: enabled });
}

/**
 * Mint a new share token, invalidating the old link.
 *
 * PocketBase's autogenerate only fires on create, so the new value is
 * generated here and written like any other field. Returns it so the caller
 * can show the new URL without a refetch.
 */
export async function regenerateShareToken(tripId: string): Promise<string> {
  const alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(22);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(
    '',
  );
  await pb.collection('trips').update(tripId, { share_token: token });
  return token;
}
