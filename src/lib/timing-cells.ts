/**
 * Builds the ARRIVE / DEPART / DWELL cells for a stop (WORK 16.1).
 *
 * Both clocks always show their computed time — you type over what you read
 * — and the pin marks which of the two is the anchor the other is derived
 * from. Presentation shape only; `TimingCells` renders it and
 * `planTimingEdit` interprets what comes back.
 */
import type { StopsResponse } from '../types/pb';
import type { StopTiming } from './cascade';
import { formatDuration } from './format';
import { formatClock, type TimingCell } from './timing-edit';

export interface TimingCellSpec {
  label: string;
  /** Rendered when the cell isn't editable, or has no value yet. */
  value: string | null;
  cell?: TimingCell;
  /** Raw value for the input: `HH:MM` for a clock, minutes for dwell. */
  editValue?: string;
  pinned?: boolean;
  /** Highlighted as changed by something the user didn't type into. */
  changed?: boolean;
  accent?: boolean;
}

export function timingCells(
  stop: StopsResponse,
  timing: StopTiming | undefined,
  dwellChanged = false,
): TimingCellSpec[] {
  const anchored = !!stop.anchor_time?.trim();
  const anchorType = stop.anchor_type === 'departure' ? 'departure' : 'arrival';
  return [
    {
      label: 'Arrive',
      cell: 'arrival',
      value: timing ? formatClock(timing.arrival) : null,
      editValue: timing ? formatClock(timing.arrival) : '',
      pinned: anchored && anchorType === 'arrival',
    },
    {
      label: 'Depart',
      cell: 'departure',
      value: timing ? formatClock(timing.departure) : null,
      editValue: timing ? formatClock(timing.departure) : '',
      pinned: anchored && anchorType === 'departure',
    },
    {
      label: 'Dwell',
      cell: 'dwell',
      value: timing ? formatDuration(timing.dwell) : null,
      editValue: timing ? String(timing.dwell) : '',
      changed: dwellChanged,
    },
  ];
}
