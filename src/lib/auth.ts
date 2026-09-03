import { pb } from './pb';
import type { UsersResponse } from '../types/pb';

export function currentUser(): UsersResponse | null {
  return (pb.authStore.record as unknown as UsersResponse | null) ?? null;
}

export function isLoggedIn(): boolean {
  return pb.authStore.isValid;
}

export async function login(email: string, password: string): Promise<void> {
  await pb.collection('users').authWithPassword(email, password);
}

/** Register then sign in. Pending invites for this email are materialised into
 * memberships server-side (pb_hooks/membership.pb.js). */
export async function register(
  email: string,
  password: string,
  name = '',
): Promise<void> {
  await pb.collection('users').create({
    email,
    password,
    passwordConfirm: password,
    name,
  });
  await login(email, password);
}

export function logout(): void {
  pb.authStore.clear();
}

/** Ask PocketBase to email a reset link. No-op UI beyond a confirmation —
 * the reset itself happens through the emailed link, on PocketBase's own
 * page. Requires SMTP configured on the server; without it this throws and
 * the caller surfaces the error. */
export async function requestPasswordReset(email: string): Promise<void> {
  await pb.collection('users').requestPasswordReset(email);
}

/** Subscribe to auth state changes; returns an unsubscribe function. */
export function onAuthChange(cb: () => void): () => void {
  return pb.authStore.onChange(() => cb());
}
