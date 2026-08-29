import { useState, type FormEvent } from 'react';
import { login, register } from '../lib/auth';

type Mode = 'login' | 'register';

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-xl font-semibold text-slate-900">
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </h1>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded border border-slate-300 px-3 py-2"
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded border border-slate-300 px-3 py-2"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-50"
      >
        {mode === 'login' ? 'Sign in' : 'Register'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
        }}
        className="text-sm text-slate-500 underline"
      >
        {mode === 'login'
          ? 'Need an account? Register'
          : 'Have an account? Sign in'}
      </button>
    </form>
  );
}
