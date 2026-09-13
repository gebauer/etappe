import { pb } from './pb';
import type { UsersResponse } from '../types/pb';

export function currentUser(): UsersResponse | null {
  return (pb.authStore.record as unknown as UsersResponse | null) ?? null;
}

export async function login(email: string, password: string): Promise<void> {
  await pb.collection('users').authWithPassword(email, password);
}

/**
 * Register, then sign in if the server lets us.
 *
 * It usually will not, and that is the point (author, 2026-09-13): a new
 * account has to confirm its address, and one outside the trusted domain
 * also waits for the owner\'s approval — `pb_hooks/registration.pb.js`. The
 * gate is the collection\'s auth rule, so the honest thing for a client to
 * do is try and report what happened, rather than predict a policy it
 * cannot see. `signedIn: false` means "created, now go and read your email".
 *
 * Pending invites for this email are materialised into memberships
 * server-side (pb_hooks/membership.pb.js).
 */
export async function register(
  email: string,
  password: string,
  name = '',
): Promise<{ signedIn: boolean }> {
  await pb.collection('users').create({
    email,
    password,
    passwordConfirm: password,
    name,
  });
  try {
    await login(email, password);
    return { signedIn: true };
  } catch {
    return { signedIn: false };
  }
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
