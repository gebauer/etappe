import { useSyncExternalStore } from 'react';
import { pb } from '../lib/pb';
import { currentUser } from '../lib/auth';
import type { UsersResponse } from '../types/pb';

/** Reactive auth state. Re-renders when the user signs in or out. */
export function useAuth(): { isLoggedIn: boolean; user: UsersResponse | null } {
  const isLoggedIn = useSyncExternalStore(
    (onChange) => pb.authStore.onChange(() => onChange()),
    () => pb.authStore.isValid,
  );
  return { isLoggedIn, user: currentUser() };
}
