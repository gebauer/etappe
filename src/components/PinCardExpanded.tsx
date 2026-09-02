import { useEffect, useState, type KeyboardEvent } from 'react';
import { pb } from '../lib/pb';
import { blockFileUrl } from '../lib/pb-blocks';
import type { BlockKind, BlockPatch } from '../lib/pb-blocks';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import { formatClock, type Daylight, type StopTiming } from '../lib/cascade';
import { describeDaylight } from '../lib/daylight';
import { formatDayDate } from '../lib/format';
import type {
  BlocksResponse,
  DaysResponse,
  PoisResponse,
  StopsResponse,
} from '../types/pb';
import type { StopPatch } from '../lib/pb-stops';
import { KindIcon } from './KindIcon';
import { TimingCells } from './TimingCells';
import { timingCells } from '../lib/timing-cells';
import type { TimingCell } from '../lib/timing-edit';
import { KindPicker } from './KindPicker';
import { BlockEditor } from './BlockEditor';

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

const FIELD_LABEL = 'mb-1.5 block text-[11px] text-text-3';
const FIELD =
  'h-[38px] w-full rounded-[9px] border border-border-strong bg-field px-[11px] text-text outline-none focus:border-accent';
const SECTION_LABEL = 'text-[10.5px] uppercase tracking-[0.08em] text-text-4';

interface Props {
  /** A stop, or a wishlist idea. The sections an idea has no fields for —
   * accommodation, the day it belongs to, its place in the timing chain —
   * are hidden rather than shown empty (WORK 16.5). */
  stop: StopsResponse | PoisResponse;
  isWish?: boolean;
  blocks: BlocksResponse[];
  days: DaysResponse[];
  tripStartDate: string;
  timing?: StopTiming;
  daylight: Daylight | null;
  onClose: () => void;
  onUpdate: (patch: StopPatch) => void;
  onEditTiming: (cell: TimingCell, value: string) => void;
  onPlaceAccessPoint: () => void;
  onClearAccessPoint: () => void;
  onMoveToDay: (dayId: string) => void;
  onRemove: () => void;
  /** WORK 14.2: move a stop back to the wishlist — the mirror of promotion. */
  onDowngrade: () => void;
  onAddBlock: (kind: BlockKind) => void;
  onAddPrivateNote: () => void;
  onUpdateBlock: (blockId: string, patch: BlockPatch) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, dir: -1 | 1) => void;
  onUploadBlockFile: (blockId: string, file: File) => Promise<void>;
  openKindPickerSignal?: number;
}

/**
 * "All details" — the third tier of depth (design handoff, "Expanded card —
 * full inspector parity"). Where StopInspector's remaining fields land:
 * accommodation, address and raw lat/lon, none of them touched often enough
 * to earn a slot in the docked card's inline edit region (WORK 12.2).
 *
 * The Blocks section reuses `BlockEditor` as-is rather than re-implementing
 * block CRUD in the dark palette — restyling it is out of this bundle's
 * scope (the handoff's own "Scope of this bundle" list doesn't mention it).
 */
