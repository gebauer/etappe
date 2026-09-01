import { useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { renderMarkdown } from '../lib/markdown';
import { blockFileUrl, type BlockKind } from '../lib/pb-blocks';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import { formatClock, type Daylight, type StopTiming } from '../lib/cascade';
import type { BlocksResponse, PoisResponse, StopsResponse } from '../types/pb';
import type { PlaceResult } from '../lib/photon';
import type { StopPatch } from '../lib/pb-stops';
import { PinCardEdit } from './PinCardEdit';
import { TimingCells } from './TimingCells';
import { timingCells } from '../lib/timing-cells';
import type { TimingCell } from '../lib/timing-edit';

/** What was clicked. One component, three action sets — the whole point of
 * the unified card (design handoff, "The unified card"). */
export type CardTarget =
  | {
      type: 'stop';
      stop: StopsResponse;
      dayLabel: string;
      seq: number;
      total: number;
      timing?: StopTiming;
      daylight: Daylight | null;
      afterDark: boolean;
    }
  | { type: 'wish'; item: PoisResponse; position: number; total: number }
  | {
      type: 'empty';
      lat: number;
      lon: number;
      place: PlaceResult | null;
      identifying: boolean;
    };

interface Props {
  target: CardTarget;
  blocks: BlocksResponse[];
  editing: boolean;
  onToggleEdit: () => void;
  onClose: () => void;
  /** Steps through the day's stops, or the wishlist proximity chain. */
  onStep: (direction: -1 | 1) => void;
  onOpenDetails: () => void;
  onRemove: () => void;
  /** WORK 14.2: move a stop back to the wishlist — the mirror of promotion. */
  onDowngrade: () => void;
  onAddToItinerary: () => void;
  /** Wishlist idea with no coordinates: start the click-the-map repair. */
  onSetLocation: () => void;
  /** WORK 14.3: "Reject" renamed "Delete" — a hard delete now that promoted
   * ideas are deleted too rather than marked scheduled (WORK 14.1). */
  onDelete: () => void;
  onAddWishlist: () => void;
  onAddDay: () => void;
  onUpdateStop: (patch: StopPatch) => void;
  /** A timing cell was typed into — see `planTimingEdit`. */
  onEditTiming: (cell: TimingCell, value: string) => void;
  /** Stop whose dwell was just changed on its behalf — marked while it
   * matters, so the change is findable and not only announced once. */
  timingFlashStopId?: string | null;
  onPlaceAccessPoint: () => void;
  onClearAccessPoint: () => void;
  onAddBlock: (kind: BlockKind) => void;
  openKindPickerSignal?: number;
}

const BTN = 'h-[34px] whitespace-nowrap rounded-lg px-3 text-[13px]';
const PRIMARY = `${BTN} bg-accent font-medium text-on-accent hover:brightness-110`;
const GHOST = `${BTN} border border-border-strong text-text-2 hover:bg-control`;
const ICON_BTN =
  'flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg text-[15px]';
const GLASS =
  'flex h-7 w-7 items-center justify-center rounded-full bg-glass text-text backdrop-blur-[6px] hover:brightness-125';

function kindLabel(kind: string): string {
  return TAXONOMY[kind as Kind]?.label ?? kind;
}

export function PinCard({
  target,
  blocks,
  editing,
  onToggleEdit,
  onClose,
  onStep,
  onOpenDetails,
  onRemove,
  onDowngrade,
  onAddToItinerary,
  onSetLocation,
  onDelete,
  onAddWishlist,
  onAddDay,
  onUpdateStop,
  onEditTiming,
  timingFlashStopId,
  onPlaceAccessPoint,
  onClearAccessPoint,
  onAddBlock,
  openKindPickerSignal,
}: Props) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const identity =
    target.type === 'stop'
      ? target.stop.id
      : target.type === 'wish'
        ? target.item.id
        : `${target.lat},${target.lon}`;

  // A pending "Confirm remove?" must never carry over to whatever is selected
  // next, or the second click deletes the wrong stop.
  useEffect(() => setConfirmingRemove(false), [identity]);

  const photos = blocks.filter((b) => b.kind === 'photo');
  const cover = photos[0];
  const coverSrc = cover ? blockFileUrl(pb, cover, '640x0') : null;
  const notes = blocks.filter((b) => b.kind === 'note' && b.body?.trim());
  // Every link block, not just one — a wishlist idea imported from
  // Highlights routinely carries several (WORK 14: pois have no url field
  // of their own any more, links are blocks on both pois and stops).
  const linkBlocks = blocks.filter((b) => b.kind === 'link' && b.url);

  // An idea with no coordinates isn't in the proximity chain at all, so the
  // "nearest" counter has nothing to count it as — it read `0 / 34`, which
  // looks like a broken index rather than a missing location.
  const located =
    target.type !== 'wish' || (!!target.item.lat && !!target.item.lon);
  const hasNav = target.type !== 'empty';
  const navLabel =
    target.type === 'stop'
      ? `STOP ${target.seq} / ${target.total}`
      : target.type === 'wish'
        ? located
          ? `NEAREST · ${target.position} / ${target.total}`
          : 'WISHLIST'
        : '';

  let title: string;
  let subtitle: string;
  if (target.type === 'stop') {
    title = target.stop.title;
    subtitle = `${kindLabel(target.stop.kind)} · ${target.dayLabel}`;
  } else if (target.type === 'wish') {
    title = target.item.title;
    subtitle = located
      ? `${kindLabel(target.item.kind ?? 'uncategorized')} · Wishlist`
      : `${kindLabel(target.item.kind ?? 'uncategorized')} · No location yet`;
  } else {
    title = target.place?.name ?? 'Dropped pin';
    const coords = `${target.lat.toFixed(4)}, ${target.lon.toFixed(4)}`;
    subtitle = target.identifying
      ? `Identifying… · ${coords}`
      : `${kindLabel(target.place?.kind ?? 'uncategorized')} · ${coords}`;
  }

  return (
    <div className="fixed bottom-3.5 left-3.5 z-30 flex max-h-[calc(100vh-140px)] w-[min(382px,calc(100vw-28px))] flex-col overflow-hidden rounded-[14px] border border-border-strong bg-surface-4 font-sans text-text shadow-card">
      <div className="relative h-[158px] flex-none bg-control">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={cover?.title || title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[11px] text-text-4">
            no photo yet
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Close"
          className={`${GLASS} absolute right-2.5 top-2.5`}
        >
          ✕
        </button>

        {target.type === 'stop' && (
          <button
            onClick={() => onUpdateStop({ starred: !target.stop.starred })}
            aria-label={target.stop.starred ? 'Unstar' : 'Star'}
            title={target.stop.starred ? 'Unstar' : 'Star'}
            className={`${GLASS} absolute right-[46px] top-2.5 ${target.stop.starred ? 'text-wishlist' : ''}`}
          >
            ★
          </button>
        )}

        {hasNav && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <button
              onClick={() => onStep(-1)}
              aria-label="Previous"
              className={GLASS}
            >
              ‹
            </button>
            <button
              onClick={() => onStep(1)}
              aria-label="Next"
              className={GLASS}
            >
              ›
            </button>
            <span className="flex h-7 items-center whitespace-nowrap rounded-[14px] bg-glass px-2.5 font-mono text-[10.5px] tracking-[0.04em] text-text-2 backdrop-blur-[6px]">
              {navLabel}
            </span>
          </div>
        )}

        {cover?.attribution_author && (
          <div className="absolute bottom-2.5 left-3 font-mono text-[10px] text-text-4">
            © {cover.attribution_author}
            {cover.attribution_licence ? ` · ${cover.attribution_licence}` : ''}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-3.5 pt-3.5">
        <div className="flex items-baseline gap-2.5">
          {target.type === 'stop' && (
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent font-mono text-xs text-on-accent">
              {target.seq}
            </span>
          )}
          <h2 className="m-0 text-[19px] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
        </div>
        <div className="mt-1 text-[13px] text-text-3">{subtitle}</div>

        {target.type === 'stop' && (
          <>
            <div className="mt-3">
              <TimingCells
                cells={timingCells(
                  target.stop,
                  target.timing,
                  timingFlashStopId === target.stop.id,
                )}
                onEdit={onEditTiming}
              />
            </div>

            {target.daylight && (
              <div className="mt-2.5 flex items-center gap-[7px] text-[12.5px] text-text-3">
                <span className="h-[7px] w-[7px] flex-none rounded-full bg-daylight" />
                <span>
                  Daylight until {formatClock(target.daylight.sunset)} ·{' '}
                  {target.afterDark ? 'after dark' : 'well clear'}
                </span>
              </div>
            )}
          </>
        )}

        {notes.map((note) => (
          <div
            key={note.id}
            className="prose-note mt-3 text-[13.5px] text-text-2 [text-wrap:pretty] [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }}
          />
        ))}

        {target.type === 'empty' && !target.identifying && (
          <p className="mt-3 text-[13.5px] text-text-2 [text-wrap:pretty]">
            Nothing here yet. Save it for later, or drop it straight into a day.
          </p>
        )}

        {linkBlocks.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1">
            {linkBlocks.map((b) => (
              <a
                key={b.id}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-accent underline"
              >
                {b.title?.trim() || 'Official site'}
              </a>
            ))}
          </div>
        )}

        {editing && target.type === 'stop' && (
          <PinCardEdit
            key={`${target.stop.id}:${target.stop.updated}`}
            stop={target.stop}
            onUpdate={onUpdateStop}
            onPlaceAccessPoint={onPlaceAccessPoint}
            onClearAccessPoint={onClearAccessPoint}
            onAddBlock={onAddBlock}
            openKindPickerSignal={openKindPickerSignal}
          />
        )}
      </div>

      <div className="flex flex-none items-center gap-2.5 border-t border-[oklch(0.28_0.012_250)] bg-surface-3 px-4 py-[11px]">
        {target.type === 'stop' && (
          <>
            <button
              onClick={onToggleEdit}
              className={editing ? PRIMARY : GHOST}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
            <button onClick={onOpenDetails} className={GHOST}>
              All details
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onDowngrade}
                title="Move back to wishlist"
                className={`${ICON_BTN} border border-border-strong text-text-2 hover:bg-control`}
              >
                ♻
              </button>
              <button
                onClick={() =>
                  confirmingRemove ? onRemove() : setConfirmingRemove(true)
                }
                title={confirmingRemove ? 'Click again to confirm' : 'Delete'}
                className={`${ICON_BTN} border ${
                  confirmingRemove
                    ? 'border-danger-border bg-[oklch(0.30_0.08_25)] text-danger-text'
                    : 'border-border-strong text-text-2 hover:bg-control'
                }`}
              >
                🗑
              </button>
            </div>
          </>
        )}

        {target.type === 'wish' && (
          <>
            {located ? (
              <button onClick={onAddToItinerary} className={PRIMARY}>
                Add to itinerary
              </button>
            ) : (
              <button
                onClick={onSetLocation}
                title="Geocoding found nothing for this one — click the map to say where it is"
                className={PRIMARY}
              >
                Set location on the map
              </button>
            )}
            <button
              onClick={() =>
                confirmingRemove ? onDelete() : setConfirmingRemove(true)
              }
              className={`${BTN} ml-auto border ${
                confirmingRemove
                  ? 'border-danger-border bg-[oklch(0.30_0.08_25)] text-danger-text'
                  : 'border-border-strong text-text-2 hover:bg-control'
              }`}
            >
              {confirmingRemove ? 'Confirm delete' : 'Delete'}
            </button>
          </>
        )}

        {target.type === 'empty' && (
          <>
            <button onClick={onAddWishlist} className={PRIMARY}>
              + Wishlist
            </button>
            <button onClick={onAddDay} className={GHOST}>
              + Day
            </button>
            <button onClick={onClose} className={`${GHOST} ml-auto`}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
