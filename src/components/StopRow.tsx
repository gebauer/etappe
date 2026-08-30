import { type KeyboardEvent, type ReactNode } from 'react';
import { formatClock, type StopTiming, type Warning } from '../lib/cascade';
import type { StopsResponse } from '../types/pb';
import type { StopPatch } from '../lib/pb-stops';

interface Props {
  stop: StopsResponse;
  timing?: StopTiming;
  warnings: Warning[];
  dragHandle?: ReactNode;
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (additive: boolean) => void;
  onHover?: (hovering: boolean) => void;
  onUpdate: (patch: StopPatch) => void;
  onDelete: () => void;
}

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

export function StopRow({
  stop,
  timing,
  warnings,
  dragHandle,
  selected,
  hovered,
  onSelect,
  onHover,
  onUpdate,
  onDelete,
}: Props) {
  const anchored = !!stop.anchor_time;

  return (
    <div
      onClick={(e) => onSelect?.(e.metaKey || e.ctrlKey)}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`flex items-start gap-2 border-b border-slate-100 px-4 py-2 ${
        selected
          ? 'bg-sky-50 ring-1 ring-inset ring-sky-300'
          : hovered
            ? 'bg-slate-50'
            : ''
      }`}
    >
      {dragHandle}
      {/* time column */}
      <div className="w-16 shrink-0 pt-1 text-right">
        <div
          className={`flex items-center justify-end gap-1 text-sm ${
            anchored ? 'font-semibold text-slate-900' : 'text-slate-400'
          }`}
        >
          {anchored && <span title="Anchored to the clock">📌</span>}
          {timing ? formatClock(timing.arrival) : '—'}
        </div>
        {timing && timing.departure !== timing.arrival && (
          <div className="text-xs text-slate-300">
            {formatClock(timing.departure)}
          </div>
        )}
      </div>

      {/* main */}
      <div className="min-w-0 flex-1">
        <input
          defaultValue={stop.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== stop.title) onUpdate({ title: v });
          }}
          onKeyDown={commitOnEnter}
          className="w-full rounded bg-transparent text-sm font-medium text-slate-900 hover:bg-slate-50 focus:bg-white focus:outline focus:outline-1 focus:outline-slate-300"
        />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded bg-slate-100 px-1.5 py-0.5">
            {stop.kind}
          </span>

          <label className="flex items-center gap-1">
            dwell
            <input
              type="number"
              min={0}
              defaultValue={stop.dwell_override || ''}
              placeholder={timing ? String(timing.dwell) : ''}
              onBlur={(e) =>
                onUpdate({ dwell_override: Number(e.target.value) || 0 })
              }
              onKeyDown={commitOnEnter}
              className="w-14 rounded border border-slate-200 px-1 py-0.5"
            />
          </label>

          <label className="flex items-center gap-1">
            anchor
            <input
              type="time"
              defaultValue={stop.anchor_time}
              onBlur={(e) => onUpdate({ anchor_time: e.target.value })}
              className="rounded border border-slate-200 px-1 py-0.5"
            />
          </label>
          {anchored && (
            <select
              defaultValue={stop.anchor_type || 'arrival'}
              onChange={(e) =>
                onUpdate({
                  anchor_type: e.target.value as StopPatch['anchor_type'],
                })
              }
              className="rounded border border-slate-200 px-1 py-0.5"
            >
              <option value="arrival">arrival</option>
              <option value="departure">departure</option>
            </select>
          )}

          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              defaultChecked={stop.is_accommodation}
              onChange={(e) => onUpdate({ is_accommodation: e.target.checked })}
            />
            stay
          </label>
        </div>

        {warnings.length > 0 && (
          <div className="mt-1 text-xs text-amber-600">
            {warnings.map((w, i) => (
              <span key={i} className="mr-2">
                ⚠ {w.code}
                {w.deficitMin != null ? ` +${w.deficitMin}m` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        aria-label="Delete stop"
        className="shrink-0 pt-1 text-xs text-slate-300 hover:text-red-600"
      >
        ✕
      </button>
    </div>
  );
}
