import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { logout } from './lib/auth';
import { LoginForm } from './components/LoginForm';
import { TripList } from './components/TripList';
import { TripEditor } from './components/TripEditor';

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

export default function App() {
  const { isLoggedIn, user } = useAuth();
  const [tripId, setTripId] = useState<string | null>(null);
  const [sharedCapture, setSharedCapture] = useState<string | null>(null);

  useEffect(() => {
    setSharedCapture(readSharedCapture());
  }, []);

  // The trip editor owns the whole viewport and renders its own 52px header
  // (WORK 12.6) — this chrome is only for the login and trip-list screens.
  const inEditor = isLoggedIn && !!tripId;

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      {!inEditor && (
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <span className="text-lg font-semibold">Etappe</span>
          {isLoggedIn && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">{user?.email}</span>
              <button
                onClick={() => {
                  setTripId(null);
                  logout();
                }}
                className="text-slate-500 underline"
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
              <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
                Pick a trip to save your share to.
              </p>
            )}
            <TripList onOpen={setTripId} />
          </div>
        )}
      </main>
    </div>
  );
}
