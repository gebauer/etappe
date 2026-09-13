import { z } from 'zod';
import { pb } from './pb';

/**
 * Whether the signed-in account is the deployment's owner, and where its
 * PocketBase dashboard is (`pb_hooks/owner.pb.js`).
 *
 * The owner is `OWNER_EMAIL` in the server's environment — the same
 * variable the registration gate mails its approve links to — so only the
 * server can answer this.
 */
const OwnerTools = z.object({
  isOwner: z.boolean(),
  adminUrl: z.string(),
});

export type OwnerTools = z.infer<typeof OwnerTools>;

const NOT_OWNER: OwnerTools = { isOwner: false, adminUrl: '' };

/**
 * Never throws: this decides whether to show one convenience link, and an
 * older server that has no such route should cost the account panel
 * nothing.
 */
export async function fetchOwnerTools(): Promise<OwnerTools> {
  try {
    const parsed = OwnerTools.safeParse(await pb.send('/api/owner', {}));
    return parsed.success ? parsed.data : NOT_OWNER;
  } catch {
    return NOT_OWNER;
  }
}
