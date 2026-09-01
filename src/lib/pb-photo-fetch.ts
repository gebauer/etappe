import type { TypedPocketBase, BlocksResponse } from '../types/pb';

export interface PhotoFetchResult {
  fetched: boolean;
  reason?: string;
}

/**
 * Asks the server to download a photo block's external `url` and store it as
 * the block's `file` (pb_hooks/photo.pb.js).
 *
 * This has to be server-side: imported photos are plain URLs on third-party
 * webservers that routinely send no CORS header, and without one the browser
 * can neither fetch the bytes nor read them back off a canvas — which is
 * what compositing a map pin's thumbnail requires. Displaying such an image
 * in an `<img>` works fine, which is why list rows and the card showed
 * photos while the pins fell back to a flat colour.
 *
 * Never throws for a photo that simply couldn't be fetched (dead link,
 * hotlink protection, an HTML error page): those come back as
 * `{ fetched: false, reason }` so one bad photo can't fail an import.
 */
export async function fetchPhotoFile(
  pb: TypedPocketBase,
  blockId: string,
): Promise<PhotoFetchResult> {
  try {
    return await pb.send('/api/photo-fetch', {
      method: 'POST',
      body: { blockId },
    });
  } catch (err) {
    return {
      fetched: false,
      reason: err instanceof Error ? err.message : 'failed',
    };
  }
}

/** The photo blocks that still hotlink — no stored file, but a URL to try. */
export function pendingPhotoBlocks(blocks: BlocksResponse[]): BlocksResponse[] {
  return blocks.filter((b) => b.kind === 'photo' && !b.file && !!b.url);
}
