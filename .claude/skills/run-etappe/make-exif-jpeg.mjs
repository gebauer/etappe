#!/usr/bin/env node
// Standalone generator mirroring src/lib/exif.test.ts's byte-builder, to
// produce a real, decodable 1x1 JPEG with embedded GPS + DateTimeOriginal
// EXIF for photo-upload-check.mjs (WORK 7.2's live verification).
//
// Usage: node make-exif-jpeg.mjs [output-path]  (defaults to
// ./fixtures/exif-test-photo.jpg, next to this script)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function u16be(v) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v, false);
  return b;
}
function concat(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of arrs) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}
function writeEntry(dv, at, tag, type, count, value, little) {
  dv.setUint16(at, tag, little);
  dv.setUint16(at + 2, type, little);
  dv.setUint32(at + 4, count, little);
  dv.setUint32(at + 8, value, little);
}
function writeAsciiEntry(dv, at, tag, value, little) {
  dv.setUint16(at, tag, little);
  dv.setUint16(at + 2, 2, little);
  dv.setUint32(at + 4, value.length + 1, little);
  dv.setUint8(at + 8, value.charCodeAt(0));
  dv.setUint8(at + 9, 0);
}
function writeRationalTriplet(dv, at, triplet, little) {
  triplet.forEach(([num, den], i) => {
    dv.setUint32(at + i * 8, num, little);
    dv.setUint32(at + i * 8 + 4, den, little);
  });
}
function buildTiff(opts) {
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
  dv.setUint16(0, 0x4949, false);
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, IFD0_START, LE);
  dv.setUint16(IFD0_START, 2, LE);
  writeEntry(dv, IFD0_START + 2, 0x8825, 4, 1, GPS_IFD_START, LE);
  writeEntry(dv, IFD0_START + 2 + 12, 0x8769, 4, 1, EXIF_IFD_START, LE);
  dv.setUint32(IFD0_START + 2 + 24, 0, LE);
  dv.setUint16(GPS_IFD_START, 4, LE);
  writeAsciiEntry(dv, GPS_IFD_START + 2, 0x0001, opts.latRef, LE);
  writeEntry(dv, GPS_IFD_START + 2 + 12, 0x0002, 5, 3, GPS_LAT_START, LE);
  writeAsciiEntry(dv, GPS_IFD_START + 2 + 24, 0x0003, opts.lonRef, LE);
  writeEntry(dv, GPS_IFD_START + 2 + 36, 0x0004, 5, 3, GPS_LON_START, LE);
  dv.setUint32(GPS_IFD_START + 2 + 48, 0, LE);
  writeRationalTriplet(dv, GPS_LAT_START, opts.lat, LE);
  writeRationalTriplet(dv, GPS_LON_START, opts.lon, LE);
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

const tiff = buildTiff({
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
const exifHeader = new TextEncoder().encode('Exif\0\0');
const app1Length = 2 + exifHeader.length + tiff.length;
// A minimal but real, decodable 1x1 white JPEG scan follows the Exif APP1 —
// SOF0/DHT/DQT/SOS + compressed data for a 1x1 image — so this both carries
// EXIF and renders as an actual (tiny) image, not just valid marker bytes.
const scanTail = new Uint8Array([
  0xff,
  0xdb,
  0x00,
  0x43,
  0x00, // DQT
  ...Array(64).fill(1),
  0xff,
  0xc0,
  0x00,
  0x0b,
  0x08,
  0x00,
  0x01,
  0x00,
  0x01,
  0x01,
  0x01,
  0x11,
  0x00, // SOF0 1x1
  0xff,
  0xc4,
  0x00,
  0x1f,
  0x00, // DHT (DC, minimal)
  0x00,
  0x01,
  0x05,
  0x01,
  0x01,
  0x01,
  0x01,
  0x01,
  0x01,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x01,
  0x02,
  0x03,
  0x04,
  0x05,
  0x06,
  0x07,
  0x08,
  0x09,
  0x0a,
  0x0b,
  0xff,
  0xc4,
  0x00,
  0xb5,
  0x10, // DHT (AC, standard luma table)
  0x00,
  0x02,
  0x01,
  0x03,
  0x03,
  0x02,
  0x04,
  0x03,
  0x05,
  0x05,
  0x04,
  0x04,
  0x00,
  0x00,
  0x01,
  0x7d,
  0x01,
  0x02,
  0x03,
  0x00,
  0x04,
  0x11,
  0x05,
  0x12,
  0x21,
  0x31,
  0x41,
  0x06,
  0x13,
  0x51,
  0x61,
  0x07,
  0x22,
  0x71,
  0x14,
  0x32,
  0x81,
  0x91,
  0xa1,
  0x08,
  0x23,
  0x42,
  0xb1,
  0xc1,
  0x15,
  0x52,
  0xd1,
  0xf0,
  0x24,
  0x33,
  0x62,
  0x72,
  0x82,
  0x09,
  0x0a,
  0x16,
  0x17,
  0x18,
  0x19,
  0x1a,
  0x25,
  0x26,
  0x27,
  0x28,
  0x29,
  0x2a,
  0x34,
  0x35,
  0x36,
  0x37,
  0x38,
  0x39,
  0x3a,
  0x43,
  0x44,
  0x45,
  0x46,
  0x47,
  0x48,
  0x49,
  0x4a,
  0x53,
  0x54,
  0x55,
  0x56,
  0x57,
  0x58,
  0x59,
  0x5a,
  0x63,
  0x64,
  0x65,
  0x66,
  0x67,
  0x68,
  0x69,
  0x6a,
  0x73,
  0x74,
  0x75,
  0x76,
  0x77,
  0x78,
  0x79,
  0x7a,
  0x83,
  0x84,
  0x85,
  0x86,
  0x87,
  0x88,
  0x89,
  0x8a,
  0x92,
  0x93,
  0x94,
  0x95,
  0x96,
  0x97,
  0x98,
  0x99,
  0x9a,
  0xa2,
  0xa3,
  0xa4,
  0xa5,
  0xa6,
  0xa7,
  0xa8,
  0xa9,
  0xaa,
  0xb2,
  0xb3,
  0xb4,
  0xb5,
  0xb6,
  0xb7,
  0xb8,
  0xb9,
  0xba,
  0xc2,
  0xc3,
  0xc4,
  0xc5,
  0xc6,
  0xc7,
  0xc8,
  0xc9,
  0xca,
  0xd2,
  0xd3,
  0xd4,
  0xd5,
  0xd6,
  0xd7,
  0xd8,
  0xd9,
  0xda,
  0xe1,
  0xe2,
  0xe3,
  0xe4,
  0xe5,
  0xe6,
  0xe7,
  0xe8,
  0xe9,
  0xea,
  0xf1,
  0xf2,
  0xf3,
  0xf4,
  0xf5,
  0xf6,
  0xf7,
  0xf8,
  0xf9,
  0xfa,
  0xff,
  0xda,
  0x00,
  0x08,
  0x01,
  0x01,
  0x00,
  0x00,
  0x3f,
  0x00, // SOS
  0xd2,
  0xcf,
  0x20, // minimal compressed scan data (a single DC/AC pair)
  0xff,
  0xd9, // EOI
]);
const bytes = concat(
  new Uint8Array([0xff, 0xd8]),
  new Uint8Array([0xff, 0xe1]),
  u16be(app1Length),
  exifHeader,
  tiff,
  scanTail,
);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(HERE, 'fixtures', 'exif-test-photo.jpg');
const out = process.argv[2] || DEFAULT_OUT;
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, bytes);
console.log('wrote', bytes.length, 'bytes to', out);
