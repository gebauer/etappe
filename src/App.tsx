import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { logout } from './lib/auth';
import { LoginForm } from './components/LoginForm';
import { TripList } from './components/TripList';
import { TripEditor } from './components/TripEditor';

export default function App() {
  const { isLoggedIn, user } = useAuth();
  const [tripId, setTripId] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          {isLoggedIn && tripId && (
            <button
              onClick={() => setTripId(null)}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← Trips
            </button>
          )}
          <span className="text-lg font-semibold">Etappe</span>
        </div>
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

      <main className="min-h-0 flex-1">
        {!isLoggedIn ? (
          <LoginForm />
        ) : tripId ? (
          <TripEditor tripId={tripId} />
        ) : (
          <TripList onOpen={setTripId} />
        )}
      </main>
    </div>
  );
}
