import { useEffect, useRef, useState, type FormEvent } from 'react';
import { login, register, requestPasswordReset } from '../lib/auth';
import {
  loadLoginPhotos,
  captionPlace,
  captionMeta,
  type LoginPhoto,
} from '../lib/login-photos';

type Mode = 'login' | 'register';

const ROTATE_MS = 7000;
const FADE_MS = 900;

/** The one screen before any trip exists. Full-bleed travel photograph, the
 * form floating over its left third — the sign-in is where the product gets
 * to make you want to go somewhere. Photos come from a supplied folder
 * (`public/login-photos/`), never user data — see the handoff's "Sign-in". */
export function LoginForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [photos, setPhotos] = useState<LoginPhoto[]>([]);
  const [idx, setIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    let live = true;
    loadLoginPhotos().then((p) => {
      if (!live) return;
      setPhotos(p);
      // One photo is chosen per visit, not always the first.
      if (p.length > 1) setIdx(Math.floor(Math.random() * p.length));
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  // One photo per visit; while the page stays open they crossfade every 7 s.
  // `prefers-reduced-motion` holds the first — the interval simply never runs.
  useEffect(() => {
    if (photos.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      const from = idxRef.current;
      setPrevIdx(from);
      setIdx((from + 1) % photos.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [photos.length]);

  useEffect(() => {
    if (prevIdx === null) return;
    const t = setTimeout(() => setPrevIdx(null), FADE_MS);
    return () => clearTimeout(t);
  }, [prevIdx]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError('Enter your email first, then tap "Forgot password?".');
      return;
    }
    try {
      await requestPasswordReset(email);
      setNotice('Reset link sent — check your email.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send a reset link.',
      );
    }
  }

  const cur = photos[idx];
  const outgoing = prevIdx !== null ? photos[prevIdx] : undefined;
  const next =
    photos.length > 1 ? photos[(idx + 1) % photos.length] : undefined;

  const FIELD =
    'h-[46px] w-full rounded-[10px] border border-[oklch(0.32_0.012_250/0.9)] bg-[oklch(0.175_0.012_250/0.8)] px-[14px] text-[14.5px] text-text outline-none placeholder:text-text-4 focus:border-accent';
  const LINK =
    'text-accent transition-colors hover:text-[oklch(0.84_0.11_215)]';

  const caption = cur && (
    <>
      {captionMeta(cur) && (
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[oklch(0.80_0.06_215)]">
          {captionMeta(cur)}
        </div>
      )}
      <div
        className="mt-1 text-[17px] font-semibold text-text"
        style={{ textShadow: '0 2px 14px oklch(0.11 0.02 250 / 0.75)' }}
      >
        {captionPlace(cur)}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 inline-flex gap-[5px]">
          {photos.map((_, i) => (
            <span
              key={i}
              className="h-[3px] w-[18px] rounded-[2px]"
              style={{
                background:
                  i === idx
                    ? 'oklch(0.94 0.01 250)'
                    : 'oklch(0.94 0.01 250 / 0.34)',
              }}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg font-sans text-text">
      {/* Photo rotation. Only the current and the one fading out are in the
          DOM; `next` is a hidden <img> purely to warm the cache. */}
      {cur && (
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={cur.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {outgoing && (
            <img
              key={`${outgoing.url}-${idx}`}
              src={outgoing.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover animate-login-photo-out"
            />
          )}
          {next && <img src={next.url} alt="" className="hidden" />}
        </div>
      )}

      {/* Two gradients: one carries the text column, one settles the far
          corner. Both inert. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 78% 20%, transparent 30%, oklch(0.17 0.012 250 / 0.62)), linear-gradient(to right, oklch(0.17 0.012 250 / 0.82), oklch(0.17 0.012 250 / 0.15) 62%)',
        }}
      />

      {/* Brand */}
      <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-[9px] desktop:left-[34px] desktop:top-[28px]">
        <span
          className="h-[9px] w-[9px] rounded-full bg-accent"
          style={{ boxShadow: '0 0 0 4px oklch(0.72 0.13 215 / 0.18)' }}
        />
        <span className="text-[19px] font-semibold tracking-[-0.01em]">
          Etappe
        </span>
      </div>

      {/* Copy + form, one glass column over the left third */}
      <div className="absolute inset-0 flex flex-col justify-center overflow-y-auto px-6 py-16 desktop:inset-y-0 desktop:left-[34px] desktop:right-auto desktop:w-[406px] desktop:px-0 desktop:py-0">
        {/* Headline and subhead sit directly on the gradient — the one glass
            surface in this column belongs to the form. */}
        <div style={{ textShadow: '0 2px 18px oklch(0.11 0.02 250 / 0.7)' }}>
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-text desktop:text-[38px]">
            Where are you going next?
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.55] text-text-2">
            {mode === 'login'
              ? 'Sign in to pick up the itinerary you left open.'
              : 'Create an account to start planning your first trip.'}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-[22px] rounded-2xl border border-[oklch(0.32_0.012_250/0.85)] bg-[oklch(0.20_0.013_250/0.78)] p-[26px] shadow-[0_24px_60px_oklch(0.08_0.02_250/0.55)] backdrop-blur-[18px]"
        >
          <div className="flex flex-col gap-2.5">
            <input
              type="email"
              required
              autoComplete="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD}
            />
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              aria-label="Password"
              placeholder={
                mode === 'register' ? 'Password (min 8 characters)' : 'Password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-1 h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-on-accent transition-colors hover:bg-[oklch(0.80_0.12_215)] disabled:opacity-50"
            >
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-[12.5px] text-danger-text">{error}</p>
          )}
          {notice && <p className="mt-3 text-[12.5px] text-text-2">{notice}</p>}

          <div className="mt-3.5 flex items-baseline justify-between gap-3 text-[12.5px] text-text-3">
            <span>
              {mode === 'login' ? 'Need an account? ' : 'Have an account? '}
              <button
                type="button"
                className={LINK}
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError(null);
                  setNotice(null);
                }}
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </span>
            {mode === 'login' && (
              <button type="button" className={LINK} onClick={forgot}>
                Forgot password?
              </button>
            )}
          </div>
        </form>

        {/* Phone: the caption moves under the form. */}
        {caption && <div className="mt-6 desktop:hidden">{caption}</div>}
      </div>

      {/* Desktop: caption bottom-right, over the photo. */}
      {caption && (
        <div className="pointer-events-none absolute bottom-[26px] right-[30px] hidden text-right desktop:block">
          {caption}
        </div>
      )}
    </div>
  );
}
