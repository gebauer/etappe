/**
 * Maps an import document (BUILD §8) to the cascade engine's normalised input
 * (WORK 2.2). Pure. Leg durations are not in the import format — they come from
 * routing — so they are supplied by an injected resolver: a stub in tests, and
 * the ORS provider + cache in phase 3. Zod validation of the raw JSON is a
 * separate concern (phase 8.1); this adapter trusts a typed document.
 */

import { defaultDwellSeed } from './taxonomy';
import type { CascadeTrip, CascadeStop, CascadeLeg } from './cascade';

// --- import document shape (BUILD §8) --------------------------------------

export interface ImportActivity {
  title: string;
  duration_min: number;
  kind?: 'activity' | 'break';
  url?: string;
}

export interface ImportLink {
  url: string;
  title?: string;
  visibility?: 'private' | 'trip' | 'public';
}

export interface ImportStop {
  title: string;
  kind: string;
  place_hint?: string;
  lat?: number;
  lon?: number;
  is_accommodation?: boolean;
  anchor_time?: string;
  anchor_type?: 'arrival' | 'departure';
  dwell_min?: number;
  /** WORK 16.9: 'waypoint' forces the route through this stop without it
   * being a real destination — dwell is always 0 regardless of dwell_min. */
  routing_kind?: 'stop' | 'waypoint';
  notes?: string;
  activities?: ImportActivity[];
  links?: ImportLink[];
}

export interface ImportLeg {
  from: number;
  to: number;
  mode: CascadeLeg['mode'];
  surface?: 'paved' | 'gravel' | 'froad';
}

export interface ImportDay {
  index: number; // 1-based in the import format
  title: string;
  kind: 'travel' | 'rest';
  stops: ImportStop[];
  legs: ImportLeg[];
}

export interface ImportDoc {
  version: number;
  title: string;
  start_date: string;
  timezone: string;
  days: ImportDay[];
}

// --- routing injection ------------------------------------------------------

export interface ResolvedRoute {
  duration_min: number;
  distance_m?: number;
}

export interface LegContext {
  dayIndex: number; // 0-based order_index
  legIndex: number; // position within the day
  from: ImportStop;
  to: ImportStop;
  mode: CascadeLeg['mode'];
  surface?: 'paved' | 'gravel' | 'froad';
}

export type RouteResolver = (ctx: LegContext) => ResolvedRoute;

// --- trip settings (not part of the import doc; defaults per BUILD) ---------

export interface CascadeSettings {
  car_buffer_pct: number;
  surface_multipliers: Record<string, number>;
  default_dwell: Record<string, number>;
}

export function defaultSettings(): CascadeSettings {
  return {
    car_buffer_pct: 15,
    surface_multipliers: { paved: 1.0, gravel: 1.3, froad: 2.0 },
    default_dwell: defaultDwellSeed(),
  };
}

// --- adapter ----------------------------------------------------------------

export function importToCascade(
  doc: ImportDoc,
  resolveRoute: RouteResolver,
  settings: CascadeSettings = defaultSettings(),
): CascadeTrip {
  const days = doc.days.map((day) => {
    const dayIndex = day.index - 1;
    const dayId = `d${day.index}`;

    const stops: CascadeStop[] = day.stops.map((s, i) => ({
      id: `${dayId}-s${i}`,
      kind: s.kind,
      is_accommodation: s.is_accommodation ?? false,
      lat: s.lat ?? null,
      lon: s.lon ?? null,
      anchor_time: s.anchor_time ?? null,
      anchor_type: s.anchor_type ?? null,
      dwell_override: s.dwell_min ?? null,
      routing_kind: s.routing_kind ?? null,
      activities: (s.activities ?? []).map((a) => ({
        duration_min: a.duration_min,
        kind: a.kind ?? 'activity',
      })),
    }));

    const legs: CascadeLeg[] = [];
    for (let i = 0; i < day.stops.length - 1; i++) {
      const legId = `${dayId}-l${i}`;
      const importLeg = day.legs.find((l) => l.from === i && l.to === i + 1);
      if (!importLeg) {
        // A missing leg leaves consecutive stops touching (no travel time).
        legs.push({ id: legId, mode: 'other', duration_min: 0 });
        continue;
      }
      const route = resolveRoute({
        dayIndex,
        legIndex: i,
        from: day.stops[i]!,
        to: day.stops[i + 1]!,
        mode: importLeg.mode,
        surface: importLeg.surface,
      });
      legs.push({
        id: legId,
        mode: importLeg.mode,
        surface: importLeg.surface ?? null,
        duration_min: route.duration_min,
      });
    }

    return {
      id: dayId,
      order_index: dayIndex,
      kind: day.kind,
      stops,
      legs,
    };
  });

  return {
    start_date: doc.start_date,
    car_buffer_pct: settings.car_buffer_pct,
    surface_multipliers: settings.surface_multipliers,
    default_dwell: settings.default_dwell,
    days,
  };
}
