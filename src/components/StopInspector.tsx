import { type KeyboardEvent } from 'react';
import { KINDS, TAXONOMY } from '../lib/taxonomy';
import type { StopsResponse, BlocksResponse } from '../types/pb';
import type { StopPatch } from '../lib/pb-stops';
import type { BlockKind, BlockPatch } from '../lib/pb-blocks';
import { BlockEditor } from './BlockEditor';

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
  blocks,
  onUpdate,
  onDelete,
  onZoom,
  onPlaceAccessPoint,
  onClearAccessPoint,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  onMoveBlock,
}: {
  stop: StopsResponse;
  blocks: BlocksResponse[];
  onUpdate: (patch: StopPatch) => void;
  onDelete: () => void;
  onZoom: () => void;
  onPlaceAccessPoint: () => void;
  onClearAccessPoint: () => void;
  onAddBlock: (kind: BlockKind) => void;
  onUpdateBlock: (blockId: string, patch: BlockPatch) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, dir: -1 | 1) => void;
}) {
  const hasCoords = !!stop.lat && !!stop.lon;
  const hasAccessPoint = !!stop.access_lat && !!stop.access_lon;
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

      <div>
        <span className={label}>Access point</span>
        <p className="mb-1 text-xs text-slate-400">
          A nearby road or car park to route to/from instead, for a POI a car
          can't reach directly (trailhead, viewpoint). Legs re-route
          automatically when this changes.
        </p>
        {hasAccessPoint ? (
          <div className="flex items-center justify-between gap-2 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700">
            <span>
              {stop.access_lat!.toFixed(5)}, {stop.access_lon!.toFixed(5)}
            </span>
            <button onClick={onClearAccessPoint} className="underline">
              clear
            </button>
          </div>
        ) : (
          <button
            onClick={onPlaceAccessPoint}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            📍 Set on map
          </button>
        )}
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

      <div className="border-t border-slate-200 pt-3">
        <BlockEditor
          blocks={blocks}
          onAdd={onAddBlock}
          onUpdate={onUpdateBlock}
          onDelete={onDeleteBlock}
          onMove={onMoveBlock}
        />
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
