/**
 * Block mutations for the inspector's block editor (WORK 7.1/7.2). Blocks
 * are note / link / photo / file rows hanging off a stop (or a wishlist
 * POI), each with a three-level visibility. Photo upload, EXIF extraction
 * and Wikimedia attribution are the phase 7.2 pipeline (BUILD §2's "populate
 * these from day one").
 */

import type { TypedPocketBase, BlocksResponse } from '../types/pb';
import { extractExif } from './exif';

export type BlockKind = 'note' | 'link' | 'photo' | 'file';
export type BlockVisibility = 'private' | 'trip' | 'public';

export type BlockPatch = Partial<{
  body: string;
  title: string;
  url: string;
  visibility: BlockVisibility;
}>;

/** Blocks for one parent, in display order. */
export function blocksFor(
  blocks: BlocksResponse[],
  parentType: 'stop' | 'trip' | 'day' | 'leg' | 'poi',
  parentId: string,
): BlocksResponse[] {
  // `created` is the tiebreaker, and it matters: the capture and import
  // paths append blocks without an `order_index` (only the card's own
  // `addBlock` sets one), so without this every imported block sorts as 0
  // and "the first photo" — the row thumbnail, the map pin, the card
  // cover — is whatever order the fetch happened to return, not the order
  // the photos were listed in. Creation order is that listed order.
  return blocks
    .filter((b) => b.parent_type === parentType && b.parent_id === parentId)
    .sort(
      (a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0) ||
        a.created.localeCompare(b.created),
    );
}

/** Resolves a photo/file block to a displayable URL — an uploaded file
 * (7.2's pipeline) takes priority; a plain external URL (import, paste) is
 * the fallback everything uses today. `thumb` requests one of the sizes set
 * on `blocks.file` (migration `1788000006`) — ignored for a non-image file
 * and for a plain `url`-only block, both of which just return the original. */
export function blockFileUrl(
  pb: TypedPocketBase,
  block: BlocksResponse,
  thumb?: '80x80' | '640x0',
): string | null {
  if (block.file) return pb.files.getURL(block, block.file, { thumb });
  if (block.url) return block.url;
  return null;
}

/** The first *displayable* photo block's URL — for a row thumbnail, a card
 * cover or a map pin. Skips photo blocks that resolve to nothing (an upload
 * that never finished, a placeholder), so a good photo further down the
 * list still shows rather than the surface going blank while another
 * surface (using a different pick) shows the image. `null` when none of the
 * photo blocks resolve. Pass `blocksFor(...)` so every surface agrees on
 * the order. */
export function firstPhotoUrl(
  pb: TypedPocketBase,
  blocks: BlocksResponse[],
  thumb: '80x80' | '640x0' = '80x80',
): string | null {
  for (const b of blocks) {
    if (b.kind !== 'photo') continue;
    const url = blockFileUrl(pb, b, thumb);
    if (url) return url;
  }
  return null;
}

/** Uploads a photo/file block's file, extracting EXIF GPS/date first (BUILD
 * §2: "photo and file blocks carry lat, lon, taken_at from EXIF on upload")
 * and sending both in the one request. EXIF failure (a non-JPEG, or a JPEG
 * with no GPS/date tags) is the common case, not an error — extractExif
 * itself never throws, so the upload always proceeds with whatever it found. */
export async function uploadBlockPhoto(
  pb: TypedPocketBase,
  blockId: string,
  file: File,
): Promise<void> {
  const exif = extractExif(await file.arrayBuffer());
  const form = new FormData();
  form.append('file', file);
  if (exif.lat !== undefined) form.append('lat', String(exif.lat));
  if (exif.lon !== undefined) form.append('lon', String(exif.lon));
  if (exif.takenAt) form.append('taken_at', exif.takenAt);
  await pb.collection('blocks').update(blockId, form);
}