export function PinCardExpanded({
  stop,
  isWish = false,
  blocks,
  days,
  tripStartDate,
  timing,
  daylight,
  onClose,
  onUpdate,
  onEditTiming,
  onPlaceAccessPoint,
  onClearAccessPoint,
  onMoveToDay,
  onRemove,
  onDowngrade,
  onAddBlock,
  onAddPrivateNote,
  onUpdateBlock,
  onDeleteBlock,
  onMoveBlock,
  onUploadBlockFile,
  openKindPickerSignal,
}: Props) {
  const [kindPickerOpen, setKindPickerOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  // `isWish` is a flag, not a discriminant TypeScript can narrow on, so the
  // stop-only sections render off this instead.
  const asStop = isWish ? null : (stop as StopsResponse);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    if (openKindPickerSignal) setKindPickerOpen(true);
  }, [openKindPickerSignal]);

  const hasAccessPoint = !!stop.access_lat && !!stop.access_lon;
  const cover = blocks.find((b) => b.kind === 'photo');
  // '640x0' is the largest thumb size configured on the blocks collection
  // (see pb-blocks.ts) — reused rather than adding a new PocketBase thumb
  // preset just for this one, slightly larger pane.
  const coverSrc = cover ? blockFileUrl(pb, cover, '640x0') : null;
  const photoCount = blocks.filter((b) => b.kind === 'photo').length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-7 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="flex h-[min(700px,100%)] w-[min(1120px,100%)] flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface-4 font-sans text-text shadow-expanded desktop:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* WORK 12.7: the fixed 46%/54% two-column split only works at
            desktop widths — on phone it squeezed a 334px modal into two
            ~160px columns, unreadable. Stacked below 860px instead; the
            handoff called this "not built" and left it a modal, but
            stacking it costs one class change and turns "All details"
            from broken into merely tall. */}
        <div className="relative h-48 min-w-0 flex-none border-b border-[oklch(0.28_0.012_250)] bg-control desktop:h-auto desktop:flex-[0_0_46%] desktop:border-b-0 desktop:border-r">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={cover?.title || stop.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[11px] text-text-4">
              no photo yet
            </div>
          )}
          <div className="absolute bottom-3.5 left-4 flex gap-1.5">
            {photoCount > 0 && (
              <span className="rounded-[7px] bg-glass px-2.5 py-1.5 font-mono text-[10.5px] text-text-2 backdrop-blur-[6px]">
                1 / {photoCount}
              </span>
            )}
            {cover?.attribution_author && (
              <span className="rounded-[7px] bg-glass px-2.5 py-1.5 font-mono text-[10.5px] text-text-4 backdrop-blur-[6px]">
                © {cover.attribution_author}
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-none items-start gap-3.5 border-b border-[oklch(0.28_0.012_250)] px-[22px] pb-3.5 pt-5">
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-2xl font-semibold tracking-[-0.015em]">
                {stop.title}
              </h2>
              <div className="mt-1.5 text-[13px] text-text-3">
                {TAXONOMY[stop.kind as Kind]?.label ?? stop.kind}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border-strong text-text-2 hover:bg-control"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-[22px] pb-[22px] pt-4.5">
            {asStop && (
              <div className="mb-4.5">
                <TimingCells
                  size="expanded"
                  onEdit={onEditTiming}
                  cells={[
                    ...timingCells(asStop, timing).slice(0, 2),
                    {
                      label: 'Daylight',
                      value: daylight
                        ? timing
                          ? describeDaylight(daylight, timing.arrival).token
                          : formatClock(daylight.sunset)
                        : null,
                      accent: true,
                    },
                  ]}
                />
              </div>
            )}

            {asStop && (
              <div className="flex items-center justify-between gap-3.5 rounded-[11px] border border-warn-border bg-warn-bg px-[15px] py-3.5">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-warn-text">
                    Accommodation
                  </div>
                  <div className="mt-[3px] text-xs text-[oklch(0.88_0.07_85/0.8)] [text-wrap:pretty]">
                    {asStop.is_accommodation
                      ? 'The day ends here. Clears the day’s NO_ACCOMMODATION warning.'
                      : 'Turn on if the day ends here — this is what clears the day’s NO_ACCOMMODATION warning.'}
                  </div>
                </div>
                <button
                  onClick={() =>
                    onUpdate({ is_accommodation: !asStop.is_accommodation })
                  }
                  role="switch"
                  aria-checked={asStop.is_accommodation}
                  className={`flex h-7 w-12 flex-none items-center rounded-full p-[3px] transition-colors ${
                    asStop.is_accommodation
                      ? 'justify-end bg-wishlist'
                      : 'justify-start bg-control'
                  }`}
                >
                  <span className="h-[22px] w-[22px] rounded-full bg-[oklch(0.97_0.005_250)] shadow-sm" />
                </button>
              </div>
            )}

            <div className={`mt-4.5 ${SECTION_LABEL}`}>Place</div>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <label className="col-span-2 block">
                <span className={FIELD_LABEL}>Title</span>
                <input
                  defaultValue={stop.title}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== stop.title)
                      onUpdate({ title: value });
                  }}
                  onKeyDown={commitOnEnter}
                  className={FIELD}
                />
              </label>
              <label className="col-span-2 block">
                <span className={FIELD_LABEL}>Address</span>
                <input
                  defaultValue={stop.address}
                  onBlur={(e) => onUpdate({ address: e.target.value })}
                  onKeyDown={commitOnEnter}
                  className={`${FIELD} text-[13px]`}
                />
              </label>
              <label className="block">
                <span className={FIELD_LABEL}>Latitude</span>
                <input
                  type="number"
                  step="any"
                  defaultValue={stop.lat || ''}
                  onBlur={(e) => onUpdate({ lat: Number(e.target.value) || 0 })}
                  onKeyDown={commitOnEnter}
                  className={`${FIELD} font-mono text-[13.5px]`}
                />
              </label>
              <label className="block">
                <span className={FIELD_LABEL}>Longitude</span>
                <input
                  type="number"
                  step="any"
                  defaultValue={stop.lon || ''}
                  onBlur={(e) => onUpdate({ lon: Number(e.target.value) || 0 })}
                  onKeyDown={commitOnEnter}
                  className={`${FIELD} font-mono text-[13.5px]`}
                />
              </label>
              <div className="col-span-2 flex items-center justify-between gap-3 rounded-[10px] border border-[oklch(0.29_0.012_250)] bg-surface-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium">Access point</div>
                  <div className="mt-0.5 truncate font-mono text-[11.5px] text-text-4">
                    {hasAccessPoint
                      ? `${stop.access_lat!.toFixed(5)}, ${stop.access_lon!.toFixed(5)}`
                      : isWish
                        ? 'Not set — routes to the idea itself'
                        : 'Not set — routes to the stop itself'}
                  </div>
                </div>
                <div className="flex flex-none gap-1.5">
                  {hasAccessPoint && (
                    <button
                      onClick={onClearAccessPoint}
                      className="h-8 whitespace-nowrap rounded-lg border border-border-strong px-3 text-xs text-text-2 hover:bg-control-hover"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={onPlaceAccessPoint}
                    className="h-8 whitespace-nowrap rounded-lg border border-border-strong bg-control px-3 text-xs text-text-2 hover:bg-control-hover"
                  >
                    Set on map
                  </button>
                </div>
              </div>
            </div>

            {/* Kind only. Dwell and anchor lived here as well until WORK
                16.1 made the clock row itself editable; keeping a second
                copy of a field that is now typed into directly is exactly
                the duplication that task removed. */}
            <div className={`mt-5 ${SECTION_LABEL}`}>Kind</div>
            <div className="mt-2.5 grid grid-cols-3 gap-3">
              <div className="relative block">
                <span className={FIELD_LABEL}>Kind</span>
                <button
                  type="button"
                  onClick={() => setKindPickerOpen((open) => !open)}
                  className={`${FIELD} flex items-center gap-2 text-left text-[13px]`}
                >
                  <KindIcon kind={stop.kind as Kind} />
                  <span className="truncate">
                    {TAXONOMY[stop.kind as Kind]?.label ?? stop.kind}
                  </span>
                </button>
                {kindPickerOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-[320px] rounded-lg border border-border-strong bg-surface-2 p-2 shadow-card">
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
            </div>

            <div className="mt-5 flex items-baseline justify-between gap-2.5">
              <span className={SECTION_LABEL}>Blocks</span>
              <button
                onClick={onAddPrivateNote}
                title="A note only you can see"
                className="rounded-[7px] border border-dashed border-border-strong px-2 py-1 text-[11px] text-text-2 hover:border-text-5 hover:text-text"
              >
                + my note
              </button>
            </div>
            <div className="mt-2.5">
              <BlockEditor
                blocks={blocks}
                onAdd={onAddBlock}
                onUpdate={onUpdateBlock}
                onDelete={onDeleteBlock}
                onMove={onMoveBlock}
                onUploadFile={onUploadBlockFile}
              />
            </div>
          </div>

          <div className="flex flex-none items-center gap-2.5 border-t border-[oklch(0.28_0.012_250)] bg-surface-3 px-[22px] py-3">
            <button
              onClick={onClose}
              className="h-9 whitespace-nowrap rounded-lg bg-accent px-4 text-[13px] font-medium text-on-accent hover:brightness-110"
            >
              Done
            </button>
            {asStop && (
              <div className="relative">
                <button
                  onClick={() => setDayPickerOpen((open) => !open)}
                  className="h-9 whitespace-nowrap rounded-lg border border-border-strong px-3.5 text-[13px] text-text-2 hover:bg-control"
                >
                  Move to day…
                </button>
                {dayPickerOpen && (
                  <div className="absolute bottom-full left-0 z-10 mb-1 max-h-64 w-56 overflow-auto rounded-lg border border-border-strong bg-surface-2 p-1 shadow-card">
                    {days.map((day, i) => (
                      <button
                        key={day.id}
                        onClick={() => {
                          onMoveToDay(day.id);
                          setDayPickerOpen(false);
                        }}
                        disabled={day.id === asStop.day}
                        className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-control disabled:opacity-40"
                      >
                        Day {i + 1}
                        <span className="ml-1.5 font-mono text-[11px] text-text-4">
                          {formatDayDate(tripStartDate, day.order_index)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {asStop && (
                <button
                  onClick={onDowngrade}
                  title="Move back to wishlist"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-[15px] text-text-2 hover:bg-control"
                >
                  ♻
                </button>
              )}
              <button
                onClick={() =>
                  confirmingRemove ? onRemove() : setConfirmingRemove(true)
                }
                title={confirmingRemove ? 'Click again to confirm' : 'Delete'}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[15px] ${
                  confirmingRemove
                    ? 'border-danger-border bg-[oklch(0.30_0.08_25)] text-danger-text'
                    : 'border-border-strong text-text-2 hover:bg-control'
                }`}
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
