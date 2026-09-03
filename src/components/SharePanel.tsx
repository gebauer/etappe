import { useEffect, useState } from 'react';
import {
  listMembers,
  listInvites,
  inviteToTrip,
  assignRole,
  removeMember,
  revokeInvite,
  setShareEnabled,
  regenerateShareToken,
} from '../lib/pb-trips';
import type {
  InvitesResponse,
  TripMembersResponse,
  TripMembersRoleOptions,
  TripsResponse,
} from '../types/pb';

/**
 * Who can see this trip (WORK 16.6). Two audiences, two mechanisms:
 *
 * - **People** get a `trip_members` row with a role, and the API rules have
 *   enforced that since phase 1 — a viewer's writes are refused by the
 *   server, not hidden by the client. Inviting by email creates an `invites`
 *   row; a hook turns it into a membership immediately if that address
 *   already has an account, or when it registers.
 * - **A public link** is the trip's `share_token`, and it shows only blocks
 *   marked `public`.
 *
 * The visibility line is the part worth being loud about: a block defaults
 * to `trip`, so a freshly-enabled public link shows the route and the stops
 * and nothing else until something is explicitly promoted. Better to say so
 * here than to let someone discover their booking details were the one
 * thing they assumed wasn't shared. Costs never appear at all.
 */
const ROLES: TripMembersRoleOptions[] = [
  'owner',
  'editor',
  'contributor',
  'viewer',
];

const ROLE_HELP: Record<string, string> = {
  owner: 'Everything, including sharing and deleting the trip.',
  editor: 'Can change the plan, but not who it is shared with.',
  contributor:
    'Can add and edit wishlist places, but not the itinerary or the sharing.',
  viewer: 'Read-only. The server refuses their writes.',
};

