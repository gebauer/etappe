import type { StopsResponse } from '../types/pb';

interface Props {
  candidateName: string;
  existingStop: StopsResponse;
  onUseExisting: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

/** WORK 6.5 / BUILD §6: "a stop within 100m of an existing one prompts to
 * merge instead of duplicating." */
export function MergePrompt({
  candidateName,
  existingStop,
  onUseExisting,
  onCreateNew,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-scrim pt-24 font-sans"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border-strong bg-surface-2 p-4 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-medium text-text">
          Already on the itinerary?
        </p>
        <p className="mt-1 text-[13px] text-text-2">
          &ldquo;{candidateName}&rdquo; is within 100m of{' '}
          <strong className="font-semibold text-text">
            {existingStop.title}
          </strong>
          , already a stop.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={onUseExisting}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-on-accent hover:brightness-110"
          >
            Use {existingStop.title}
          </button>
          <button
            onClick={onCreateNew}
            className="rounded-lg border border-border-strong px-3 py-2 text-[13px] text-text-2 hover:bg-control hover:text-text"
          >
            Create a separate stop anyway
          </button>
          <button
            onClick={onCancel}
            className="text-[11px] text-text-4 hover:text-text-2 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
