import { type KeyboardEvent } from 'react';
import { KINDS, TAXONOMY } from '../lib/taxonomy';
import type { StopsResponse } from '../types/pb';
import type { StopPatch } from '../lib/pb-stops';

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

const field = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';
const label = 'block text-xs font-medium text-slate-500';

/** Full editor for a selected stop (BUILD §6/§9): every setting editable,
 * including coordinates set by hand. Keyed by stop id+updated upstream so the
 * uncontrolled inputs refresh after external changes. */
export function StopInspector({
  stop,
  onUpdate,
  onDelete,
  onZoom,
}: {
  stop: StopsResponse;
  onUpdate: (patch: StopPatch) => void;
  onDelete: () => void;
  onZoom: () => void;
}) {
  const hasCoords = !!stop.lat && !!stop.lon;
  return (
    <div className="space-y-3">
      <label>
        <span className={label}>Title</span>
        <input
          defaultValue={stop.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== stop.title) onUpdate({ title: v });
          }}
          onKeyDown={commitOnEnter}
          className={field}
        />
      </label>

      <label>
        <span className={label}>Kind</span>
        <select
          defaultValue={stop.kind}
          onChange={(e) =>
            onUpdate({
              kind: e.target.value as StopPatch['kind'],
              kind_confirmed: true,
            })
          }
          className={field}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {TAXONOMY[k].label}
            </option>
          ))}
        </select>
        {!stop.kind_confirmed && (
          <span className="text-xs text-amber-600">
            auto-detected — confirm?
          </span>
        )}
      </label>

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className={label}>Latitude</span>
          <input
            type="number"
            step="any"
            defaultValue={stop.lat || ''}
            onBlur={(e) => onUpdate({ lat: Number(e.target.value) || 0 })}
            onKeyDown={commitOnEnter}
            className={field}
          />
        </label>
        <label className="flex-1">
          <span className={label}>Longitude</span>
          <input
            type="number"
            step="any"
            defaultValue={stop.lon || ''}
            onBlur={(e) => onUpdate({ lon: Number(e.target.value) || 0 })}
            onKeyDown={commitOnEnter}
            className={field}
          />
        </label>
        <button
          onClick={onZoom}
          disabled={!hasCoords}
          title="Zoom the map to this point"
          className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
        >
          ⤢
        </button>
      </div>

      <label>
        <span className={label}>Address</span>
        <input
          defaultValue={stop.address}
          onBlur={(e) => onUpdate({ address: e.target.value })}
          onKeyDown={commitOnEnter}
          className={field}
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label>
          <span className={label}>Dwell (min)</span>
          <input
            type="number"
            min={0}
            defaultValue={stop.dwell_override || ''}
            onBlur={(e) =>
              onUpdate({ dwell_override: Number(e.target.value) || 0 })
            }
            onKeyDown={commitOnEnter}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Anchor</span>
          <input
            type="time"
            defaultValue={stop.anchor_time}
            onBlur={(e) => onUpdate({ anchor_time: e.target.value })}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Type</span>
          <select
            defaultValue={stop.anchor_type || 'arrival'}
            onChange={(e) =>
              onUpdate({
                anchor_type: e.target.value as StopPatch['anchor_type'],
              })
            }
            className={field}
          >
            <option value="arrival">arrival</option>
            <option value="departure">departure</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          defaultChecked={stop.is_accommodation}
          onChange={(e) => onUpdate({ is_accommodation: e.target.checked })}
        />
        Accommodation (day ends here)
      </label>

      <div className="rounded border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400">
        Thumbnail — photo uploads arrive in phase 7.2
      </div>

      <button
        onClick={onDelete}
        className="text-xs text-red-600 hover:underline"
      >
        Delete stop
      </button>
    </div>
  );
}
