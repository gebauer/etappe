import { useState } from 'react';
import { pb } from '../lib/pb';
import { renderMarkdown } from '../lib/markdown';
import { blockFileUrl } from '../lib/pb-blocks';
import { TAXONOMY, type Kind } from '../lib/taxonomy';
import type { BlocksResponse, PoisResponse } from '../types/pb';

interface Props {
  item: PoisResponse;
  blocks: BlocksResponse[];
  onPlace: () => void;
  onReject: () => void;
  onClose: () => void;
}

/** Lightweight read-only preview opened from a wishlist row (WORK 8.1
 * follow-up "visual review"): a look at what a Highlight actually brought in
 * — photos, description, links — before committing to Place or Reject,
 * instead of deciding from a bare title. Not the editable `BlockEditor`;
 * nothing shown here is ever written back. */
export function WishlistPreview({
  item,
  blocks,
  onPlace,
  onReject,
  onClose,
}: Props) {
  const photos = blocks.filter((b) => b.kind === 'photo');
  const notes = blocks.filter((b) => b.kind === 'note' && b.body?.trim());
  const links = blocks.filter((b) => b.kind === 'link');
  const [activePhoto, setActivePhoto] = useState(0);
  const hasCoords = !!item.lat && !!item.lon;
  const main = photos[activePhoto];
  const mainSrc = main ? blockFileUrl(pb, main) : null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 pt-16"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mainSrc && (
          <img
            src={mainSrc}
            alt={main?.title || item.title}
            className="h-56 w-full object-cover"
          />
        )}
        {photos.length > 1 && (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2">
            {photos.map((p, i) => {
              const thumb = blockFileUrl(pb, p);
              if (!thumb) return null;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePhoto(i)}
                  className={`h-12 w-12 shrink-0 overflow-hidden rounded ${
                    i === activePhoto ? 'ring-2 ring-slate-900' : 'opacity-70'
                  }`}
                >
                  <img
                    src={thumb}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
        {main?.attribution_author && (
          <p className="px-4 pt-2 text-[10px] text-slate-400">
            © {main.attribution_author}
            {main.attribution_licence ? ` · ${main.attribution_licence}` : ''}
          </p>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {item.title}
              </h2>
              <span className="text-xs text-slate-400">
                {TAXONOMY[item.kind as Kind]?.label ?? item.kind}
              </span>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>

          {notes.map((n) => (
            <div
              key={n.id}
              className="prose-note mt-3 text-sm text-slate-700 [&_a]:text-sky-700 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body) }}
            />
          ))}

          {item.notes?.trim() && (
            <p className="mt-3 text-sm text-slate-600">{item.notes}</p>
          )}

          {(links.length > 0 || item.url) && (
            <ul className="mt-3 space-y-1">
              {item.url && (
                <li>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-700 underline"
                  >
                    Source
                  </a>
                </li>
              )}
              {links.map((l) => (
                <li key={l.id}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-700 underline"
                  >
                    {l.title || l.url}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              onClick={onReject}
              className="text-sm text-slate-500 hover:text-red-600"
            >
              Reject
            </button>
            <button
              onClick={onPlace}
              disabled={!hasCoords}
              title={
                hasCoords
                  ? 'Place on the itinerary'
                  : 'No coordinates yet — edit it to add some'
              }
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Place on the itinerary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
