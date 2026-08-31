/**
 * Highlights import (WORK 8.1 slice): the schema and parser for pasting a
 * list of POI "highlights" — researched in the user's own LLM chat, per
 * CLAUDE.md's no-LLM-in-app rule — into the wishlist. Distinct from the full
 * multi-day trip import (BUILD §8, WORK 8.2): a highlight has no day/anchor
 * position, just enough content to land as a wishlist idea with its notes,
 * links and photos attached as blocks once promoted.
 *
 * Pure and side-effect free — turning a parsed doc into `pois` + `blocks`
 * records is the importer's job, not this module's.
 */

import { z } from 'zod';
import { KINDS } from './taxonomy';

const urlField = z.string().trim().url();

const PhotoSchema = z.object({
  url: urlField,
  title: z.string().trim().optional(),
  author: z.string().trim().optional(),
  licence: z.string().trim().optional(),
  source_url: urlField.optional(),
});

const LinkSchema = z.object({
  url: urlField,
  title: z.string().trim().optional(),
});

const HighlightSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  kind: z.enum(KINDS as [string, ...string[]]).default('uncategorized'),
  place_hint: z.string().trim().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  description: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  links: z.array(LinkSchema).default([]),
  photos: z.array(PhotoSchema).default([]),
});

export const HighlightsDocSchema = z.object({
  version: z.literal(1),
  highlights: z
    .array(HighlightSchema)
    .min(1, 'at least one highlight is required'),
});

export type Highlight = z.infer<typeof HighlightSchema>;
export type HighlightsDoc = z.infer<typeof HighlightsDocSchema>;

export type ParseResult =
  { ok: true; doc: HighlightsDoc } | { ok: false; errors: string[] };

/** Parses and validates a pasted Highlights document, turning Zod's issue
 * list into one readable "path: message" string per problem (BUILD §8's
 * "readable per-field errors", applied to this lighter format). */
export function parseHighlightsDoc(raw: unknown): ParseResult {
  const result = HighlightsDocSchema.safeParse(raw);
  if (result.success) return { ok: true, doc: result.data };
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(document)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}
