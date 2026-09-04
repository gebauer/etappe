/**
 * Confirms a stop moved by dragging its map marker (WORK 24). Dragging is a
 * one-finger gesture with no undo — the old coordinates are gone the moment
 * it commits — so the drop asks before it writes. Cancelling snaps the
 * marker back to where the record still says the stop is.
 *
 * Two things can be dragged, and they mean different things: the numbered
 * pin *is* the place, so moving it re-routes the legs either side; the
 * dashed access point only changes where routing enters, leaving the place
 * itself alone.
 */
export function MoveStopPrompt({
  title,
  kind,
  lat,
  lon,
  onConfirm,
  onCancel,
}: {
  title: string;
  kind: 'stop' | 'access';
  lat: number;
  lon: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isStop = kind === 'stop';
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[oklch(0.12_0.015_250/0.6)] p-6 font-sans"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border-strong bg-surface-2 p-4 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] font-semibold">
          {isStop ? 'Move this stop?' : 'Move the access point?'}
        </p>
        <p className="mt-1.5 text-[13px] text-text-3">
          {isStop ? (
            <>
              <strong className="text-text-2">{title}</strong> moves to the spot
              you dropped it on, and the legs either side are re-routed.
            </>
          ) : (
            <>
              Routing into and out of{' '}
              <strong className="text-text-2">{title}</strong> will use the new
              point. The stop itself stays where it is.
            </>
          )}
        </p>
        <p className="mt-2 font-mono text-[11.5px] text-text-5">
          {lat.toFixed(5)}, {lon.toFixed(5)}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onConfirm}
            autoFocus
            className="h-[34px] flex-1 rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent"
          >
            Move it
          </button>
          <button
            onClick={onCancel}
            className="h-[34px] flex-1 rounded-lg border border-border-strong px-3 text-[13px] text-text-2 hover:bg-control"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