export function SharePanel({
  trip,
  currentUserId,
  isOwner,
  publicBlockCount,
  onClose,
  onChanged,
}: {
  trip: TripsResponse;
  currentUserId: string;
  isOwner: boolean;
  /** How many blocks would actually be visible on a public link. */
  publicBlockCount: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<TripMembersResponse[]>([]);
  const [invites, setInvites] = useState<InvitesResponse[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TripMembersRoleOptions>('editor');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareEnabled, setEnabled] = useState(!!trip.share_enabled);
  const [token, setToken] = useState(trip.share_token ?? '');
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/share/${token}`;

  async function refresh() {
    try {
      const [m, i] = await Promise.all([
        listMembers(trip.id),
        listInvites(trip.id),
      ]);
      setMembers(m);
      setInvites(i.filter((invite) => invite.status === 'pending'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load members.');
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  /** Invite, then say what happened: a known address is added straight away
   * (and shows up under People); an unknown one gets a pending invite. Both
   * get an email if the server has SMTP configured. */
  async function invite() {
    const addr = email.trim();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await inviteToTrip(trip.id, addr, role);
      const [m] = await Promise.all([listMembers(trip.id), refresh()]);
      onChanged();
      const added = m.some(
        (member) => (member.label || '').toLowerCase() === addr.toLowerCase(),
      );
      setNotice(
        added
          ? `${addr} is on the trip now — they’ve been emailed.`
          : `Invited ${addr}. They’ll get an email to create an account.`,
      );
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  const owners = members.filter((m) => m.role === 'owner');

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[oklch(0.12_0.015_250/0.6)]"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-strong bg-surface-2 p-5 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Share “{trip.title}”</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-4 hover:text-text-2"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="mt-2 rounded-lg border border-danger-border px-3 py-2 text-[12.5px] text-danger-text">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-2 rounded-lg border border-border-strong bg-field px-3 py-2 text-[12.5px] text-text-2">
            {notice}
          </p>
        )}

        <div className="mt-4 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
          People
        </div>
        <ul className="mt-2 divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {member.label || 'someone'}
                {member.user === currentUserId && (
                  <span className="ml-1.5 text-[11px] text-text-4">you</span>
                )}
              </span>
              {isOwner ? (
                <select
                  value={member.role}
                  disabled={busy}
                  onChange={(e) =>
                    act(() =>
                      assignRole(
                        member.id,
                        e.target.value as TripMembersRoleOptions,
                      ),
                    )
                  }
                  className="h-8 rounded-lg border border-border-strong bg-field px-2 text-[12.5px] text-text"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[12px] text-text-4">{member.role}</span>
              )}
              {(isOwner || member.user === currentUserId) && (
                <button
                  disabled={
                    busy || (member.role === 'owner' && owners.length === 1)
                  }
                  title={
                    member.role === 'owner' && owners.length === 1
                      ? 'A trip needs at least one owner'
                      : member.user === currentUserId
                        ? 'Leave this trip'
                        : 'Remove from the trip'
                  }
                  onClick={() => act(() => removeMember(member.id))}
                  className="h-8 rounded-lg border border-border-strong px-2 text-[12px] text-text-4 hover:text-danger-text disabled:opacity-30"
                >
                  {member.user === currentUserId ? 'Leave' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>

        {invites.length > 0 && (
          <ul className="mt-1 divide-y divide-border">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-3">
                  {invite.email}
                  <span className="ml-1.5 text-[11px] text-text-4">
                    invited as {invite.role} · waiting for them to register
                  </span>
                </span>
                {isOwner && (
                  <button
                    disabled={busy}
                    onClick={() => act(() => revokeInvite(invite.id))}
                    className="h-8 rounded-lg border border-border-strong px-2 text-[12px] text-text-4 hover:text-danger-text"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their email"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border-strong bg-field px-2.5 text-[13px] text-text outline-none focus:border-accent"
            />
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as TripMembersRoleOptions)
              }
              className="h-9 rounded-lg border border-border-strong bg-field px-2 text-[12.5px] text-text"
            >
              {ROLES.filter((r) => r !== 'owner').map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              disabled={busy || !email.includes('@')}
              onClick={() => void invite()}
              className="h-9 rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent disabled:opacity-40"
            >
              Invite
            </button>
          </div>
        )}
        <p className="mt-1.5 text-[11.5px] text-text-4">{ROLE_HELP[role]}</p>

        <div className="mt-5 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
          Public link
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <button
            role="switch"
            aria-checked={shareEnabled}
            disabled={!isOwner || busy}
            onClick={() =>
              act(async () => {
                await setShareEnabled(trip.id, !shareEnabled);
                setEnabled(!shareEnabled);
              })
            }
            className={`flex h-7 w-12 flex-none items-center rounded-full p-[3px] transition-colors disabled:opacity-40 ${
              shareEnabled
                ? 'justify-end bg-accent'
                : 'justify-start bg-control'
            }`}
          >
            <span className="h-[22px] w-[22px] rounded-full bg-[oklch(0.97_0.005_250)]" />
          </button>
          <span className="text-[13px] text-text-2">
            {shareEnabled
              ? 'Anyone with the link can read this trip'
              : 'Off — the link returns nothing'}
          </span>
        </div>

        {shareEnabled && (
          <>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border-strong bg-field px-2.5 font-mono text-[12px] text-text-2"
              />
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(shareUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
                className="h-9 rounded-lg border border-border-strong px-3 text-[12.5px] text-text-2 hover:bg-control"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              {isOwner && (
                <button
                  disabled={busy}
                  title="Invalidates the old link"
                  onClick={() =>
                    act(async () => {
                      setToken(await regenerateShareToken(trip.id));
                    })
                  }
                  className="h-9 rounded-lg border border-border-strong px-3 text-[12.5px] text-text-2 hover:bg-control"
                >
                  New link
                </button>
              )}
            </div>
            <p className="mt-2 rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-[12px] text-warn-text">
              A public link shows the route, the stops and{' '}
              <strong>only blocks marked public</strong> —{' '}
              {publicBlockCount === 0
                ? 'and none of yours are, so it will show the plan and nothing else'
                : `${publicBlockCount} of yours ${publicBlockCount === 1 ? 'is' : 'are'}`}
              . Notes, links, files and photos default to trip-only, and prices
              never leave the trip at all.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
