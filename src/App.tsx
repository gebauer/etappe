import { useAuth } from './hooks/useAuth';
import { logout } from './lib/auth';
import { LoginForm } from './components/LoginForm';
import { TripList } from './components/TripList';

export default function App() {
  const { isLoggedIn, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-lg font-semibold">Etappe</span>
        {isLoggedIn && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">{user?.email}</span>
            <button onClick={logout} className="text-slate-500 underline">
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="px-6 pb-16">
        {isLoggedIn ? <TripList /> : <LoginForm />}
      </main>
    </div>
  );
}
