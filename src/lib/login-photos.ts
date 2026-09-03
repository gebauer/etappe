import { z } from 'zod';

/** The sign-in background rotation is fed by a supplied folder in `public/`,
 * not user data — a `photos.json` manifest next to the images. See
 * `public/login-photos/README.md` and the handoff's "Sign-in" section.
 * Sourcing these from the user's own trips is a separate feature request. */

const MANIFEST_URL = '/login-photos/photos.json';
const photoBase = '/login-photos/';

// An optional caption field: a non-empty string, or absent. `null` is
// accepted and treated as absent — it's the shape an LLM asked to fill this
// in will reach for, and the manifest is hand-maintained. Blank strings are
// dropped the same way, so a stray "" never renders as an empty line.
const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const loginPhotoSchema = z
  .object({
    file: z.string().min(1),
    place: z.string().min(1),
    region: optionalText,
    coords: optionalText,
    month: optionalText,
  })
  // Extra keys (e.g. a `photographer` credit) are tolerated, just unused.
  .passthrough();

const manifestSchema = z.array(loginPhotoSchema);

export type LoginPhoto = {
  file: string;
  place: string;
  region?: string;
  coords?: string;
  month?: string;
  url: string;
};

/** Load and validate the manifest. Any failure — no file, bad JSON, a shape
 * that doesn't match — resolves to `[]`, and the sign-in renders on a plain
 * dark background. The screen must never break because a decorative photo is
 * missing. */
export async function loadLoginPhotos(): Promise<LoginPhoto[]> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) return [];
    const parsed = manifestSchema.safeParse(await res.json());
    if (!parsed.success) return [];
    return parsed.data.map((p) => ({ ...p, url: photoBase + p.file }));
  } catch {
    return [];
  }
}

/** The bold caption line: `place`, plus `region` when `place` doesn't already
 * end with it (so `"Tunnel View, Yosemite"` + region `"California"` reads
 * `"Tunnel View, Yosemite · California"`, but `"McWay Falls, California"` +
 * `"California"` stays as-is). */
export function captionPlace(p: LoginPhoto): string {
  if (!p.region) return p.place;
  const has = p.place.toLowerCase().includes(p.region.toLowerCase());
  return has ? p.place : `${p.place} · ${p.region}`;
}

/** The small mono line above the place: coords and/or month, whichever the
 * entry carries. Empty string when it carries neither — the caller drops the
 * line entirely. */
export function captionMeta(p: LoginPhoto): string {
  return [p.coords, p.month].filter(Boolean).join(' · ');
}
