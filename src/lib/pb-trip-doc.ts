/**
 * Assembles PocketBase records into the cascade engine's normalised input, and
 * loads them for a trip. This is the editor/share/PDF path into cascade.ts
 * (the import wizard uses importToCascade instead).
 *
 * PocketBase returns 0 for an unset number and "" for unset text (there is no
 * null for these), so we treat 0/"" as "unset": dwell_override 0 -> use
 * activities/default, lat/lon 0 -> no coordinates, buffer_override_pct 0 -> trip
 * default. A genuine 0 for these is therefore not expressible — an acceptable
 * trade-off (a 0-minute dwell or a stop at 0°,0° does not occur in practice).
 */

import type {
  CascadeTrip,
  CascadeDay,
  CascadeStop,
  CascadeLeg,
} from './cascade';
import type { TypedPocketBase } from '../types/pb';
import type {
  TripsResponse,
  DaysResponse,
  StopsResponse,
  LegsResponse,
  ActivitiesResponse,
  BlocksResponse,
  CostsResponse,
} from '../types/pb';

export interface TripRecords {
  trip: TripsResponse;
  days: DaysResponse[];
  stops: StopsResponse[];
  legs: LegsResponse[];
  activities: ActivitiesResponse[];
  blocks: BlocksResponse[];
  /** WORK 16.7. Members-only — never part of a share payload. */
  costs: CostsResponse[];
}

function toCascadeLeg(leg: LegsResponse): CascadeLeg {
  return {
    id: leg.id,
    mode: leg.mode,
    surface: leg.surface || null,
    duration_min: leg.duration_min,
    buffer_override_pct: leg.buffer_override_pct || null,
  };
}

export function buildCascadeTrip(records: TripRecords): CascadeTrip {
  const { trip, days, stops, legs, activities } = records;

  const activitiesByStop = new Map<string, ActivitiesResponse[]>();
  for (const a of [...activities].sort(
    (x, y) => x.order_index - y.order_index,
  )) {
    const list = activitiesByStop.get(a.stop) ?? [];
    list.push(a);
    activitiesByStop.set(a.stop, list);
  }

  const stopById = new Map(stops.map((s) => [s.id, s]));
  const legByPair = new Map<string, LegsResponse>();
  for (const l of legs) legByPair.set(`${l.from_stop}->${l.to_stop}`, l);

  const cascadeDays: CascadeDay[] = [...days]
    .sort((a, b) => a.order_index - b.order_index)
    .map((day) => {
      const dayStops = stops
        .filter((s) => s.day === day.id)
        .sort((a, b) => a.order_index - b.order_index);

      const cascadeStops: CascadeStop[] = dayStops.map((s) => ({
        id: s.id,
        kind: s.kind,
        is_accommodation: s.is_accommodation,
        lat: s.lat || null,
        lon: s.lon || null,
        anchor_time: s.anchor_time || null,
        anchor_type: (s.anchor_type || null) as CascadeStop['anchor_type'],
        dwell_override: s.dwell_override || null,
        activities: (activitiesByStop.get(s.id) ?? []).map((a) => ({
          duration_min: a.duration_min,
          kind: a.kind,
        })),
      }));

      const cascadeLegs: CascadeLeg[] = [];
      for (let i = 0; i < dayStops.length - 1; i++) {
        const leg = legByPair.get(`${dayStops[i]!.id}->${dayStops[i + 1]!.id}`);
        cascadeLegs.push(
          leg ? toCascadeLeg(leg) : { mode: 'other', duration_min: 0 },
        );
      }

      // Day-start continuity (WORK 13.1): `start_stop` points at an existing
      // stop (normally the previous day's accommodation). Resolve its
      // coordinates for the ghost row / map line, and pick up the leading
      // leg record (start_stop -> this day's first stop) if it's been routed.
      // A pointer to this day's own first stop is a no-op; a dangling id
      // (PB nulls the relation on delete, but be defensive) is ignored.
      const firstStop = dayStops[0];
      const startStopId = day.start_stop || null;
      const startStop =
        startStopId && firstStop && startStopId !== firstStop.id
          ? (stopById.get(startStopId) ?? null)
          : null;
      const startPoint = startStop
        ? {
            id: startStop.id,
            lat: startStop.lat || null,
            lon: startStop.lon || null,
          }
        : null;
      const leadingLegRecord =
        startPoint && firstStop
          ? (legByPair.get(`${startPoint.id}->${firstStop.id}`) ?? null)
          : null;

      return {
        id: day.id,
        order_index: day.order_index,
        kind: day.kind,
        stops: cascadeStops,
        legs: cascadeLegs,
        startPoint,
        leadingLeg: leadingLegRecord ? toCascadeLeg(leadingLegRecord) : null,
      };
    });

  return {
    start_date: trip.start_date,
    car_buffer_pct: trip.car_buffer_pct,
    surface_multipliers: (trip.surface_multipliers ?? {}) as Record<
      string,
      number
    >,
    default_dwell: (trip.default_dwell ?? {}) as Record<string, number>,
    days: cascadeDays,
  };
}

export async function loadTripRecords(
  pb: TypedPocketBase,
  tripId: string,
): Promise<TripRecords> {
  const scope = pb.filter('day.trip = {:t}', { t: tripId });
  const [trip, days, stops, legs, activities, blocks, costs] =
    await Promise.all([
      pb.collection('trips').getOne(tripId, { requestKey: null }),
      pb.collection('days').getFullList({
        filter: pb.filter('trip = {:t}', { t: tripId }),
        sort: 'order_index',
        requestKey: null,
      }),
      pb.collection('stops').getFullList({
        filter: scope,
        sort: 'order_index',
        requestKey: null,
      }),
      pb.collection('legs').getFullList({
        filter: pb.filter('from_stop.day.trip = {:t}', { t: tripId }),
        requestKey: null,
      }),
      pb.collection('activities').getFullList({
        filter: pb.filter('stop.day.trip = {:t}', { t: tripId }),
        sort: 'order_index',
        requestKey: null,
      }),
      pb.collection('blocks').getFullList({
        filter: pb.filter('trip = {:t}', { t: tripId }),
        sort: 'order_index',
        requestKey: null,
      }),
      pb.collection('costs').getFullList({
        filter: pb.filter('trip = {:t}', { t: tripId }),
        requestKey: null,
      }),
    ]);
  return { trip, days, stops, legs, activities, blocks, costs };
}
