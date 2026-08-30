import { type KeyboardEvent } from 'react';
import { formatDuration } from '../lib/format';
import type { LegsResponse } from '../types/pb';
import type { LegPatch } from '../lib/pb-stops';

interface Props {
  leg?: LegsResponse;
  effectiveDuration?: number;
  onUpdate: (patch: LegPatch) => void;
  onReroute: () => void;
  onSetManual: (durationMin: number) => void;
}

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

export function LegRow({
  leg,
  effectiveDuration,
  onUpdate,
  onReroute,
  onSetManual,
}: Props) {
  const isCar = leg?.mode === 'car';
  const isManual = leg?.routing_source === 'manual';
  return (
    <div className="flex items-center gap-3 px-4 py-1 pl-20 text-xs text-slate-400">
      <span className="inline-block h-4 border-l border-dashed border-slate-300" />
      {leg && isManual ? (
        <label className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            defaultValue={leg.duration_min || ''}
            placeholder="min"
            onBlur={(e) =>
              onUpdate({ duration_min: Number(e.target.value) || 0 })
            }
            onKeyDown={commitOnEnter}
            className="w-14 rounded border border-slate-200 px-1 py-0.5 text-slate-700"
          />
          min
        </label>
      ) : (
        <span className="text-slate-500">
          {effectiveDuration != null ? formatDuration(effectiveDuration) : '—'}
        </span>
      )}
      <span>{leg?.mode ?? 'car'}</span>

      {isCar && isManual && (
        <button
          onClick={onReroute}
          title="Routing didn't run for this leg — re-run it now. If it's a POI a car can't reach, set an access point in the stop's inspector."
          className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-700 hover:bg-amber-100"
        >
          ⟳ route
        </button>
      )}
      {isCar && !isManual && leg && (
        <button
          onClick={() => onSetManual(leg.duration_min)}
          title="Enter the drive time by hand instead of routing"
          className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-500 hover:bg-slate-50"
        >
          ✎ manual
        </button>
      )}

      {leg?.mode === 'car' && (
        <>
          <select
            defaultValue={leg.surface || ''}
            onChange={(e) =>
              onUpdate({ surface: e.target.value as LegPatch['surface'] })
            }
            className="rounded border border-slate-200 px-1 py-0.5"
          >
            <option value="">surface…</option>
            <option value="paved">paved</option>
            <option value="gravel">gravel</option>
            <option value="froad">F-road</option>
          </select>
          <label className="flex items-center gap-1">
            buffer%
            <input
              type="number"
              min={0}
              defaultValue={leg.buffer_override_pct || ''}
              onBlur={(e) =>
                onUpdate({ buffer_override_pct: Number(e.target.value) || 0 })
              }
              onKeyDown={commitOnEnter}
              className="w-12 rounded border border-slate-200 px-1 py-0.5"
            />
          </label>
        </>
      )}
    </div>
  );
}