/**
 * Append a new block to a stop or a wishlist idea, ordered after the ones
 * already there.
 *
 * `visibility` defaults to `trip`. Passing `private` is what the card's "My
 * notes" writes: the API rule already hides another member's private block
 * (migration `1788000000`), so a personal remark needs no new mechanism —
 * only somewhere to be typed (WORK 16.5).
 */
export async function addBlock(
  pb: TypedPocketBase,
  tripId: string,
  parentId: string,
  kind: BlockKind,
  siblingCount: number,
  parentType: 'stop' | 'poi' = 'stop',
  visibility: 'private' | 'trip' | 'public' = 'trip',
): Promise<void> {
  const user = pb.authStore.record;
  if (!user) return;
  await pb.collection('blocks').create({
    trip: tripId,
    parent_type: parentType,
    parent_id: parentId,
    kind,
    visibility,
    order_index: siblingCount,
    creator: user.id,
  });
}

export async function updateBlock(
  pb: TypedPocketBase,
  blockId: string,
  patch: BlockPatch,
): Promise<void> {
  await pb.collection('blocks').update(blockId, patch);
}

/** Move every block under one parent to another. Promoting a wishlist idea
 * to a stop (or downgrading a stop back to one, WORK 14) carries its
 * photos, description and links across this way — re-parented, not copied,
 * so a stored photo file isn't duplicated. The moved blocks are re-indexed
 * after any the target already has. Returns how many moved. */
export async function reparentBlocks(
  pb: TypedPocketBase,
  blocks: BlocksResponse[],
  from: { type: 'poi' | 'stop'; id: string },
  to: { type: 'poi' | 'stop'; id: string },
): Promise<number> {
  const moving = blocksFor(blocks, from.type, from.id);
  if (moving.length === 0) return 0;
  const base = blocksFor(blocks, to.type, to.id).length;
  const batch = pb.createBatch();
  moving.forEach((b, i) => {
    batch.collection('blocks').update(b.id, {
      parent_type: to.type,
      parent_id: to.id,
      order_index: base + i,
    });
  });
  await batch.send();
  return moving.length;
}

export async function deleteBlock(
  pb: TypedPocketBase,
  blockId: string,
): Promise<void> {
  await pb.collection('blocks').delete(blockId);
}

/** Move a block one slot up or down among its siblings by swapping
 * order_index with its neighbour. No-op at the ends. */
/**
 * Move a block to an arbitrary position among its siblings (WORK 18.2) —
 * what dragging a row needs, where `moveBlock` only ever swaps neighbours.
 * Rewrites `order_index` across the affected span in one batch, the same
 * shape `moveStop` uses for stops.
 *
 * `targetIndex` is the position in the *current* order the block should end
 * up at; it is clamped, and a no-op move sends nothing.
 */
export async function reorderBlock(
  pb: TypedPocketBase,
  siblings: BlocksResponse[],
  blockId: string,
  targetIndex: number,
): Promise<void> {
  const ordered = [...siblings].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  );
  const from = ordered.findIndex((b) => b.id === blockId);
  if (from < 0) return;
  const to = Math.max(0, Math.min(ordered.length - 1, targetIndex));
  if (to === from) return;

  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved!);

  const batch = pb.createBatch();
  let writes = 0;
  ordered.forEach((b, i) => {
    if ((b.order_index ?? 0) === i) return;
    batch.collection('blocks').update(b.id, { order_index: i });
    writes += 1;
  });
  if (writes > 0) await batch.send();
}

export async function moveBlock(
  pb: TypedPocketBase,
  siblings: BlocksResponse[],
  blockId: string,
  dir: -1 | 1,
): Promise<void> {
  const ordered = [...siblings].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  );
  const i = ordered.findIndex((b) => b.id === blockId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ordered.length) return;
  const a = ordered[i]!;
  const b = ordered[j]!;
  const batch = pb.createBatch();
  batch.collection('blocks').update(a.id, { order_index: j });
  batch.collection('blocks').update(b.id, { order_index: i });
  await batch.send();
}
