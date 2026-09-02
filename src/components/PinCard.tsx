import { useEffect, useState, type TouchEvent } from 'react';
import { pb } from '../lib/pb';
import { renderMarkdown } from '../lib/markdown';
import { blockFileUrl, type BlockKind } from '../lib/pb-blocks';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import { formatClock, type Daylight, type StopTiming } from '../lib/cascade';
import { describeDaylight } from '../lib/daylight';
import { ContributorPill } from './ContributorMark';
import { formatDuration } from '../lib/format';
import type { CurrencyCode } from '../lib/currency';
import type { BlocksResponse, PoisResponse, StopsResponse } from '../types/pb';
import type { PlaceResult } from '../lib/photon';
import type { StopPatch } from '../lib/pb-stops';
import { PinCardEdit } from './PinCardEdit';
import { CostField } from './CostField';
import type { CostsResponse } from '../types/pb';
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
  onAddPrivateNote: () => void;
  /** WORK 16.7/16.10 — the costs on this stop or idea (usually one, per
   * the simplified card field) and how to change it. */
  costs: CostsResponse[];
  onChangeCost: (amount: number | null, currency: CurrencyCode) => void;
  openKindPickerSignal?: number;
  /** WORK 12.7 — the compact bottom-sheet strip instead of the docked card.
   * A prop, not an internal media query: `TripEditor` already knows the
   * breakpoint (it decides whether to mount `PinCard` or nothing at all
   * for the wishlist panel), and one source of truth is simpler than two
   * components independently asking the same question. */
  phone?: boolean;
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
  onAddPrivateNote,
  costs,
  onChangeCost,
  openKindPickerSignal,
  phone = false,
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
  const allNotes = blocks.filter((b) => b.kind === 'note' && b.body?.trim());
  // A private note is only ever returned to the person who wrote it (the
  // API rule enforces that), so anything private here is mine — worth its
  // own heading rather than being mixed into the shared description.
  const notes = allNotes.filter((b) => b.visibility !== 'private');
  const myNotes = allNotes.filter((b) => b.visibility === 'private');
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
    subtitle =
      target.stop.routing_kind === 'waypoint'
        ? `Routing point · ${target.dayLabel}`
        : `${kindLabel(target.stop.kind)} · ${target.dayLabel}`;
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

  function renderActions() {
    return (
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
                onBlur={() => setConfirmingRemove(false)}
                title={confirmingRemove ? undefined : 'Delete'}
                className={
                  confirmingRemove
                    ? `${BTN} flex-none whitespace-nowrap border border-danger-border bg-[oklch(0.30_0.08_25)] text-danger-text`
                    : `${ICON_BTN} border border-border-strong text-text-2 hover:bg-control`
                }
              >
                {confirmingRemove ? 'Delete stop?' : '🗑'}
              </button>
            </div>
          </>
        )}

        {target.type === 'wish' && (
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
            {located ? (
              <button onClick={onAddToItinerary} className={GHOST}>
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
              onBlur={() => setConfirmingRemove(false)}
              title={confirmingRemove ? undefined : 'Delete'}
              className={
                confirmingRemove
                  ? `${BTN} ml-auto flex-none whitespace-nowrap border border-danger-border bg-[oklch(0.30_0.08_25)] text-danger-text`
                  : `${ICON_BTN} ml-auto border border-border-strong text-text-2 hover:bg-control`
              }
            >
              {confirmingRemove ? 'Delete idea?' : '🗑'}
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
    );
  }

  // WORK 12.7: a compact bottom sheet, not the full-bleed card — the map
  // has to stay visible and readable behind it. Reuses every computed value
  // and handler above; only the layout differs, so a fix to the desktop
  // card's action bar or edit region (`renderActions`, `PinCardEdit`)
  // reaches this without a second edit.
  if (phone) {
    let touchStartX: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0]?.clientX ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX == null || !hasNav) return;
      const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      touchStartX = null;
      // >40px threshold (design handoff): left = next, right = previous.
      if (Math.abs(dx) > 40) onStep(dx < 0 ? 1 : -1);
    };

    return (
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        // `absolute`, not `fixed` — this sits inside the map's own relative
        // wrapper (TripEditor), which is only the top 58% of the viewport
        // on phone. `fixed` would anchor it to the *screen* bottom instead,
        // covering the itinerary column rather than sitting at the bottom
        // of the map above it.
        className="absolute inset-x-0 bottom-0 z-30 flex max-h-[76vh] flex-col overflow-hidden rounded-t-2xl border-t border-border-strong bg-[oklch(0.215_0.012_250/0.97)] font-sans text-text shadow-phone-card backdrop-blur-[14px]"
      >
        <div className="flex flex-none items-center gap-[11px] px-[11px] py-2.5">
          <span
            className={`relative h-[46px] w-[46px] flex-none overflow-hidden rounded-[9px] border bg-control ${
              target.type === 'wish'
                ? 'border-wishlist'
                : 'border-[oklch(0.33_0.012_250)]'
            }`}
          >
            {coverSrc && (
              <img
                src={coverSrc}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">
              {title}
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] text-text-4">
              {subtitle}
            </span>
          </span>
          {target.type === 'stop' && target.timing && (
            <span className="flex-none text-right font-mono text-[13px] text-[oklch(0.84_0.008_250)]">
              <span className="block">
                {formatClock(target.timing.arrival)}
              </span>
              <span className="block text-[11px] text-[oklch(0.60_0.01_250)]">
                {formatDuration(target.timing.dwell)}
              </span>
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[oklch(0.26_0.013_250)] text-text-2"
          >
            ✕
          </button>
        </div>

        {hasNav && (
          <div className="flex flex-none items-center gap-2 px-[11px] pb-2.5">
            <button
              onClick={() => onStep(-1)}
              aria-label="Previous"
              className="h-[30px] w-[30px] flex-none rounded-lg border border-border-strong text-text-2"
            >
              ‹
            </button>
            <span className="flex flex-1 items-center justify-center gap-[7px] whitespace-nowrap font-mono text-[10.5px] tracking-[0.06em] text-text-3">
              <span>{navLabel}</span>
              <span className="inline-flex animate-om-nudge text-[13px] leading-none">
                ›
              </span>
            </span>
            <button
              onClick={() => onStep(1)}
              aria-label="Next"
              className="h-[30px] w-[30px] flex-none rounded-lg border border-border-strong text-text-2"
            >
              ›
            </button>
          </div>
        )}

        {editing && (target.type === 'stop' || target.type === 'wish') && (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-t border-[oklch(0.28_0.012_250)] px-[11px] py-3">
            <PinCardEdit
              key={
                target.type === 'stop'
                  ? `${target.stop.id}:${target.stop.updated}`
                  : `${target.item.id}:${target.item.updated}`
              }
              stop={target.type === 'stop' ? target.stop : target.item}
              isWish={target.type === 'wish'}
              onUpdate={onUpdateStop}
              onPlaceAccessPoint={onPlaceAccessPoint}
              onClearAccessPoint={onClearAccessPoint}
              onAddBlock={onAddBlock}
              onAddPrivateNote={onAddPrivateNote}
              openKindPickerSignal={openKindPickerSignal}
            />
          </div>
        )}

        {renderActions()}
      </div>
    );
  }

  return (
    // `absolute` within the map's relative wrapper, not `fixed` — same
    // reasoning as the phone branch above; on desktop the wrapper spans the
    // same box the viewport-fixed version used to assume, so this is a
    // no-op there and a correctness fix on phone.
    <div className="absolute bottom-3.5 left-3.5 z-30 flex max-h-[calc(100vh-140px)] w-[min(382px,calc(100vw-28px))] flex-col overflow-hidden rounded-[14px] border border-border-strong bg-surface-4 font-sans text-text shadow-card">
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
          <h2 className="m-0 min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {target.type === 'wish' && (
            <span className="self-center">
              <ContributorPill poi={target.item} variant="card" />
            </span>
          )}
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
                  {target.timing
                    ? describeDaylight(
                        target.daylight,
                        target.timing.arrival,
                        target.afterDark,
                      ).line
                    : `Daylight until ${formatClock(target.daylight.sunset)} · ${
                        target.afterDark ? 'after dark' : 'well clear'
                      }`}
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

        {(target.type === 'stop' || target.type === 'wish') &&
          (costs.length > 0 || editing) && (
            <CostField cost={costs[0]} onChange={onChangeCost} />
          )}

        {myNotes.length > 0 && (
          <div className="mt-3 rounded-[9px] border border-border-strong bg-surface-3 px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-text-4">
              My notes
            </div>
            {myNotes.map((note) => (
              <div
                key={note.id}
                className="prose-note mt-1.5 text-[13.5px] text-text-2 [text-wrap:pretty] [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(note.body ?? ''),
                }}
              />
            ))}
          </div>
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

        {editing && (target.type === 'stop' || target.type === 'wish') && (
          <PinCardEdit
            key={
              target.type === 'stop'
                ? `${target.stop.id}:${target.stop.updated}`
                : `${target.item.id}:${target.item.updated}`
            }
            stop={target.type === 'stop' ? target.stop : target.item}
            isWish={target.type === 'wish'}
            onUpdate={onUpdateStop}
            onPlaceAccessPoint={onPlaceAccessPoint}
            onClearAccessPoint={onClearAccessPoint}
            onAddBlock={onAddBlock}
            onAddPrivateNote={onAddPrivateNote}
            openKindPickerSignal={openKindPickerSignal}
          />
        )}
      </div>

      {renderActions()}
    </div>
  );
}
