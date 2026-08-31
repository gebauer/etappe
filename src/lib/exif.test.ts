import { describe, it, expect } from 'vitest';
import { extractExif } from './exif';

// --- a minimal synthetic JPEG+EXIF byte buffer, built by hand so the parser
// has no real dependency to round-trip against ------------------------------

function u16be(v: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v, false);
  return b;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of arrs) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

/** Builds a TIFF/IFD structure (little-endian) with one GPS IFD (lat/lon as
 * three rationals + refs) and one Exif SubIFD (DateTimeOriginal). Offsets
 * are computed from the entry counts, not hand-typed, so the layout stays
 * consistent if a section grows. */
type Rational3 = [[number, number], [number, number], [number, number]];

function buildTiff(opts: {
  lat: Rational3;
  latRef: string;
  lon: Rational3;
  lonRef: string;
  dateTimeOriginal: string; // "YYYY:MM:DD HH:MM:SS"
}): Uint8Array {
  const IFD0_START = 8;
  const IFD0_SIZE = 2 + 12 * 2 + 4;
  const GPS_IFD_START = IFD0_START + IFD0_SIZE;
  const GPS_IFD_FIXED_SIZE = 2 + 12 * 4 + 4;
  const GPS_EXT_START = GPS_IFD_START + GPS_IFD_FIXED_SIZE;
  const GPS_LAT_START = GPS_EXT_START;
  const GPS_LON_START = GPS_LAT_START + 24;
  const EXIF_IFD_START = GPS_LON_START + 24;
  const EXIF_IFD_FIXED_SIZE = 2 + 12 * 1 + 4;
  const EXIF_EXT_START = EXIF_IFD_START + EXIF_IFD_FIXED_SIZE;
  const dateBytes = new TextEncoder().encode(opts.dateTimeOriginal + '\0');
  const TOTAL = EXIF_EXT_START + dateBytes.length;

  const buf = new Uint8Array(TOTAL);
  const dv = new DataView(buf.buffer);
  const LE = true;

  // TIFF header
  dv.setUint16(0, 0x4949, false); // "II"
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, IFD0_START, LE);

  // IFD0: two pointer entries (GPS IFD, Exif SubIFD)
  dv.setUint16(IFD0_START, 2, LE);
  writeEntry(dv, IFD0_START + 2, 0x8825, 4, 1, GPS_IFD_START, LE);
  writeEntry(dv, IFD0_START + 2 + 12, 0x8769, 4, 1, EXIF_IFD_START, LE);
  dv.setUint32(IFD0_START + 2 + 24, 0, LE); // next IFD

  // GPS IFD
  dv.setUint16(GPS_IFD_START, 4, LE);
  writeAsciiEntry(dv, GPS_IFD_START + 2, 0x0001, opts.latRef, LE);
  writeEntry(dv, GPS_IFD_START + 2 + 12, 0x0002, 5, 3, GPS_LAT_START, LE);
  writeAsciiEntry(dv, GPS_IFD_START + 2 + 24, 0x0003, opts.lonRef, LE);
  writeEntry(dv, GPS_IFD_START + 2 + 36, 0x0004, 5, 3, GPS_LON_START, LE);
  dv.setUint32(GPS_IFD_START + 2 + 48, 0, LE);

  writeRationalTriplet(dv, GPS_LAT_START, opts.lat, LE);
  writeRationalTriplet(dv, GPS_LON_START, opts.lon, LE);

  // Exif SubIFD: DateTimeOriginal
  dv.setUint16(EXIF_IFD_START, 1, LE);
  writeEntry(
    dv,
    EXIF_IFD_START + 2,
    0x9003,
    2,
    dateBytes.length,
    EXIF_EXT_START,
    LE,
  );
  dv.setUint32(EXIF_IFD_START + 2 + 12, 0, LE);
  buf.set(dateBytes, EXIF_EXT_START);

  return buf;
}

