import { useEffect, useState, type KeyboardEvent } from 'react';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import type { StopsResponse, BlocksResponse } from '../types/pb';
import type { StopPatch } from '../lib/pb-stops';
import type { BlockKind, BlockPatch } from '../lib/pb-blocks';
import { BlockEditor } from './BlockEditor';
import { KindIcon } from './KindIcon';
import { KindPicker } from './KindPicker';

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
  onUploadBlockFile,
  openKindPickerSignal,
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
  onUploadBlockFile: (blockId: string, file: File) => Promise<void>;
  /** Bumped by TripEditor's bare `k` shortcut (BUILD §7) to open the kind
   * picker for whichever stop is selected — a changing number, not a
   * boolean, since the same "open" request can fire again while already
   * open. 0/undefined never opens (falsy on first render). */
  openKindPickerSignal?: number;
}) {
  const hasCoords = !!stop.lat && !!stop.lon;
  const hasAccessPoint = !!stop.access_lat && !!stop.access_lon;
  const [kindPickerOpen, setKindPickerOpen] = useState(false);
  useEffect(() => {
    if (openKindPickerSignal) setKindPickerOpen(true);
  }, [openKindPickerSignal]);
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

      <div>
        <span className={label}>Kind</span>
        <button
          type="button"
          onClick={() => setKindPickerOpen((v) => !v)}
          title="Change kind (k)"
          className={`${field} flex items-center gap-2 text-left`}
        >
          <KindIcon kind={stop.kind as Kind} />
          {TAXONOMY[stop.kind as Kind]?.label ?? stop.kind}
        </button>
        {!stop.kind_confirmed && (
          <span className="text-xs text-amber-600">
            auto-detected — confirm?
          </span>
        )}
        {kindPickerOpen && (
          <div className="mt-1 rounded border border-slate-300 bg-white p-2 shadow-sm">
            <KindPicker
              value={stop.kind as Kind}
              autoFocus
              onEscape={() => setKindPickerOpen(false)}
              onChange={(kind) => {
                onUpdate({ kind, kind_confirmed: true });
                setKindPickerOpen(false);
              }}
            />
          </div>
        )}
      </div>

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
          onUploadFile={onUploadBlockFile}
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
