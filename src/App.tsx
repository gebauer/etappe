import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { logout } from './lib/auth';
import { LoginForm } from './components/LoginForm';
import { AccountPanel } from './components/AccountPanel';
import { TripList } from './components/TripList';
import { TripEditor } from './components/TripEditor';
import { ShareView } from './components/ShareView';

/** The PWA share_target action (BUILD §6.4, public/manifest.json): Android's
 * share sheet navigates here with title/text/url query params. Read once and
 * clear the URL immediately — no router needed for a single one-shot path
 * (see WORK.md for why introducing one wasn't worth it for this alone). */
function readSharedCapture(): string | null {
  if (window.location.pathname !== '/share-target') return null;
  const params = new URLSearchParams(window.location.search);
  const guess = params.get('url') || params.get('text') || params.get('title');
  window.history.replaceState(null, '', '/');
  return guess?.trim() || null;
}

/** /share/<token> is public — no auth gate, no chrome, an unauthenticated
 * reader must reach it directly (WORK 9.2 / 16.6). */
function shareToken(): string | null {
  const m = /^\/share\/([^/]+)\/?$/.exec(window.location.pathname);
  return m ? m[1]! : null;
}

/** The token is fixed for the life of a page load — this only ever runs
 * before AppShell's hooks the first time, never conditionally between
 * renders of the same tree, so it doesn't trip the rules-of-hooks lint. */
export default function App() {
  const token = shareToken();
  return token ? <ShareView token={token} /> : <AppShell />;
}

const OPEN_TRIP_KEY = 'etappe.openTrip';

function AppShell() {
  const { isLoggedIn, user } = useAuth();
  // Remember which trip was open across a reload (WORK 10.3): a PWA that
  // reloads offline should come back to the trip you were reading, not the
  // trip list it can't fetch. Client-only state otherwise — there is no
  // per-trip URL.
  const [tripId, setTripIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(OPEN_TRIP_KEY);
    } catch {
      return null;
    }
  });
  const setTripId = (id: string | null) => {
    setTripIdState(id);
    try {
      if (id) localStorage.setItem(OPEN_TRIP_KEY, id);
      else localStorage.removeItem(OPEN_TRIP_KEY);
    } catch {
      /* private mode — the session still works, just no resume */
    }
  };
  const [sharedCapture, setSharedCapture] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setSharedCapture(readSharedCapture());
  }, []);

  // The trip editor owns the whole viewport and renders its own 52px header
  // (WORK 12.6) — this chrome is only for the login and trip-list screens.
  const inEditor = isLoggedIn && !!tripId;

  return (
    <div className="flex h-screen flex-col bg-bg font-sans text-text">
      {!inEditor && isLoggedIn && (
        <header className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2">
          <span className="text-lg font-semibold">Etappe</span>
          {isLoggedIn && (
            <div className="flex items-center gap-3 text-[13px]">
              <span className="text-text-4">{user?.email}</span>
              <button
                onClick={() => setAccountOpen(true)}
                className="text-text-3 underline hover:text-text"
              >
                Account
              </button>
              <button
                onClick={() => {
                  setTripId(null);
                  logout();
                }}
                className="text-text-3 underline hover:text-text"
              >
                Sign out
              </button>
            </div>
          )}
        </header>
      )}

      <main className="min-h-0 flex-1">
        {!isLoggedIn ? (
          <LoginForm />
        ) : tripId ? (
          <TripEditor
            tripId={tripId}
            onBack={() => setTripId(null)}
            sharedCapture={sharedCapture}
            onSharedCaptureConsumed={() => setSharedCapture(null)}
          />
        ) : (
          <div className="flex h-full flex-col">
            {sharedCapture && (
              <p className="border-b border-warn-border bg-warn-bg px-4 py-2 text-center text-[13px] text-warn-text">
                Pick a trip to save your share to.
              </p>
            )}
            <TripList onOpen={setTripId} />
          </div>
        )}
      </main>

      {accountOpen && (
        <AccountPanel
          email={user?.email ?? ''}
          onClose={() => setAccountOpen(false)}
          onSignOut={() => {
            setTripId(null);
            logout();
          }}
        />
      )}
    </div>
  );
}
