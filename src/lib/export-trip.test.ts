import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  exportTrip,
  exportWishlist,
  exportFilename,
  CURRENT_TRIP_VERSION,
  type ExportableRecords,
} from './export-trip';
import { parseTripDoc } from './import-trip-doc';
import { importToCascade } from './import-cascade';
import { cascade } from './cascade';
import { stubDaylight } from './daylight';
import type { ImportDoc } from './import-cascade';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../fixtures/iceland-day1.json', import.meta.url),
    'utf8',
  ),
) as unknown;

/** Stubbed routing, as the cascade tests do — leg durations are not part of
 * the format, so a round-trip has to hold them constant to compare. */
const stubRoute = () => ({ duration_min: 30 });

const daylight = stubDaylight({ sunrise: 400, sunset: 1215, dusk: 1245 });

const settings = {
  car_buffer_pct: 15,
  surface_multipliers: { paved: 1, gravel: 1.3, froad: 2 },
  default_dwell: {},
};

function records(): ExportableRecords {
  return {
    trip: {
      id: 't',
      title: 'Iceland ring road',
      start_date: '2026-09-12 00:00:00.000Z',
      timezone: 'Atlantic/Reykjavik',
    } as ExportableRecords['trip'],
    days: [
      { id: 'd1', order_index: 0, kind: 'travel', title: 'KEF to Skálholt' },
      { id: 'd2', order_index: 1, kind: 'rest', title: '' },
    ] as unknown as ExportableRecords['days'],
    stops: [
      {
        id: 's1',
        day: 'd1',
        order_index: 0,
        title: 'Keflavík airport',
        kind: 'airport',
        lat: 63.985,
        lon: -22.605,
        anchor_time: '10:25',
        anchor_type: 'arrival',
        dwell_override: 65,
      },
      {
        id: 's2',
        day: 'd1',
        order_index: 1,
        title: 'Gullfoss',
        kind: 'waterfall',
        lat: 64.327,
        lon: -20.12,
      },
      {
        id: 's3',
        day: 'd2',
        order_index: 0,
        title: 'Hótel Skálholt',
        kind: 'hotel',
        is_accommodation: true,
        lat: 64.12,
        lon: -20.53,
      },
    ] as unknown as ExportableRecords['stops'],
    legs: [
      {
        id: 'l1',
        from_stop: 's1',
        to_stop: 's2',
        mode: 'car',
        surface: 'paved',
      },
    ] as unknown as ExportableRecords['legs'],
    activities: [
      {
        id: 'a1',
        stop: 's2',
        order_index: 0,
        title: 'Walk around the falls',
        duration_min: 120,
        kind: 'activity',
      },
    ] as unknown as ExportableRecords['activities'],
    blocks: [
      {
        id: 'b1',
        parent_type: 'stop',
        parent_id: 's1',
        kind: 'note',
        order_index: 0,
        body: 'Pick up 4x4',
      },
      {
        id: 'b2',
        parent_type: 'stop',
        parent_id: 's1',
        kind: 'link',
        order_index: 1,
        url: 'https://example.com/rental',
        title: 'Rental booking',
        visibility: 'private',
      },
      {
        id: 'b3',
        parent_type: 'stop',
        parent_id: 's3',
        kind: 'photo',
        order_index: 0,
        file: 'hotel.jpg',
      },
    ] as unknown as ExportableRecords['blocks'],
  };
}

describe('exportTrip', () => {
  it('writes the current version, not whatever it read', () => {
    expect(exportTrip(records()).version).toBe(CURRENT_TRIP_VERSION);
  });

  it('writes a plain date, not PocketBase’s timestamp', () => {
    expect(exportTrip(records()).start_date).toBe('2026-09-12');
  });

  it('excludes a private note from the exported text', () => {
    const r = records();
    r.blocks.push({
      id: 'b-private-note',
      parent_type: 'stop',
      parent_id: 's1',
      kind: 'note',
      order_index: 5,
      visibility: 'private',
      body: 'Only I should see this',
    } as unknown as ExportableRecords['blocks'][number]);
    const stop = exportTrip(r).days[0]!.stops[0]!;
    expect(stop.notes).toBe('Pick up 4x4');
    expect(stop.notes).not.toContain('Only I should see this');
  });

  it('carries anchors, dwell, activities, notes and links across', () => {
    const doc = exportTrip(records());
    const stop = doc.days[0]!.stops[0]!;
    expect(stop).toMatchObject({
      title: 'Keflavík airport',
      kind: 'airport',
      anchor_time: '10:25',
      anchor_type: 'arrival',
      dwell_min: 65,
      notes: 'Pick up 4x4',
    });
    expect(stop.links).toEqual([
      {
        url: 'https://example.com/rental',
        title: 'Rental booking',
        visibility: 'private',
      },
    ]);
    expect(doc.days[0]!.stops[1]!.activities).toEqual([
      { title: 'Walk around the falls', duration_min: 120, kind: 'activity' },
    ]);
  });

  it('numbers days from 1 and legs by position within the day', () => {
    const doc = exportTrip(records());
    expect(doc.days.map((d) => d.index)).toEqual([1, 2]);
    expect(doc.days[0]!.legs).toEqual([
      { from: 0, to: 1, mode: 'car', surface: 'paved' },
    ]);
    expect(doc.days[1]!.legs).toEqual([]);
  });

  it('says how many uploaded files it had to leave behind', () => {
    expect(exportTrip(records()).omitted_files).toBe(1);
  });

  it('omits the count entirely when nothing was left behind', () => {
    const r = records();
    r.blocks = r.blocks.filter((b) => !b.file);
    expect(exportTrip(r).omitted_files).toBeUndefined();
  });

  it('round-trips: what it writes, the importer accepts', () => {
    const result = parseTripDoc(exportTrip(records()));
    expect(result.ok).toBe(true);
  });

  it('round-trips to identical cascade output', () => {
    const doc = exportTrip(records());
    const parsed = parseTripDoc(doc);
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));
    const before = cascade(
      importToCascade(doc as ImportDoc, stubRoute, settings),
      daylight,
    );
    const after = cascade(
      importToCascade(parsed.doc, stubRoute, settings),
      daylight,
    );
    expect(after).toEqual(before);
  });
});

