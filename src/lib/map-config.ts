/** The basemap style URL, shared by the live map (`MapPane`) and the
 * offscreen snapshot map the print view builds (`print-map.ts`). Kept in
 * one place so a self-hosted `VITE_TILE_URL` reaches both. */
export const TILE_URL =
  import.meta.env.VITE_TILE_URL ??
  'https://tiles.openfreemap.org/styles/liberty';
