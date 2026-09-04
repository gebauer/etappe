/**
 * Confirms the Delete/Backspace shortcut (WORK 22). That key used to remove
 * the selected stop the instant it was pressed — the one destructive action
 * in the editor with no undo and no ask. Two changes: it now asks first, and
 * it no longer deletes. A stop leaves the itinerary by going back to the
 * wishlist (its blocks, star and access point travel with it), so a place
 * that took real planning is never lost to a mis-keypress.
 */
export function RecycleStopsPrompt({
  titles,
  onConfirm,
  onDismiss,
}: {
  /** The selected stops, for naming them in the prompt. */
  titles: string[];
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const n = titles.length;
  const what =
    n === 1 ? (
      <strong className="text-text-2">{titles[0]}</strong>
    ) : (
      `these ${n} stops`
    );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[oklch(0.12_0.015_250/0.6)]"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border-strong bg-surface-2 p-4 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] font-semibold">
          Move {n === 1 ? 'this stop' : `${n} stops`} to the wishlist?
        </p>
        <p className="mt-1.5 text-[13px] text-text-3">
          {what} {n === 1 ? 'leaves' : 'leave'} the itinerary and{' '}
          {n === 1 ? 'goes' : 'go'} back to the wishlist — notes, photos and the
          access point come along. Nothing is deleted.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onConfirm}
            autoFocus
            className="h-[34px] flex-1 rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent"
          >
            Move to wishlist
          </button>
          <button
            onClick={onDismiss}
            className="h-[34px] flex-1 rounded-lg border border-border-strong px-3 text-[13px] text-text-2 hover:bg-control"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
