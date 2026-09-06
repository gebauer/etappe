import { formatDuration } from '../lib/format';
import type { DayTotals } from '../lib/day-totals';

interface Props {
  totals: DayTotals;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The day's shape in two figures, on their own line under the day header's
 * date: how long it spends driving and how long it spends at stops. Not on
 * the date line itself — the header shares that row with the span and the
 * ↗/✕ buttons, and in a 400px column the totals get truncated away.
 *
 * The emoji carry the meaning at a glance and the `title` spells it out;
 * there is no room for labels. Neither figure renders when it is zero: a
 * rest day has no road time, a pure transfer day has no dwell.
 */
export function DayTotalsChips({ totals }: Props) {
  const { roadMin, stopMin, legCount, stopCount, hasLeadingLeg } = totals;
  if (roadMin === 0 && stopMin === 0) return null;

  return (
    <div className="mt-1 flex items-center gap-2 truncate font-mono text-[11.5px] text-text-4">
      {roadMin > 0 && (
        <span
          title={`Time on the road — ${formatDuration(roadMin)} across ${plural(
            legCount,
            'leg',
          )}, buffers included${
            hasLeadingLeg
              ? ', counting the morning drive from the start point'
              : ''
          }`}
          className="whitespace-nowrap"
        >
          🛣️ {formatDuration(roadMin)}
        </span>
      )}
      {stopMin > 0 && (
        <span
          title={`Time at stops — ${formatDuration(
            stopMin,
          )} of planned dwell across ${plural(
            stopCount,
            'stop',
          )}. Sightseeing, walks and meals alike; the overnight and pass-through waypoints count for nothing.`}
          className="whitespace-nowrap"
        >
          📸 {formatDuration(stopMin)}
        </span>
      )}
    </div>
  );
}
