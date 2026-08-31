import { useState, type KeyboardEvent } from 'react';
import { pb } from '../lib/pb';
import { renderMarkdown } from '../lib/markdown';
import type { BlocksResponse } from '../types/pb';
import {
  blockFileUrl,
  type BlockKind,
  type BlockPatch,
  type BlockVisibility,
} from '../lib/pb-blocks';

interface Props {
  blocks: BlocksResponse[];
  onAdd: (kind: BlockKind) => void;
  onUpdate: (blockId: string, patch: BlockPatch) => void;
  onDelete: (blockId: string) => void;
  onMove: (blockId: string, dir: -1 | 1) => void;
  onUploadFile: (blockId: string, file: File) => Promise<void>;
}

const input = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

/** Note / link / photo / file blocks on a stop, with visibility, reorder,
 * Markdown-rendered notes (WORK 7.1), and photo upload with EXIF extraction
 * (WORK 7.2) — a URL is still accepted as a fallback for a block that isn't
 * an upload (import, paste). Inputs are uncontrolled, keyed by id+updated
 * upstream. */
export function BlockEditor({
  blocks,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
  onUploadFile,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">
          Notes &amp; media
        </span>
        <div className="ml-auto flex gap-1">
          <AddButton label="Note" onClick={() => onAdd('note')} />
          <AddButton label="Link" onClick={() => onAdd('link')} />
          <AddButton label="Photo" onClick={() => onAdd('photo')} />
        </div>
      </div>

      {blocks.length === 0 && (
        <p className="text-xs text-slate-400">
          No notes yet — add a note, link or photo.
        </p>
      )}

      {blocks.map((block, i) => (
        <div
          key={`${block.id}:${block.updated}`}
          className="rounded border border-slate-200 p-2"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="uppercase tracking-wide">{block.kind}</span>
            <select
              defaultValue={block.visibility}
              onChange={(e) =>
                onUpdate(block.id, {
                  visibility: e.target.value as BlockVisibility,
                })
              }
              title="Who can see this block"
              className="rounded border border-slate-200 px-1 py-0.5"
            >
              <option value="private">private</option>
              <option value="trip">trip</option>
              <option value="public">public</option>
            </select>
            <div className="ml-auto flex items-center gap-0.5">
              <IconBtn
                label="↑"
                disabled={i === 0}
                onClick={() => onMove(block.id, -1)}
              />
              <IconBtn
                label="↓"
                disabled={i === blocks.length - 1}
                onClick={() => onMove(block.id, 1)}
              />
              <IconBtn label="✕" onClick={() => onDelete(block.id)} />
            </div>
          </div>

          {block.kind === 'note' && (
            <NoteBody block={block} onUpdate={onUpdate} />
          )}
          {block.kind === 'link' && (
            <LinkBody block={block} onUpdate={onUpdate} />
          )}
          {(block.kind === 'photo' || block.kind === 'file') && (
            <MediaBody
              block={block}
              onUpdate={onUpdate}
              onUploadFile={onUploadFile}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function NoteBody({
  block,
  onUpdate,
}: {
  block: BlocksResponse;
  onUpdate: Props['onUpdate'];
}) {
  return (
    <div className="space-y-1">
      <textarea
        defaultValue={block.body}
        onBlur={(e) => {
          if (e.target.value !== block.body)
            onUpdate(block.id, { body: e.target.value });
        }}
        rows={3}
        placeholder="Markdown supported — **bold**, *italic*, [links](…), - lists"
        className={`${input} resize-y font-mono text-xs`}
      />
      {block.body?.trim() && (
        <div
          className="prose-note text-sm text-slate-700 [&_a]:text-sky-700 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(block.body) }}
        />
      )}
    </div>
  );
}

function LinkBody({
  block,
  onUpdate,
}: {
  block: BlocksResponse;
  onUpdate: Props['onUpdate'];
}) {
  return (
    <div className="space-y-1">
      <input
        defaultValue={block.title}
        onBlur={(e) => {
          if (e.target.value !== block.title)
            onUpdate(block.id, { title: e.target.value });
        }}
        onKeyDown={commitOnEnter}
        placeholder="Title (optional)"
        className={input}
      />
      <input
        defaultValue={block.url}
        onBlur={(e) => {
          if (e.target.value !== block.url)
            onUpdate(block.id, { url: e.target.value });
        }}
        onKeyDown={commitOnEnter}
        placeholder="https://…"
        className={input}
      />
      {block.url && (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-xs text-sky-700 underline"
        >
          {block.title || block.url}
        </a>
      )}
    </div>
  );
}

function MediaBody({
  block,
  onUpdate,
  onUploadFile,
}: {
  block: BlocksResponse;
  onUpdate: Props['onUpdate'];
  onUploadFile: Props['onUploadFile'];
}) {
  const src = blockFileUrl(pb, block, '640x0');
  const [uploading, setUploading] = useState(false);

  // onUploadFile funnels through TripEditor's run(), which already surfaces
  // a failure via the shared action-error banner — this only tracks the
  // in-flight state for the "Uploading…" hint below.
  function handleFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    void onUploadFile(block.id, f).finally(() => setUploading(false));
  }

  return (
    <div className="space-y-1">
      {!block.file && (
        <>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="block text-xs text-slate-600"
          />
          {uploading && (
            <p className="text-xs text-slate-400">
              Uploading — reading EXIF, then sending…
            </p>
          )}
          <input
            defaultValue={block.url}
            onBlur={(e) => {
              if (e.target.value !== block.url)
                onUpdate(block.id, { url: e.target.value });
            }}
            onKeyDown={commitOnEnter}
            placeholder="…or an image URL instead of uploading"
            className={input}
          />
        </>
      )}
      <input
        defaultValue={block.title}
        onBlur={(e) => {
          if (e.target.value !== block.title)
            onUpdate(block.id, { title: e.target.value });
        }}
        onKeyDown={commitOnEnter}
        placeholder="Caption (optional)"
        className={input}
      />
      {src && block.kind === 'photo' && (
        <img
          src={src}
          alt={block.title || ''}
          className="max-h-40 rounded object-contain"
        />
      )}
      {block.attribution_author && (
        <p className="text-[10px] text-slate-400">
          © {block.attribution_author}
          {block.attribution_licence ? ` · ${block.attribution_licence}` : ''}
        </p>
      )}
      {(!!block.lat || block.taken_at) && (
        <p className="text-[10px] text-slate-400">
          {block.lat
            ? `📍 ${block.lat.toFixed(5)}, ${block.lon.toFixed(5)}`
            : ''}
          {block.lat && block.taken_at ? ' · ' : ''}
          {block.taken_at
            ? `🕘 ${block.taken_at.slice(0, 19).replace('T', ' ')}`
            : ''}
        </p>
      )}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
    >
      + {label}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
    >
      {label}
    </button>
  );
}
