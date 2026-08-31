/**
 * Minimal JPEG EXIF reader (BUILD §2/§7.2: "photo and file blocks carry
 * lat, lon, taken_at from EXIF on upload"). Hand-rolled rather than a new
 * dependency — same call CLAUDE.md's project convention already made for
 * Markdown (src/lib/markdown.ts) and paste-sniffing: the three tags this
 * needs (GPSLatitude, GPSLongitude, DateTimeOriginal) are a small, stable
 * slice of the TIFF/IFD format, well within "the platform can do it."
 *
 * Only what BUILD §2 asks for is parsed — no orientation, no maker notes, no
 * write support. Never throws: any malformed or non-JPEG input just yields
 * an empty result, since a photo with no usable EXIF is the common case.
 */

export interface ExifData {
  lat?: number;
  lon?: number;
  /** ISO-ish "YYYY-MM-DDTHH:MM:SS" — EXIF carries no timezone, so this is
   * naive local time, not UTC. */
  takenAt?: string;
}

const APP1 = 0xe1;
const SOS = 0xda;
const EXIF_HEADER = 'Exif\0\0';

const TAG_GPS_IFD_POINTER = 0x8825;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LON_REF = 0x0003;
const TAG_GPS_LON = 0x0004;
const TAG_DATE_TIME_ORIGINAL = 0x9003;

const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL (2x LONG)
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

interface IfdEntry {
  type: number;
  count: number;
  /** Absolute byte offset (from the start of the buffer) of the value —
   * inline entries are copied to a scratch area by readIfd so this is
   * always a real offset, never the raw 4-byte slot. */
  valueOffset: number;
}

function readIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  little: boolean,
): Map<number, IfdEntry> {
  const entries = new Map<number, IfdEntry>();
  const count = view.getUint16(tiffStart + ifdOffset, little);
  for (let i = 0; i < count; i++) {
    const entryStart = tiffStart + ifdOffset + 2 + i * 12;
    if (entryStart + 12 > view.byteLength) break;
    const tag = view.getUint16(entryStart, little);
    const type = view.getUint16(entryStart + 2, little);
    const valueCount = view.getUint32(entryStart + 4, little);
    const size = (TYPE_SIZES[type] ?? 1) * valueCount;
    const valueOffset =
      size <= 4
        ? entryStart + 8
        : tiffStart + view.getUint32(entryStart + 8, little);
    entries.set(tag, { type, count: valueCount, valueOffset });
  }
  return entries;
}

function readRational(view: DataView, offset: number, little: boolean): number {
  const num = view.getUint32(offset, little);
  const den = view.getUint32(offset + 4, little);
  return den === 0 ? 0 : num / den;
}

function readAscii(view: DataView, entry: IfdEntry): string {
  const bytes = new Uint8Array(
    view.buffer,
    view.byteOffset + entry.valueOffset,
    entry.count,
  );
  let s = '';
  for (const b of bytes) {
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}

function readGpsCoord(
  view: DataView,
  entries: Map<number, IfdEntry>,
  valueTag: number,
  refTag: number,
  positiveRef: string,
  little: boolean,
): number | undefined {
  const value = entries.get(valueTag);
  const ref = entries.get(refTag);
  if (!value || !ref || value.count < 3) return undefined;
  const [deg, min, sec] = [0, 1, 2].map((i) =>
    readRational(view, value.valueOffset + i * 8, little),
  );
  const decimal = deg! + min! / 60 + sec! / 3600;
  const refChar = readAscii(view, ref).toUpperCase();
  return refChar === positiveRef ? decimal : -decimal;
}

function parseTiff(view: DataView, tiffStart: number): ExifData {
  const byteOrder = view.getUint16(tiffStart, false);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return {};
  const little = byteOrder === 0x4949;
  const magic = view.getUint16(tiffStart + 2, little);
  if (magic !== 42) return {};
  const ifd0Offset = view.getUint32(tiffStart + 4, little);
  const ifd0 = readIfd(view, tiffStart, ifd0Offset, little);

  const result: ExifData = {};

  // A pointer tag's "value" is itself a LONG holding the pointed-to IFD's
  // offset — readIfd only tells us where that 4-byte LONG lives (valueOffset
  // for an inline entry), so it still has to be read before use.
  const gpsPointer = ifd0.get(TAG_GPS_IFD_POINTER);
  if (gpsPointer) {
    const gpsOffset = view.getUint32(gpsPointer.valueOffset, little);
    const gps = readIfd(view, tiffStart, gpsOffset, little);
    result.lat = readGpsCoord(
      view,
      gps,
      TAG_GPS_LAT,
      TAG_GPS_LAT_REF,
      'N',
      little,
    );
    result.lon = readGpsCoord(
      view,
      gps,
      TAG_GPS_LON,
      TAG_GPS_LON_REF,
      'E',
      little,
    );
  }

  const exifPointer = ifd0.get(TAG_EXIF_IFD_POINTER);
  if (exifPointer) {
    const exifOffset = view.getUint32(exifPointer.valueOffset, little);
    const exifIfd = readIfd(view, tiffStart, exifOffset, little);
    const dto = exifIfd.get(TAG_DATE_TIME_ORIGINAL);
    if (dto) {
      // "YYYY:MM:DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS"
      const raw = readAscii(view, dto);
      const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(raw);
      if (m) result.takenAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}`;
    }
  }

  return result;
}

/** Scans a JPEG's marker segments for APP1/Exif and parses it. Never
 * throws — any parse failure (non-JPEG, truncated, no Exif) yields `{}`. */
export function extractExif(buffer: ArrayBuffer): ExifData {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return {}; // not a JPEG (no SOI)

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      offset += 2;
      if (marker === SOS || marker === 0xd9) break; // image data / EOI
      if (marker >= 0xd0 && marker <= 0xd7) continue; // RST markers, no length
      const length = view.getUint16(offset);
      if (marker === APP1 && offset + length <= view.byteLength) {
        const header = String.fromCharCode(
          ...new Uint8Array(buffer, offset + 2, 6),
        );
        if (header === EXIF_HEADER) {
          return parseTiff(view, offset + 2 + 6);
        }
      }
      offset += length;
    }
    return {};
  } catch {
    return {};
  }
}
