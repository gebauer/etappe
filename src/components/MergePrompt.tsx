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
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 pt-24"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-slate-900">
          Already on the itinerary?
        </p>
        <p className="mt-1 text-sm text-slate-600">
          &ldquo;{candidateName}&rdquo; is within 100m of{' '}
          <strong>{existingStop.title}</strong>, already a stop.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={onUseExisting}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Use {existingStop.title}
          </button>
          <button
            onClick={onCreateNew}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Create a separate stop anyway
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-slate-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