describe('parseTripDoc', () => {
  it('accepts every leg mode the cascade engine understands, including bike', () => {
    // Regression: the Zod schema originally omitted 'bike' from the leg
    // mode enum even though CascadeLeg['mode'] and ImportLeg both include
    // it — a bike leg in an otherwise-valid document was silently rejected.
    for (const mode of ['car', 'walk', 'ferry', 'flight', 'bike', 'other']) {
      const doc = {
        version: 1,
        title: 'T',
        start_date: '2026-01-01',
        timezone: 'UTC',
        days: [
          {
            index: 1,
            kind: 'travel',
            stops: [
              { title: 'A', kind: 'town' },
              { title: 'B', kind: 'town' },
            ],
            legs: [{ from: 0, to: 1, mode }],
          },
        ],
      };
      const result = parseTripDoc(doc);
      expect(result.ok, `mode "${mode}" should parse`).toBe(true);
    }
  });

  it('accepts the shipped fixture', () => {
    const result = parseTripDoc(fixture);
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result.doc.title).toBe('Iceland ring road');
  });

  it('validating the fixture does not change what it cascades to', () => {
    const result = parseTripDoc(fixture);
    if (!result.ok) throw new Error(result.errors.join('; '));
    const raw = cascade(
      importToCascade(fixture as ImportDoc, stubRoute, settings),
      daylight,
    );
    const validated = cascade(
      importToCascade(result.doc, stubRoute, settings),
      daylight,
    );
    expect(validated).toEqual(raw);
  });

  it('names the field and the problem', () => {
    const bad = { version: 1, title: '', start_date: '12/09/2026', days: [] };
    const result = parseTripDoc(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('title: title is required');
    expect(result.errors).toContain('start_date: expected YYYY-MM-DD');
  });

  it('rejects a version it has no parser for, and says which it reads', () => {
    const result = parseTripDoc({ version: 99 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/newer than this app understands/);
    expect(result.errors[0]).toMatch(/reads 1/);
  });

  it('rejects a document with no version at all', () => {
    const result = parseTripDoc({ title: 'no version' });
    expect(result.ok).toBe(false);
  });

  // Both formats declare `version: 1`, so a Highlights list clears the
  // version gate and would otherwise report four bare "Required" fields.
  it('names a Highlights list pasted into the trip importer', () => {
    const result = parseTripDoc({
      version: 1,
      highlights: [{ title: 'Gullfoss', kind: 'waterfall' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Highlights list, not a trip/);
  });
});

describe('exportWishlist', () => {
  it('writes the Highlights format the importer already reads', () => {
    const doc = exportWishlist(
      [
        {
          id: 'p1',
          title: 'Hotel Vogar',
          kind: 'hotel',
          lat: 63.98,
          lon: -22.38,
        },
      ] as unknown as Parameters<typeof exportWishlist>[0],
      [
        {
          id: 'b1',
          parent_type: 'poi',
          parent_id: 'p1',
          kind: 'note',
          order_index: 0,
          body: 'Near the airport',
        },
        {
          id: 'b2',
          parent_type: 'poi',
          parent_id: 'p1',
          kind: 'link',
          order_index: 1,
          url: 'https://booking.example/vogar',
          title: 'Booking.com',
        },
      ] as unknown as Parameters<typeof exportWishlist>[1],
    );
    expect(doc.version).toBe(1);
    expect(doc.highlights[0]).toMatchObject({
      title: 'Hotel Vogar',
      kind: 'hotel',
      lat: 63.98,
      description: 'Near the airport',
      links: [{ url: 'https://booking.example/vogar', title: 'Booking.com' }],
    });
  });
});

describe('exportFilename', () => {
  it('slugs the trip title', () => {
    expect(exportFilename('Iceland ring road', 'trip')).toBe(
      'iceland-ring-road-trip.json',
    );
    expect(exportFilename('  ??  ', 'wishlist')).toBe('trip-wishlist.json');
  });
});
