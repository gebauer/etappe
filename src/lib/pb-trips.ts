import { pb } from './pb';
import { defaultDwellSeed } from './taxonomy';
import type {
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
  return pb.collection('trips').getFullList({ sort: '-created' });
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
  });
}

/** Change a member's role (owner-only, enforced by the API rules). */
export async function assignRole(
  memberId: string,
  role: TripMembersRoleOptions,
): Promise<void> {
  await pb.collection('trip_members').update(memberId, { role });
}
