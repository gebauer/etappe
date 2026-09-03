/// <reference path="../pb_data/types.d.ts" />

// HERE "flexible polyline" decoder (WORK 19.2). HERE Routing v8 returns a
// route's geometry in this format, not GeoJSON, so the route hook decodes
// it to the `[[lon, lat], …]` LineString every other backend already hands
// back. Spec: https://github.com/heremaps/flexible-polyline
//
// A `_lib.js` file rather than inline in the hook so it can be unit-tested
// from the app's own vitest suite (see `src/lib/flex-polyline.test.ts`) —
// each hook runs in its own VM, which is why the route hook `require()`s
// this rather than sharing a top-level helper.

const ENCODING_TABLE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

// Built from the encoding table rather than transcribed as a magic array —
// the published decoding tables are easy to copy wrong, and this cannot be.
const DECODE = {};
for (let i = 0; i < ENCODING_TABLE.length; i++) {
  DECODE[ENCODING_TABLE.charAt(i)] = i;
}

/**
 * Decodes a flexible polyline to GeoJSON-order coordinates.
 * @param {string} encoded
 * @returns {number[][]} `[[lon, lat], …]`, empty when undecodable.
 */
function decodeFlexPolyline(encoded) {
  if (typeof encoded !== 'string' || encoded.length === 0) return [];

  let index = 0;

  // Unsigned varint: 5 data bits per character, 0x20 is the continue flag.
  const readUnsigned = () => {
    let result = 0;
    let shift = 0;
    while (index < encoded.length) {
      const value = DECODE[encoded.charAt(index++)];
      if (value === undefined) return null;
      result += (value & 0x1f) * Math.pow(2, shift);
      if ((value & 0x20) === 0) return result;
      shift += 5;
    }
    return null; // ran out of input mid-number
  };

  // Zigzag: low bit is the sign.
  const toSigned = (n) => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);

  const version = readUnsigned();
  if (version !== 1) return [];
  const header = readUnsigned();
  if (header === null) return [];

  const precision = header & 15;
  const thirdDim = (header >> 4) & 7;
  const factor = Math.pow(10, precision);

  const coords = [];
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    const dLat = readUnsigned();
    if (dLat === null) break;
    const dLng = readUnsigned();
    if (dLng === null) break;
    lat += toSigned(dLat);
    lng += toSigned(dLng);
    // An elevation/altitude third dimension is present but irrelevant to a
    // 2-D map line — consume and drop it.
    if (thirdDim && readUnsigned() === null) break;
    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

module.exports = { decodeFlexPolyline };
