/**
 * Block mutations for the inspector's block editor (WORK 7.1). Blocks are
 * note / link / photo / file rows hanging off a stop (or, later, a wishlist
 * POI), each with a three-level visibility. Photo upload and attribution are
 * the phase 7.2 pipeline; here a photo block just references a URL.
 */

import type { TypedPocketBase, BlocksResponse } from '../types/pb';

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
  return blocks
    .filter((b) => b.parent_type === parentType && b.parent_id === parentId)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

/** Resolves a photo/file block to a displayable URL — an uploaded file
 * (7.2's pipeline) takes priority; a plain external URL (import, paste) is
 * the fallback everything uses today. */
export function blockFileUrl(
  pb: TypedPocketBase,
  block: BlocksResponse,
): string | null {
  if (block.file) return pb.files.getURL(block, block.file);
  if (block.url) return block.url;
  return null;
}

/** The first photo block's displayable URL, for a row thumbnail — `null`
 * when there isn't one, same "nothing to show" case as no blocks at all. */
export function firstPhotoUrl(
  pb: TypedPocketBase,
  blocks: BlocksResponse[],
): string | null {
  const photo = blocks.find((b) => b.kind === 'photo');
  return photo ? blockFileUrl(pb, photo) : null;
}

/** Append a new block to a stop, ordered after the ones already there. */
export async function addBlock(
  pb: TypedPocketBase,
  tripId: string,
  stopId: string,
  kind: BlockKind,
  siblingCount: number,
): Promise<void> {
  const user = pb.authStore.record;
  if (!user) return;
  await pb.collection('blocks').create({
    trip: tripId,
    parent_type: 'stop',
    parent_id: stopId,
    kind,
    visibility: 'trip',
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

export async function deleteBlock(
  pb: TypedPocketBase,
  blockId: string,
): Promise<void> {
  await pb.collection('blocks').delete(blockId);
}

/** Move a block one slot up or down among its siblings by swapping
 * order_index with its neighbour. No-op at the ends. */
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
