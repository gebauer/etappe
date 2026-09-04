import type { TripCard, TripPhoto } from '../lib/trip-card';
import { NamePill } from './ContributorMark';

const STATUS_STYLE: Record<string, string> = {
  upcoming: 'bg-accent text-on-accent',
  progress: 'bg-accent text-on-accent',
  past: 'bg-control text-text-2',
  draft: 'bg-[oklch(0.30_0.045_80)] text-[oklch(0.90_0.10_85)]',
};

function Tile({ photo }: { photo: TripPhoto }) {
  return (
    <span className="relative block h-[46px] w-[88px] flex-none overflow-hidden rounded-[8px]">
      {photo.url ? (
        <img
          src={photo.url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${photo.color}, oklch(0.22 0.03 250))`,
          }}
        />
      )}
      <span className="absolute inset-x-1.5 bottom-1 truncate text-[9.5px] font-medium tracking-[0.02em] text-[oklch(0.95_0.01_250)] [text-shadow:0_1px_4px_oklch(0.13_0.02_250/0.8)]">
        {photo.place}
      </span>
    </span>
  );
}

/** One trip on the selection screen (WORK 21). The whole card is a button;
 * the ⚙ sits over it as a separate control (WORK 23). */
export function TripCardView({
  card,
  onOpen,
  onSettings,
}: {
  card: TripCard;
  onOpen: () => void;
  onSettings: () => void;
}) {
  const { trip, status, hero, strip } = card;
  return (
    <div className="group relative">
      <button
        onClick={onSettings}
        aria-label={`Settings for ${trip.title}`}
        title="Trip settings"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.20_0.013_250/0.85)] text-[13px] text-text-3 opacity-0 backdrop-blur-[4px] transition-opacity hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
      >
        ⚙
      </button>
      <button
        onClick={onOpen}
        className="flex w-full items-stretch gap-4 rounded-[14px] border border-[oklch(0.29_0.012_250)] bg-surface-2 p-3.5 text-left transition-colors hover:border-[oklch(0.40_0.012_250)] hover:bg-[oklch(0.215_0.012_250)]"
      >
        <span className="relative h-[152px] w-[236px] flex-none overflow-hidden rounded-[12px] bg-control">
          {hero?.url ? (
            <img
              src={hero.url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="absolute inset-0"
              style={{
                background: hero
                  ? `linear-gradient(135deg, ${hero.color}, oklch(0.20 0.03 250))`
                  : 'oklch(0.24 0.012 250)',
              }}
            />
          )}
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, oklch(0.13 0.02 250 / 0.66), transparent 52%)',
            }}
          />
          <span
            className={`absolute left-2.5 top-2.5 flex h-5 items-center rounded-[10px] px-2 text-[10.5px] font-medium ${STATUS_STYLE[status.kind]}`}
          >
            {status.label}
          </span>
          {hero?.place && (
            <span className="absolute bottom-2 left-2.5 right-2.5 truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-[oklch(0.90_0.01_250)]">
              {hero.place}
            </span>
          )}
        </span>

        {strip.length > 0 && (
          <span className="hidden flex-none flex-col gap-1.5 desktop:flex">
            {strip.map((t, i) => (
              <Tile key={i} photo={t} />
            ))}
          </span>
        )}

        <span className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-1">
          <span className="min-w-0">
            <span className="block truncate text-[19px] font-semibold tracking-[-0.01em]">
              {trip.title}
            </span>
            <span className="mt-0.5 block text-[13px] text-text-2">
              {card.dateRange}
            </span>
          </span>
          <span className="flex flex-wrap items-baseline gap-x-3.5 font-mono text-[12px] text-text-4">
            <span>
              {card.days} {card.days === 1 ? 'day' : 'days'}
            </span>
            <span>
              {card.stops} {card.stops === 1 ? 'stop' : 'stops'}
            </span>
            {card.km > 0 && <span>{card.km.toLocaleString()} km</span>}
            {card.costBand && (
              <span className="tracking-[0.04em] text-[oklch(0.82_0.11_85)]">
                {card.costBand}
              </span>
            )}
          </span>
          {card.contributors.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              {card.contributors.slice(0, 4).map((c) => (
                <NamePill key={c.name} name={c.name} color={c.color} />
              ))}
            </span>
          )}
        </span>

        <span className="flex flex-none flex-col items-end justify-between self-stretch py-0.5">
          <span className="font-mono text-[11px] text-text-5">
            {card.editedRelative}
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-text-2">
            {card.action}
            <span className="text-[15px] leading-none text-accent">›</span>
          </span>
        </span>
      </button>
    </div>
  );
}
