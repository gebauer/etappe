import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHighlightsDoc } from './import-highlights';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../fixtures/highlights-example.json', import.meta.url),
    'utf8',
  ),
);

describe('parseHighlightsDoc', () => {
  it('parses the canonical fixture', () => {
    const result = parseHighlightsDoc(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.highlights).toHaveLength(2);
    expect(result.doc.highlights[0]!.title).toBe('Gullfoss');
    expect(result.doc.highlights[0]!.photos[0]!.author).toBe('Andreas Tille');
  });

  it('defaults kind to uncategorized when omitted', () => {
    const result = parseHighlightsDoc({
      version: 1,
      highlights: [{ title: 'Somewhere' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.highlights[0]!.kind).toBe('uncategorized');
    expect(result.doc.highlights[0]!.links).toEqual([]);
    expect(result.doc.highlights[0]!.photos).toEqual([]);
  });

  it('accepts notes and lat/lon when present', () => {
    const result = parseHighlightsDoc({
      version: 1,
      highlights: [
        { title: 'A', kind: 'lake', lat: 10, lon: 20, notes: 'Bring boots' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.highlights[0]!.notes).toBe('Bring boots');
  });

  it('rejects a missing title with a readable per-field error', () => {
    const result = parseHighlightsDoc({
      version: 1,
      highlights: [{ kind: 'lake' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('highlights.0.title'))).toBe(
      true,
    );
  });

  it('rejects an unknown kind', () => {
    const result = parseHighlightsDoc({
      version: 1,
      highlights: [{ title: 'X', kind: 'spaceship' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('kind'))).toBe(true);
  });

  it('rejects a malformed photo URL', () => {
    const result = parseHighlightsDoc({
      version: 1,
      highlights: [{ title: 'X', photos: [{ url: 'not-a-url' }] }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('photos.0.url'))).toBe(true);
  });

  it('rejects an empty highlights array', () => {
    const result = parseHighlightsDoc({ version: 1, highlights: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects a wrong version', () => {
    const result = parseHighlightsDoc({
      version: 2,
      highlights: [{ title: 'X' }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects non-object input', () => {
    const result = parseHighlightsDoc('not json');
    expect(result.ok).toBe(false);
  });
});
