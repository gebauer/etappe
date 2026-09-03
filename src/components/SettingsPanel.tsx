import { useMemo, useState } from 'react';
import { CURRENCIES } from '../lib/currency';
import { KINDS, TAXONOMY, defaultDwellSeed, type Kind } from '../lib/taxonomy';
import type { TripSettingsPatch } from '../lib/pb-trips';
import type { TripsResponse } from '../types/pb';

/**
 * Trip settings (WORK 11.2) — the cascade assumptions and locale that were
 * fixed at trip creation with no UI to change them: car buffer, surface
 * multipliers, per-kind default dwells, timezone, currency. Members and the
 * public link live in `SharePanel`, not here.
 *
 * A local draft with one Save, not a write per keystroke — several numeric
 * fields, and a half-typed multiplier shouldn't re-run the cascade.
 */

const COMMON_TZ = [
  'Atlantic/Reykjavik',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Oslo',
  'Europe/Madrid',
  'America/New_York',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

function isValidTimezone(tz: string): boolean {
  if (!tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const SURFACES: { key: string; label: string; hint: string; def: number }[] = [
  { key: 'paved', label: 'Paved', hint: 'sealed road', def: 1 },
  { key: 'gravel', label: 'Gravel', hint: 'maintained unsealed', def: 1.3 },
  { key: 'froad', label: 'F-road', hint: 'highland track, in season', def: 2 },
];

const FIELD =
  'h-[34px] w-full rounded-lg border border-border-strong bg-field px-2.5 text-[13px] text-text outline-none focus:border-accent';

export function SettingsPanel({
  trip,
  onClose,
  onSave,
}: {
  trip: TripsResponse;
  onClose: () => void;
  onSave: (patch: TripSettingsPatch) => void;
}) {
  const seedDwell = useMemo(() => defaultDwellSeed(), []);
  const startMult = (trip.surface_multipliers ?? {}) as Record<string, number>;
  const startDwell = (trip.default_dwell ?? {}) as Record<string, number>;

  const [currency, setCurrency] = useState(trip.currency || 'EUR');
  const [timezone, setTimezone] = useState(trip.timezone || 'UTC');
  const [buffer, setBuffer] = useState(String(trip.car_buffer_pct ?? 15));
  const [mult, setMult] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SURFACES.map((s) => [s.key, String(startMult[s.key] ?? s.def)]),
    ),
  );
  const [dwell, setDwell] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      KINDS.map((k) => [k, String(startDwell[k] ?? seedDwell[k] ?? 0)]),
    ),
  );
  const [dwellOpen, setDwellOpen] = useState(false);

  const bufferNum = Number(buffer);
  const bufferOk =
    Number.isFinite(bufferNum) && bufferNum >= 0 && bufferNum <= 200;
  const multOk = SURFACES.every((s) => {
    const v = Number(mult[s.key]);
    return Number.isFinite(v) && v > 0;
  });
  const dwellOk = KINDS.every((k) => {
    const v = Number(dwell[k]);
    return Number.isFinite(v) && v >= 0;
  });
  const tzOk = isValidTimezone(timezone);
  const canSave = bufferOk && multOk && dwellOk && tzOk;

  function save() {
    if (!canSave) return;
    onSave({
      currency,
      timezone: timezone.trim(),
      car_buffer_pct: bufferNum,
      surface_multipliers: Object.fromEntries(
        SURFACES.map((s) => [s.key, Number(mult[s.key])]),
      ),
      default_dwell: Object.fromEntries(
        KINDS.map((k) => [k, Number(dwell[k])]),
      ),
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-scrim p-6 font-sans"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-strong bg-surface-2 p-5 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Trip settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-4 hover:text-text-2"
          >
            ✕
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-text-4">
          Cascade assumptions and locale. Sharing and members are on the Share
          panel.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
              Currency
            </span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`${FIELD} mt-1 [color-scheme:dark]`}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
              Car buffer %
            </span>
            <input
              type="number"
              min={0}
              max={200}
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
              className={`${FIELD} mt-1 font-mono ${
                bufferOk ? '' : 'border-danger-border'
              }`}
            />
          </label>
          <label className="col-span-2 block">
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
              Timezone
            </span>
            <input
              list="settings-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="IANA name, e.g. Atlantic/Reykjavik"
              className={`${FIELD} mt-1 font-mono ${
                tzOk ? '' : 'border-danger-border'
              }`}
            />
            <datalist id="settings-tz">
              {COMMON_TZ.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            {!tzOk && (
              <span className="mt-1 block text-[11px] text-danger-text">
                Not a timezone this browser recognises.
              </span>
            )}
          </label>
        </div>

        <div className="mt-4 text-[10.5px] uppercase tracking-[0.08em] text-text-4">
          Surface multipliers
        </div>
        <p className="mt-1 text-[11.5px] text-text-4">
          Multiplies a car leg&rsquo;s routed time by surface. 1.0 = no change.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {SURFACES.map((s) => {
            const v = Number(mult[s.key]);
            const ok = Number.isFinite(v) && v > 0;
            return (
              <label key={s.key} className="block">
                <span className="text-[12px] text-text-2">{s.label}</span>
                <span className="block text-[10.5px] text-text-5">
                  {s.hint}
                </span>
                <input
                  type="number"
                  step="0.05"
                  min={0.1}
                  value={mult[s.key]}
                  onChange={(e) =>
                    setMult((m) => ({ ...m, [s.key]: e.target.value }))
                  }
                  className={`${FIELD} mt-1 font-mono ${
                    ok ? '' : 'border-danger-border'
                  }`}
                />
              </label>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-border-strong">
          <button
            onClick={() => setDwellOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left"
          >
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
              Default dwell per kind
            </span>
            <span className="text-text-4">{dwellOpen ? '▾' : '▸'}</span>
          </button>
          {dwellOpen && (
            <div className="border-t border-border px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-text-4">
                  Minutes at a stop of this kind, unless it has its own timing
                  or activities.
                </span>
                <button
                  onClick={() =>
                    setDwell(
                      Object.fromEntries(
                        KINDS.map((k) => [k, String(seedDwell[k] ?? 0)]),
                      ),
                    )
                  }
                  className="h-6 flex-none rounded-md border border-border-strong px-2 text-[11px] text-text-2 hover:text-text"
                >
                  Reset
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {KINDS.map((k) => (
                  <label
                    key={k}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0 truncate text-[12px] text-text-2">
                      {TAXONOMY[k as Kind].label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={dwell[k]}
                      onChange={(e) =>
                        setDwell((d) => ({ ...d, [k]: e.target.value }))
                      }
                      className="h-[28px] w-16 flex-none rounded-md border border-border-strong bg-field px-1.5 text-right font-mono text-[12px] text-text outline-none focus:border-accent"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-[34px] rounded-lg px-3 text-[13px] text-text-3 hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="h-[34px] rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
