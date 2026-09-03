import { useState } from 'react';
import { pb } from '../lib/pb';
import {
  ROUTING_ENGINES,
  LINK_OUT_APPS,
  readUserSettings,
  saveUserSettings,
  saveRoutingKey,
} from '../lib/user-settings';

const ENGINE_BY_ID = new Map(ROUTING_ENGINES.map((e) => [e.id, e]));

/**
 * Account settings (WORK 19.1) — the two routing choices, which are
 * deliberately different in scope:
 *
 * - **Routing engine + key** is read from the *trip owner*, so a shared
 *   trip shows one set of durations and the owner pays the quota. Changing
 *   it re-routes the open trip, because every stored leg still holds the
 *   old engine's numbers.
 * - **Link-out app** only affects this user's own `↗` clicks, so it can
 *   differ between members of the same trip.
 */
export function AccountPanel({
  email,
  onClose,
  onSignOut,
  /** Present only when a trip is open — re-routes it after an engine
   * change. Resolves with a short summary for the caller to announce. */
  onEngineChanged,
}: {
  email: string;
  onClose: () => void;
  onSignOut: () => void;
  onEngineChanged?: () => Promise<void> | void;
}) {
  const initial = readUserSettings(pb);
  const [engine, setEngine] = useState(initial.routingBackend);
  const [providers, setProviders] = useState<string[]>(
    initial.routingProviders,
  );
  const [linkOut, setLinkOut] = useState(initial.linkOut);
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({});
  const [nick, setNick] = useState(
    (pb.authStore.record?.name as string | undefined) ?? '',
  );
  const savedNick = (pb.authStore.record?.name as string | undefined) ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const chooseEngine = (id: string) =>
    guard(async () => {
      // No selecting an engine whose key hasn't been stored (and validated —
      // saveRoutingKey probes it). Otherwise `/api/route` silently falls
      // back to the server default and every leg quietly stays on it.
      const eng = ENGINE_BY_ID.get(id);
      if (id && eng?.needsKey && !providers.includes(id)) {
        throw new Error(`Add a working ${eng.label} key first.`);
      }
      setEngine(id);
      await saveUserSettings(pb, { routing_backend: id });
      await pb.collection('users').authRefresh();
      // Every stored leg still holds the previous engine's duration — and
      // `route_cache` keys on the backend, so nothing stale is reused.
      await onEngineChanged?.();
    });

  const storeKey = (provider: string) =>
    guard(async () => {
      const key = (keyDraft[provider] ?? '').trim();
      if (!key) return;
      setProviders(await saveRoutingKey(pb, provider, key));
      setKeyDraft((d) => ({ ...d, [provider]: '' }));
      await pb.collection('users').authRefresh();
    });

  const clearKey = (provider: string) =>
    guard(async () => {
      setProviders(await saveRoutingKey(pb, provider, null));
      await pb.collection('users').authRefresh();
    });

  const chooseLinkOut = (id: string) =>
    guard(async () => {
      setLinkOut(id);
      await saveUserSettings(pb, { link_out: id });
      await pb.collection('users').authRefresh();
    });

  const saveNick = () =>
    guard(async () => {
      const id = pb.authStore.record?.id;
      if (!id) return;
      await pb.collection('users').update(id, { name: nick.trim() });
      await pb.collection('users').authRefresh();
      setNick((pb.authStore.record?.name as string | undefined) ?? '');
    });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-scrim p-6 font-sans"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-strong bg-surface-2 p-5 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Account</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-4 hover:text-text-2"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 truncate font-mono text-[12px] text-text-4">
          {email}
        </p>

        <div className="mt-5 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
          Nickname
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-text-4">
          Shown on wishlist places you add. Places you&rsquo;ve already added
          keep the name they were saved with.
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="e.g. Jan"
            maxLength={40}
            className="h-[30px] min-w-0 flex-1 rounded-lg border border-border-strong bg-field px-2.5 text-[13px] text-text outline-none placeholder:text-text-4 focus:border-accent"
          />
          <button
            onClick={saveNick}
            disabled={busy || nick.trim() === savedNick.trim()}
            className="h-[30px] flex-none rounded-lg border border-border-strong px-2.5 text-[12px] text-text-2 hover:bg-control hover:text-text disabled:opacity-40"
          >
            Save
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-danger-border px-3 py-2 text-[12.5px] text-danger-text">
            {error}
          </p>
        )}

        <div className="mt-5 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
          Routing engine
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-text-4">
          Computes every leg&rsquo;s drive time. On a shared trip the
          <strong className="font-medium text-text-3">
            {' '}
            owner&rsquo;s
          </strong>{' '}
          engine and key are used for everyone — that is the price of sharing.
          Changing this re-routes the open trip.
        </p>

        <div className="mt-2.5 flex flex-col gap-1.5">
          <EngineRow
            id=""
            label="Server default"
            hint="Whatever this Etappe install is configured with."
            active={engine === ''}
            onSelect={() => chooseEngine('')}
            busy={busy}
          />
          {ROUTING_ENGINES.map((e) => (
            <EngineRow
              key={e.id}
              id={e.id}
              label={e.label}
              hint={e.hint}
              active={engine === e.id}
              onSelect={() => chooseEngine(e.id)}
              busy={busy}
              keyState={
                e.needsKey
                  ? {
                      stored: providers.includes(e.id),
                      draft: keyDraft[e.id] ?? '',
                      onDraft: (v) => setKeyDraft((d) => ({ ...d, [e.id]: v })),
                      onStore: () => storeKey(e.id),
                      onClear: () => clearKey(e.id),
                    }
                  : undefined
              }
            />
          ))}
        </div>

        <div className="mt-5 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
          Open routes in
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-text-4">
          Where the ↗ links go. Yours alone — everyone on a trip can pick a
          different one.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {LINK_OUT_APPS.map((a) => (
            <button
              key={a.id}
              onClick={() => chooseLinkOut(a.id)}
              disabled={busy}
              className={`h-8 rounded-lg border px-3 text-[12.5px] ${
                linkOut === a.id
                  ? 'border-accent bg-accent-surface text-text'
                  : 'border-border-strong text-text-2 hover:bg-control'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <button
            onClick={onSignOut}
            className="h-[34px] rounded-lg border border-border-strong px-3 text-[13px] text-text-2 hover:bg-control hover:text-text"
          >
            Sign out
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="h-[34px] rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EngineRow({
  label,
  hint,
  active,
  onSelect,
  busy,
  keyState,
}: {
  id: string;
  label: string;
  hint: string;
  active: boolean;
  onSelect: () => void;
  busy: boolean;
  keyState?: {
    stored: boolean;
    draft: string;
    onDraft: (v: string) => void;
    onStore: () => void;
    onClear: () => void;
  };
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        active ? 'border-accent bg-accent-surface' : 'border-border-strong'
      }`}
    >
      <button
        onClick={onSelect}
        disabled={busy}
        className="flex w-full items-center gap-2 text-left"
      >
        <span
          className={`h-[13px] w-[13px] flex-none rounded-full border ${
            active ? 'border-accent bg-accent' : 'border-text-4'
          }`}
        />
        <span className="text-[13px] font-medium">{label}</span>
        {keyState?.stored && (
          <span className="ml-auto flex-none rounded-md bg-field px-1.5 py-0.5 text-[10.5px] text-text-3">
            key stored
          </span>
        )}
      </button>
      <p className="mt-1 pl-[21px] text-[11.5px] leading-snug text-text-4">
        {hint}
      </p>

      {keyState && (
        <div className="mt-2 flex items-center gap-1.5 pl-[21px]">
          <input
            type="password"
            value={keyState.draft}
            onChange={(e) => keyState.onDraft(e.target.value)}
            placeholder={keyState.stored ? 'Replace key…' : 'API key'}
            className="h-[30px] min-w-0 flex-1 rounded-lg border border-border-strong bg-field px-2.5 font-mono text-[12px] text-text outline-none placeholder:text-text-4 focus:border-accent"
          />
          <button
            onClick={keyState.onStore}
            disabled={busy || !keyState.draft.trim()}
            className="h-[30px] flex-none rounded-lg border border-border-strong px-2.5 text-[12px] text-text-2 hover:bg-control hover:text-text disabled:opacity-40"
          >
            Save
          </button>
          {keyState.stored && (
            <button
              onClick={keyState.onClear}
              disabled={busy}
              aria-label={`Forget the ${label} key`}
              title={`Forget the ${label} key`}
              className="h-[30px] w-[30px] flex-none rounded-lg border border-border-strong text-[12px] text-text-4 hover:bg-[oklch(0.26_0.03_25)] hover:text-[oklch(0.80_0.11_25)]"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
