import { useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { readUserSettings } from '../lib/user-settings';
import type { LinkOut } from '../lib/geo-links';

/** The map app this user's `↗` links open (WORK 19.4). Re-reads on any
 * auth-store change, so picking a different app in the account panel
 * updates every link already on screen. */
export function useLinkOut(): LinkOut {
  const [app, setApp] = useState<LinkOut>(
    () => readUserSettings(pb).linkOut as LinkOut,
  );
  useEffect(
    () =>
      pb.authStore.onChange(() => {
        setApp(readUserSettings(pb).linkOut as LinkOut);
      }),
    [],
  );
  return app;
}
