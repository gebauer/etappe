/**
 * Validates a full trip document (BUILD §8) and dispatches on its version
 * (WORK 16.3). This is the boundary the export half round-trips through.
 *
 * **The versioning rule.** One parser per version, each producing the
 * *current* `ImportDoc` shape. When the format changes: bump
 * `CURRENT_TRIP_VERSION`, add `parseV2`, and leave `parseV1` exactly as it
 * is. A retired parser is never deleted and never edited to match the new
 * shape — it is the only thing that keeps an export written two years ago
 * openable, and rewriting it silently reinterprets old files.
 *
 * Pure. Turning a parsed document into records is the importer's job.
 */

import { z } from 'zod';
import { KINDS } from './taxonomy';
import type { ImportDoc } from './import-cascade';
import { CURRENT_TRIP_VERSION } from './export-trip';

const clock = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');

const ActivitySchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  duration_min: z.number().int().min(0),
  kind: z.enum(['activity', 'break']).optional(),
  url: z.string().trim().url().optional(),
});

const LinkSchema = z.object({
  url: z.string().trim().url(),
  title: z.string().trim().optional(),
  visibility: z.enum(['private', 'trip', 'public']).optional(),
});

const StopSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  kind: z.enum(KINDS as [string, ...string[]]),
  place_hint: z.string().trim().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  is_accommodation: z.boolean().optional(),
  anchor_time: clock.optional(),
  anchor_type: z.enum(['arrival', 'departure']).optional(),
  dwell_min: z.number().int().min(0).optional(),
  routing_kind: z.enum(['stop', 'waypoint']).optional(),
  notes: z.string().optional(),
  activities: z.array(ActivitySchema).default([]),
  links: z.array(LinkSchema).default([]),
});

const LegSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  mode: z.enum(['car', 'walk', 'ferry', 'flight', 'bike', 'other']),
  surface: z.enum(['paved', 'gravel', 'froad']).optional(),
});

const DaySchema = z.object({
  index: z.number().int().min(1),
  title: z.string().default(''),
  kind: z.enum(['travel', 'rest']),
  stops: z.array(StopSchema).default([]),
  legs: z.array(LegSchema).default([]),
});

/** Version 1 — the format `fixtures/iceland-day1.json` is written in. */
const TripDocV1Schema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1, 'title is required'),
  start_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  timezone: z.string().trim().min(1, 'timezone is required'),
  days: z.array(DaySchema).min(1, 'at least one day is required'),
  // Written by the export to say what the JSON couldn't carry; ignored here.
  omitted_files: z.number().int().min(0).optional(),
});

export type ParseResult =
  { ok: true; doc: ImportDoc } | { ok: false; errors: string[] };

function issues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(document)';
    return `${path}: ${issue.message}`;
  });
}

/** Per-version parsers, each returning the current `ImportDoc` shape. Add to
 * this map; never remove from it. */
const PARSERS: Record<number, (raw: unknown) => ParseResult> = {
  1: (raw) => {
    const result = TripDocV1Schema.safeParse(raw);
    if (!result.success) return { ok: false, errors: issues(result.error) };
    // v1 *is* the current shape, so there is nothing to upgrade. A future
    // parseV2 would map its own shape onto ImportDoc here. `omitted_files` is
    // the export's own bookkeeping and has no place in the parsed document.
    const doc = { ...result.data };
    delete doc.omitted_files;
    return { ok: true, doc };
  },
};

export function parseTripDoc(raw: unknown): ParseResult {
  // The two import formats share the same `version: 1` envelope, so a
  // Highlights list pasted here clears the version gate and then reports
  // every trip field as missing — four cryptic "Required" lines instead of
  // the one thing that actually went wrong. Name it instead.
  const doc = raw as Record<string, unknown> | null;
  if (Array.isArray(doc?.highlights) && !Array.isArray(doc?.days)) {
    return {
      ok: false,
      errors: [
        '(document): this is a Highlights list, not a trip — it has "highlights" where a trip has "days". Open the trip you want these places on and use its Import button; this screen builds a whole new trip from a day-by-day itinerary.',
      ],
    };
  }

  const version = (raw as { version?: unknown } | null)?.version;
  if (typeof version !== 'number') {
    return {
      ok: false,
      errors: ['(document): version is required and must be a number'],
    };
  }
  const parser = PARSERS[version];
  if (!parser) {
    const known = Object.keys(PARSERS).join(', ');
    return {
      ok: false,
      errors: [
        version > CURRENT_TRIP_VERSION
          ? `(document): version ${version} is newer than this app understands (it reads ${known}) — update Etappe`
          : `(document): version ${version} is not a format this app has a parser for (it reads ${known})`,
      ],
    };
  }
  return parser(raw);
}
