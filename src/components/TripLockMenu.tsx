import { useEffect, useRef, useState } from 'react';
import { lockChipLabel, type TripLock } from '../lib/trip-lock';

/**
 * The trip lock's one control (author request 2026-09-09): a padlock in the
 * header that both *shows* the lock and *is* the way out of it.
 *
 * That pairing is the whole point. The failure this feature has to avoid is
 * someone locking a trip, forgetting, and reading the refusals as the app
 * being broken — so the state is never hidden in a settings dialog, and the
 * remedy is the thing you are already looking at when you notice it. Same
 * shape as the header's uncategorized ⚠ chip, which is already a persistent
 * indicator that doubles as the button to resolve what it reports.
 *
 * Only rendered for someone who could otherwise edit the itinerary: a
 * `viewer`/`contributor` is already read-only for a different reason, and
 * two overlapping "you can't edit this" explanations is worse than one.
 */
export function TripLockMenu({
  lock,
  onChange,
}: {
  lock: TripLock;
  onChange: (lock: TripLock) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const chip = lockChipLabel(lock);

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((v) => !v)}
        title={
          chip
            ? `${chip} — click to change or unlock`
            : 'Lock this trip against accidental edits'
        }
        aria-label={chip ? `${chip}. Change or unlock` : 'Lock this trip'}
        className={
          chip
            ? // Locked: an amber chip carrying its own label, deliberately
              // as loud as the ⚠ counter. It has to be noticed.
              'h-[30px] whitespace-nowrap rounded-lg border border-warn-border bg-warn-bg px-2.5 text-xs text-warn-text'
            : // Open: a quiet icon button, same weight as ⚙ — present so the
              // lock is discoverable, not competing with the trip itself.
              'flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-control text-[14px] text-text-2 hover:bg-control-hover'
        }
      >
        {chip ? `🔒 ${chip}` : '🔓'}
      </button>

      {open && (
        <div className="absolute right-0 top-[34px] z-40 w-[280px] rounded-[11px] border border-border-strong bg-surface-2 p-3 text-text shadow-card">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
            Lock trip
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-text-3">
            Guards against accidental edits. Anyone who can edit the trip can
            lift it again from here — it is not a permission.
          </p>
          <div className="mt-2.5 flex flex-col gap-1">
            <LockOption
              active={lock === ''}
              label="🔓 Open"
              hint="Everything editable."
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            />
            <LockOption
              active={lock === 'days'}
              label="🔒 Days locked"
              hint="Days can't be added or removed. Stops, times and notes stay editable."
              onClick={() => {
                onChange('days');
                setOpen(false);
              }}
            />
            <LockOption
              active={lock === 'all'}
              label="🔒 Locked"
              hint="The whole itinerary is frozen. The wishlist still takes new ideas."
              onClick={() => {
                onChange('all');
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LockOption({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-2.5 py-2 text-left ${
        active
          ? 'border-accent bg-accent-surface'
          : 'border-transparent hover:bg-control'
      }`}
    >
      <span className="block text-[12.5px] text-text">{label}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-text-4">
        {hint}
      </span>
    </button>
  );
}