function writeEntry(
  dv: DataView,
  at: number,
  tag: number,
  type: number,
  count: number,
  value: number,
  little: boolean,
) {
  dv.setUint16(at, tag, little);
  dv.setUint16(at + 2, type, little);
  dv.setUint32(at + 4, count, little);
  dv.setUint32(at + 8, value, little);
}

function writeAsciiEntry(
  dv: DataView,
  at: number,
  tag: number,
  value: string,
  little: boolean,
) {
  dv.setUint16(at, tag, little);
  dv.setUint16(at + 2, 2, little); // ASCII
  dv.setUint32(at + 4, value.length + 1, little);
  dv.setUint8(at + 8, value.charCodeAt(0));
  dv.setUint8(at + 9, 0);
}

/** deg/min/sec as exact [numerator, denominator] rationals — EXIF stores
 * seconds as a rational specifically so it can be fractional without
 * float rounding, e.g. 37.56" is [3756, 100], not a truncated 37. */
function writeRationalTriplet(
  dv: DataView,
  at: number,
  triplet: [[number, number], [number, number], [number, number]],
  little: boolean,
) {
  triplet.forEach(([num, den], i) => {
    dv.setUint32(at + i * 8, num, little);
    dv.setUint32(at + i * 8 + 4, den, little);
  });
}

function buildJpeg(tiff: Uint8Array): ArrayBuffer {
  const exifHeader = new TextEncoder().encode('Exif\0\0');
  const app1Length = 2 + exifHeader.length + tiff.length;
  const bytes = concat(
    new Uint8Array([0xff, 0xd8]), // SOI
    new Uint8Array([0xff, 0xe1]), // APP1
    u16be(app1Length),
    exifHeader,
    tiff,
    new Uint8Array([0xff, 0xd9]), // EOI
  );
  return bytes.buffer as ArrayBuffer;
}

describe('extractExif', () => {
  it('reads GPS coordinates and DateTimeOriginal from a synthetic JPEG', () => {
    const tiff = buildTiff({
      // 64°19'37.56" N -> Reykjavik-ish; seconds as an exact rational
      // (3756/100), the way a real EXIF writer would encode 37.56".
      lat: [
        [64, 1],
        [19, 1],
        [3756, 100],
      ],
      latRef: 'N',
      lon: [
        [21, 1],
        [56, 1],
        [3336, 100],
      ],
      lonRef: 'W',
      dateTimeOriginal: '2024:06:15 10:30:00',
    });
    const result = extractExif(buildJpeg(tiff));
    expect(result.lat).toBeCloseTo(64 + 19 / 60 + 37.56 / 3600, 5);
    expect(result.lon).toBeCloseTo(-(21 + 56 / 60 + 33.36 / 3600), 5);
    expect(result.takenAt).toBe('2024-06-15T10:30:00');
  });

  it('negates for S/W refs', () => {
    const tiff = buildTiff({
      lat: [
        [33, 1],
        [51, 1],
        [359, 10],
      ],
      latRef: 'S',
      lon: [
        [151, 1],
        [12, 1],
        [40, 1],
      ],
      lonRef: 'E',
      dateTimeOriginal: '2023:01:01 00:00:00',
    });
    const result = extractExif(buildJpeg(tiff));
    expect(result.lat).toBeLessThan(0);
    expect(result.lon).toBeGreaterThan(0);
  });

  it('returns {} for a non-JPEG buffer', () => {
    const bytes = new TextEncoder().encode('not a jpeg at all');
    expect(extractExif(bytes.buffer)).toEqual({});
  });

  it('returns {} for a JPEG with no APP1/Exif segment', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // SOI, EOI only
    expect(extractExif(bytes.buffer)).toEqual({});
  });

  it('never throws on a truncated/malformed buffer', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff]);
    expect(() => extractExif(bytes.buffer)).not.toThrow();
  });
});
