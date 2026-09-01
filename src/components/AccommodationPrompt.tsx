/**
 * Asks whether a stop that just became a hotel or campsite is where the day
 * actually ends up sleeping.
 *
 * `is_accommodation` is not decoration: the cascade warns when a day's last
 * stop isn't one (`NO_ACCOMMODATION`), and day-start continuity (WORK 13)
 * leaves the next morning from the previous day's accommodation. Until now
 * the flag lived only in the expanded full-details card, so picking "Hotel"
 * from the kind grid set an icon and nothing else — the day still read as
 * having nowhere to stay. Asking at the moment the kind is chosen is the
 * one point where the answer is obvious to the person choosing.
 *
 * It stays a question rather than an assumption because a hotel is often on
 * the itinerary for its restaurant, its car park or its view, and silently
 * marking those as the night's stay would move the next morning's start
 * point to the wrong place.
 */
export function AccommodationPrompt({
  title,
  dayLabel,
  onConfirm,
  onDismiss,
}: {
  title: string;
  dayLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[oklch(0.12_0.015_250/0.6)]"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border-strong bg-surface-2 p-4 text-text shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] font-semibold">Staying the night here?</p>
        <p className="mt-1.5 text-[13px] text-text-3">
          Marking <strong className="text-text-2">{title}</strong> as {dayLabel}
          &rsquo;s accommodation clears the &ldquo;nowhere to stay&rdquo;
          warning, and the next morning starts from here.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onConfirm}
            autoFocus
            className="h-[34px] flex-1 rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent"
          >
            Yes, we sleep here
          </button>
          <button
            onClick={onDismiss}
            className="h-[34px] flex-1 rounded-lg border border-border-strong px-3 text-[13px] text-text-2 hover:bg-control"
          >
            No, just a stop
          </button>
        </div>
      </div>
    </div>
  );
}
