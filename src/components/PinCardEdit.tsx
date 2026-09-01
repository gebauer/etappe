import { useEffect, useState, type KeyboardEvent } from 'react';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import type { StopsResponse } from '../types/pb';
import type { StopPatch } from '../lib/pb-stops';
import type { BlockKind } from '../lib/pb-blocks';
import { KindIcon } from './KindIcon';
import { KindPicker } from './KindPicker';

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

const LABEL =
  'mb-1.5 block text-[11px] uppercase tracking-[0.07em] text-text-4';
const FIELD =
  'h-9 w-full rounded-lg border border-border-strong bg-field px-[11px] text-text outline-none focus:border-accent';

const BLOCK_KINDS: BlockKind[] = ['note', 'link', 'photo', 'file'];

/**
 * The card's inline edit region (design handoff, "Expanded edit region") —
 * revealed in place by Edit, never a separate mode. Deliberately only the
 * fields adjusted constantly while planning; everything else (accommodation,
 * address, coordinates) lives in the expanded full-details card, WORK 12.3.
 *
 * Uncontrolled inputs committing on blur/Enter, matching `StopInspector` and
 * `StopRow` — the parent re-keys this component when the stop changes.
 */
export function PinCardEdit({
  stop,
  onUpdate,
  onPlaceAccessPoint,
  onClearAccessPoint,
  onAddBlock,
  openKindPickerSignal,
}: {
  stop: StopsResponse;
  onUpdate: (patch: StopPatch) => void;
  onPlaceAccessPoint: () => void;
  onClearAccessPoint: () => void;
  onAddBlock: (kind: BlockKind) => void;
  /** Bumped by the bare `k` shortcut — a changing number, not a boolean,
   * since the same request can fire again while the picker is open. */
  openKindPickerSignal?: number;
}) {
  const [kindPickerOpen, setKindPickerOpen] = useState(false);
  const hasAccessPoint = !!stop.access_lat && !!stop.access_lon;

  useEffect(() => {
    if (openKindPickerSignal) setKindPickerOpen(true);
  }, [openKindPickerSignal]);

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[oklch(0.28_0.012_250)] pt-3.5">
      <label className="col-span-2 block">
        <span className={LABEL}>Title</span>
        <input
          defaultValue={stop.title}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value && value !== stop.title) onUpdate({ title: value });
          }}
          onKeyDown={commitOnEnter}
          className={FIELD}
        />
      </label>

      <div className="relative block">
        <span className={LABEL}>Kind</span>
        <button
          type="button"
          onClick={() => setKindPickerOpen((open) => !open)}
          title="Change kind (k)"
          className={`${FIELD} flex items-center gap-2 text-left`}
        >
          <KindIcon kind={stop.kind as Kind} />
          <span className="truncate">
            {TAXONOMY[stop.kind as Kind]?.label ?? stop.kind}
          </span>
        </button>
        {kindPickerOpen && (
          <div className="absolute bottom-full left-0 z-10 mb-1 w-[320px] max-w-[calc(100vw-56px)] rounded-lg border border-border-strong bg-surface-2 p-2 shadow-card">
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

      <label className="block">
        <span className={LABEL}>Dwell (min)</span>
        <input
          type="number"
          min={0}
          defaultValue={stop.dwell_override || ''}
          onBlur={(e) =>
            onUpdate({ dwell_override: Number(e.target.value) || 0 })
          }
          onKeyDown={commitOnEnter}
          className={`${FIELD} font-mono`}
        />
      </label>

      <label className="block">
        <span className={LABEL}>Anchor</span>
        <input
          type="time"
          defaultValue={stop.anchor_time}
          onBlur={(e) => onUpdate({ anchor_time: e.target.value })}
          className={`${FIELD} font-mono`}
        />
      </label>

      <label className="block">
        <span className={LABEL}>Type</span>
        <select
          defaultValue={stop.anchor_type || 'arrival'}
          onChange={(e) =>
            onUpdate({
              anchor_type: e.target.value as StopPatch['anchor_type'],
            })
          }
          className={FIELD}
        >
          <option value="arrival">arrival</option>
          <option value="departure">departure</option>
        </select>
      </label>

      <div className="col-span-2 flex items-center justify-between gap-3 rounded-[9px] border border-border-strong bg-surface-4 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium">Access point</div>
          <div className="mt-0.5 truncate text-[11.5px] text-text-4">
            {hasAccessPoint
              ? `${stop.access_lat!.toFixed(5)}, ${stop.access_lon!.toFixed(5)}`
              : 'Route to a nearby car park instead'}
          </div>
        </div>
        <button
          onClick={hasAccessPoint ? onClearAccessPoint : onPlaceAccessPoint}
          className="h-[30px] flex-none rounded-[7px] border border-border-strong bg-control px-[11px] text-xs text-text-2 hover:bg-control-hover"
        >
          {hasAccessPoint ? 'Clear' : 'Set on map'}
        </button>
      </div>

      <div className="col-span-2 flex flex-wrap gap-[7px]">
        {BLOCK_KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => onAddBlock(kind)}
            className="h-[30px] rounded-[7px] border border-dashed border-border-strong px-[11px] text-xs capitalize text-text-2 hover:border-text-5 hover:text-text"
          >
            + {kind}
          </button>
        ))}
      </div>
    </div>
  );
}
