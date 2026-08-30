/**
 * Photon geocoding (BUILD §6): typeahead search and reverse lookup. Responses
 * are validated with Zod at the boundary; OSM tags map to a taxonomy kind via
 * the phase-0 table (kind_confirmed stays false for anything auto-derived).
 * The parser is pure and tested; the network wrappers are thin.
 */

import { z } from 'zod';
import { mapOsmTags } from './osm-tags';
import type { Kind } from './taxonomy';

const PHOTON_URL =
  import.meta.env.VITE_PHOTON_URL ?? 'https://photon.komoot.io';

const FeatureSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    name: z.string().optional(),
    osm_key: z.string().optional(),
    osm_value: z.string().optional(),
    street: z.string().optional(),
    housenumber: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }),
});
const ResponseSchema = z.object({ features: z.array(FeatureSchema) });

export interface PlaceResult {
  name: string;
  lat: number;
  lon: number;
  kind: Kind;
  osmKey?: string;
  osmValue?: string;
}

function toPlace(f: z.infer<typeof FeatureSchema>): PlaceResult {
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties;
  const kind: Kind =
    (p.osm_key ? mapOsmTags({ [p.osm_key]: p.osm_value ?? '' }) : null) ??
    'uncategorized';
  const address = [
    [p.housenumber, p.street].filter(Boolean).join(' '),
    p.city,
    p.country,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    name: p.name || address || 'Unnamed place',
    lat,
    lon,
    kind,
    osmKey: p.osm_key,
    osmValue: p.osm_value,
  };
}

/** Validate and map a raw Photon FeatureCollection. Pure; unit-tested. */
export function parsePhoton(json: unknown): PlaceResult[] {
  return ResponseSchema.parse(json).features.map(toPlace);
}

export async function photonSearch(
  query: string,
  opts?: { limit?: number; signal?: AbortSignal },
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${PHOTON_URL}/api/?q=${encodeURIComponent(q)}&limit=${opts?.limit ?? 6}&lang=en`;
  const res = await fetch(url, { signal: opts?.signal });
  if (!res.ok) throw new Error(`Photon search failed (${res.status})`);
  return parsePhoton(await res.json());
}

/** Reverse-geocode a point to a name/kind suggestion (coordinates stay the
 * caller's clicked point). */
export async function photonReverse(
  lat: number,
  lon: number,
): Promise<PlaceResult | null> {
  const url = `${PHOTON_URL}/reverse/?lat=${lat}&lon=${lon}&lang=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Photon reverse failed (${res.status})`);
  return parsePhoton(await res.json())[0] ?? null;
}
