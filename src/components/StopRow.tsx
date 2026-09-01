import { formatClock, type StopTiming } from '../lib/cascade';
import { formatDuration } from '../lib/format';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import type { StopsResponse } from '../types/pb';

interface Props {
  stop: StopsResponse;
  /** 1-indexed position within its day — the same number the map pin shows
   * (WORK 12.4), which is how a row and its pin are correlated now that the
   * pin carries no title. */
  seq: number;
  timing?: StopTiming;
  photoUrl?: string | null;
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (additive: boolean) => void;
  onHover?: (hovering: boolean) => void;
}

/**
 * One stop in the itinerary column (design handoff, "Stop row"). Display
 * only: every field that used to be inline-editable here (title, dwell,
 * anchor, type, accommodation) is edited in the card instead (WORK
 * 12.2/12.3), and the row's delete ✕ is gone too — `Remove` on the card
 * carries the confirmation the ✕ never had. Clicking selects, which is what
 * opens the card.
 */
export function StopRow({
  stop,
  seq,
  timing,
  photoUrl,
  selected,
  hovered,
  onSelect,
  onHover,
}: Props) {
  const dwell = timing ? formatDuration(timing.dwell) : null;
  const kind = TAXONOMY[stop.kind as Kind]?.label ?? stop.kind;

  return (
    <div
      onClick={(e) => onSelect?.(e.metaKey || e.ctrlKey)}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`flex cursor-pointer items-center gap-[11px] rounded-[10px] border px-[11px] py-[9px] ${
        selected
          ? 'border-[oklch(0.72_0.13_215/0.55)] bg-accent-surface'
          : hovered
            ? 'border-transparent bg-[oklch(0.23_0.012_250)]'
            : 'border-transparent'
      }`}
    >
      <span
        className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full font-mono text-[11px] ${
          selected ? 'bg-accent text-on-accent' : 'bg-control text-text-2'
        }`}
      >
        {seq}
      </span>

      <span
        className={`h-[38px] w-[38px] flex-none overflow-hidden rounded-lg border bg-control ${
          selected
            ? 'border-[oklch(0.72_0.13_215/0.6)]'
            : 'border-border-strong'
        }`}
      >
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-[13.5px] font-medium">
          {stop.starred && (
            <span className="flex-none text-wishlist" title="Starred">
              ★
            </span>
          )}
          <span className="truncate">{stop.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-[oklch(0.63_0.01_250)]">
          {kind}
          {dwell ? ` · ${dwell}` : ''}
        </span>
      </span>

      <span className="flex-none text-right font-mono">
        <span className="block text-[12.5px]">
          {timing ? formatClock(timing.arrival) : '—'}
        </span>
        {timing && timing.departure !== timing.arrival && (
          <span className="block text-[11.5px] text-text-5">
            {formatClock(timing.departure)}
          </span>
        )}
      </span>
    </div>
  );
}
