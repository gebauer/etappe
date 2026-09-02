/**
 * Turns the `/api/share/{token}` payload into the cascade engine's input
 * (WORK 9.2 / 16.6). Pure — no fetch, no React.
 *
 * The hook (`pb_hooks/share.pb.js`) already assembled a trip-shaped document
 * server-side, filtered to public blocks; this just maps its field names
 * onto `CascadeTrip` so the share view runs the same engine as the editor,
 * per CLAUDE.md rule 3 ("editor, share view, PDF and import preview all call
 * the same function").
 */

import type {
  CascadeTrip,
  CascadeDay,
  CascadeStop,
  CascadeLeg,
} from './cascade';

export interface ShareBlock {
  id: string;
  kind: string;
  title?: string;
  body?: string;
  url?: string;
  file?: string;
  attribution_author?: string;
  attribution_licence?: string;
  attribution_url?: string;
}

export interface ShareStop {
  id: string;
  title: string;
  kind: string;
  lat?: number | null;
  lon?: number | null;
  is_accommodation?: boolean;
  anchor_time?: string;
  anchor_type?: 'arrival' | 'departure';
  dwell_override?: number;
  routing_kind?: 'stop' | 'waypoint';
  activities: { duration_min: number; kind?: string; title?: string }[];
  blocks: ShareBlock[];
}

export interface ShareLeg {
  mode: string;
  surface?: string;
  duration_min: number;
  distance_m?: number;
  geometry?: unknown;
}

export interface ShareDay {
  id: string;
  order_index: number;
  title?: string;
  kind: 'travel' | 'rest';
  start_stop?: string;
  stops: ShareStop[];
  legs: ShareLeg[];
  blocks: ShareBlock[];
}

export interface ShareDoc {
  trip: {
    title: string;
    start_date: string;
    timezone: string;
    car_buffer_pct: number;
    surface_multipliers: Record<string, number>;
    default_dwell: Record<string, number>;
  };
  days: ShareDay[];
}

function emptyToUndefined(v: string | undefined): string | undefined {
  return v ? v : undefined;
}

export function shareToCascade(doc: ShareDoc): CascadeTrip {
  const stopById = new Map<string, ShareStop>();
  for (const day of doc.days) for (const s of day.stops) stopById.set(s.id, s);

  const days: CascadeDay[] = doc.days.map((day) => {
    const cascadeStops: CascadeStop[] = day.stops.map((s) => ({
      id: s.id,
      kind: s.kind,
      is_accommodation: !!s.is_accommodation,
      lat: s.lat ?? null,
      lon: s.lon ?? null,
      anchor_time: emptyToUndefined(s.anchor_time) ?? null,
      anchor_type: s.anchor_type ?? null,
      dwell_override: s.dwell_override || null,
      routing_kind: s.routing_kind ?? null,
      activities: s.activities.map((a) => ({
        duration_min: a.duration_min,
        kind: a.kind as CascadeStop['activities'][number]['kind'],
      })),
    }));

    const cascadeLegs: CascadeLeg[] = day.legs.map((l) => ({
      mode: l.mode as CascadeLeg['mode'],
      surface: l.surface as CascadeLeg['surface'],
      duration_min: l.duration_min,
    }));

    const startStopId = emptyToUndefined(day.start_stop);
    const startStop = startStopId ? (stopById.get(startStopId) ?? null) : null;

    return {
      id: day.id,
      order_index: day.order_index,
      kind: day.kind,
      stops: cascadeStops,
      legs: cascadeLegs,
      startPoint: startStop
        ? {
            id: startStop.id,
            lat: startStop.lat ?? null,
            lon: startStop.lon ?? null,
          }
        : null,
    };
  });

  return {
    start_date: doc.trip.start_date.slice(0, 10),
    car_buffer_pct: doc.trip.car_buffer_pct,
    surface_multipliers: doc.trip.surface_multipliers,
    default_dwell: doc.trip.default_dwell,
    days,
  };
}
