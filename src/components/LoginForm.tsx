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

  const FIELD =
    'h-[38px] rounded-lg border border-border-strong bg-field px-3 text-[13px] text-text outline-none placeholder:text-text-4 focus:border-accent';

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border-strong bg-surface-2 p-6 font-sans text-text shadow-card"
    >
      <h1 className="text-xl font-semibold text-text">
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </h1>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={FIELD}
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={FIELD}
      />
      {error && <p className="text-[13px] text-danger-text">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-[38px] rounded-lg bg-accent px-3 font-medium text-on-accent disabled:opacity-50"
      >
        {mode === 'login' ? 'Sign in' : 'Register'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
        }}
        className="text-[13px] text-text-3 underline hover:text-text"
      >
        {mode === 'login'
          ? 'Need an account? Register'
          : 'Have an account? Sign in'}
      </button>
    </form>
  );
}
