import type { TimingEditPlan } from '../lib/timing-edit';

/**
 * Anchoring a stop that something upstream already governs (WORK 16.1).
 *
 * The cascade would simply let the later anchor win and file an
 * `anchorMiss` warning for the gap it opens. That is silent, and it throws
 * away the useful part: the gap is time you could actually spend. So ask
 * which of the two things the traveller means.
 *
 * The absorb branch names the stop it changes and the dwell it ends up
 * with, because that stop is not the one being edited — a dwell that grows
 * by three quarters of an hour somewhere you weren't looking must not be
 * something you discover later (author, WORK 16.1).
 */
export function TimingConflictPrompt({
  plan,
  onShift,
  onAbsorb,
  onCancel,
}: {
  plan: Extract<TimingEditPlan, { kind: 'conflict' }>;
  onShift: () => void;
  onAbsorb: () => void;
  onCancel: () => void;
}) {
  const later = plan.deltaMin > 0;
  const amount = Math.abs(plan.deltaMin);
  const amountText =
    amount < 60
      ? `${amount} min`
      : `${Math.floor(amount / 60)} h${amount % 60 ? ` ${amount % 60} min` : ''}`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[oklch(0.12_0.015_250/0.6)]"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-strong bg-surface-2 p-4 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] font-semibold">
          {plan.anchor.title} at {plan.anchor.to}?
        </p>
        <p className="mt-1.5 text-[13px] text-text-3">
          That is {amountText} {later ? 'later' : 'earlier'} than it works out
          to now, and{' '}
          <strong className="text-text-2">{plan.upstreamTitle}</strong> above it
          is already pinned. Something has to give.
        </p>

        <div className="mt-3.5 flex flex-col gap-2">
          <button
            onClick={onShift}
            className="rounded-lg border border-border-strong bg-control px-3 py-2.5 text-left hover:bg-control-hover"
          >
            <span className="block text-[13.5px] font-medium">
              Move the whole day
            </span>
            <span className="mt-0.5 block font-mono text-[11.5px] text-text-4">
              {plan.shift.title} {plan.shift.from} → {plan.shift.to}
            </span>
          </button>

          {plan.absorb && (
            <button
              onClick={onAbsorb}
              className="rounded-lg border border-border-strong bg-control px-3 py-2.5 text-left hover:bg-control-hover"
            >
              <span className="block text-[13.5px] font-medium">
                Spend the time at {plan.absorb.title}
              </span>
              <span className="mt-0.5 block font-mono text-[11.5px] text-text-4">
                dwell {plan.absorb.from} → {plan.absorb.to}
              </span>
            </button>
          )}
        </div>

        <button
          onClick={onCancel}
          className="mt-3 text-[12px] text-text-4 hover:text-text-2"
        >
          Leave it as it is
        </button>
      </div>
    </div>
  );
}
