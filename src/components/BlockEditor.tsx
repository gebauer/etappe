import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
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
  /** One step up or down — the accessible path, kept for the drag handle's
   * arrow keys now that the ↑ ↓ buttons are gone. */
  onMove: (blockId: string, dir: -1 | 1) => void;
  /** Drop a dragged row at an arbitrary position (WORK 18.2). */
  onReorder?: (blockId: string, targetIndex: number) => void;
  onUploadFile: (blockId: string, file: File) => Promise<void>;
}

/** The one field style, per the handoff: 34px, dark, never white. */
const FIELD =
  'h-[34px] w-full rounded-lg border border-[oklch(0.32_0.012_250)] bg-[oklch(0.19_0.012_250)] px-2.5 text-[13px] text-text outline-none placeholder:text-text-4 focus:border-accent';

/** The real backend limit — `blocks.file` is `maxSize: 10485760` with no
 * mime restriction (migration `1788000000`). The handoff's own copy said
 * "JPG or PNG · up to 12 MB", which this collection would not honour. */
const UPLOAD_HINT = 'Images · up to 10 MB';

const KIND_LABEL: Record<string, string> = {
  note: 'NOTE',
  link: 'LINK',
  photo: 'PHOTO',
  file: 'FILE',
};

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** True once a block holds anything worth confirming the loss of. */
function hasContent(block: BlocksResponse): boolean {
  return !!(block.body?.trim() || block.url?.trim() || block.file);
}

/**
 * Note / link / photo / file blocks (design handoff (9), "Block editor",
 * WORK 18.2). Replaces the stacked-open editor in native light controls:
 * a collapsed list of 42px rows with **one block open at a time**, a drag
 * handle instead of per-row ↑ ↓, a segmented visibility control instead of
 * a native `<select>`, and a dashed dropzone instead of
 * `Choose file / No file chosen`. No white fields anywhere.
 *
 * Behaviour carried over unchanged: uncontrolled inputs keyed by
 * `id:updated` so an external reload refreshes them, commit-on-blur, the
 * EXIF upload path, Markdown note preview (WORK 7.1/7.2), and the
 * Wikimedia attribution line.
 */
export function BlockEditor({
  blocks,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
  onReorder,
  onUploadFile,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  function requestDelete(block: BlocksResponse) {
    if (!hasContent(block) || confirmingId === block.id) {
      setConfirmingId(null);
      if (openId === block.id) setOpenId(null);
      onDelete(block.id);
      return;
    }
    setConfirmingId(block.id);
  }

  return (
    <div>
      {blocks.length === 0 && (
        <p className="text-[12.5px] text-text-4">
          No notes yet — add a note, link or photo.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {blocks.map((block, i) => {
          const open = openId === block.id;
          return (
            <div
              key={`${block.id}:${block.updated}`}
              onDragOver={(e) => dragId && e.preventDefault()}
              onDrop={() => {
                if (dragId && dragId !== block.id) onReorder?.(dragId, i);
                setDragId(null);
              }}
              className={dragId === block.id ? 'opacity-40' : ''}
            >
              {open ? (
                <OpenBlock
                  block={block}
                  index={i}
                  count={blocks.length}
                  onUpdate={onUpdate}
                  onMove={onMove}
                  onUploadFile={onUploadFile}
                  onClose={() => setOpenId(null)}
                  onDragStart={() => setDragId(block.id)}
                  onDragEnd={() => setDragId(null)}
                />
              ) : (
                <CollapsedRow
                  block={block}
                  index={i}
                  count={blocks.length}
                  confirming={confirmingId === block.id}
                  onOpen={() => {
                    setConfirmingId(null);
                    setOpenId(block.id);
                  }}
                  onMove={onMove}
                  onDelete={() => requestDelete(block)}
                  onCancelConfirm={() => setConfirmingId(null)}
                  onDragStart={() => setDragId(block.id)}
                  onDragEnd={() => setDragId(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Below the list — they read as "append", which is what they do. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <AddButton label="Note" onClick={() => onAdd('note')} />
        <AddButton label="Link" onClick={() => onAdd('link')} />
        <AddButton label="Photo" onClick={() => onAdd('photo')} />
        <AddButton label="File" onClick={() => onAdd('file')} />
      </div>
    </div>
  );
}

/** The shared 16px grab handle. Arrow keys move the block while it has
 * focus — the accessible replacement for the ↑ ↓ buttons the design drops. */
function DragHandle({
  index,
  count,
  onMove,
  blockId,
}: {
  index: number;
  count: number;
  onMove: Props['onMove'];
  blockId: string;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Reorder — position ${index + 1} of ${count}. Use the arrow keys.`}
      title="Drag to reorder, or focus and use the arrow keys"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' && index > 0) {
          e.preventDefault();
          e.stopPropagation();
          onMove(blockId, -1);
        }
        if (e.key === 'ArrowDown' && index < count - 1) {
          e.preventDefault();
          e.stopPropagation();
          onMove(blockId, 1);
        }
      }}
      className="w-4 flex-none cursor-grab select-none text-center text-[13px] leading-none text-[oklch(0.46_0.01_250)] outline-none focus-visible:text-text"
    >
      ⠿
    </span>
  );
}

function CollapsedRow({
  block,
  index,
  count,
  confirming,
  onOpen,
  onMove,
  onDelete,
  onCancelConfirm,
  onDragStart,
  onDragEnd,
}: {
  block: BlocksResponse;
  index: number;
  count: number;
  confirming: boolean;
  onOpen: () => void;
  onMove: Props['onMove'];
  onDelete: () => void;
  onCancelConfirm: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const thumb =
    block.kind === 'photo' ? blockFileUrl(pb, block, '80x80') : null;
  const host = hostOf(block.url);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="flex h-[42px] cursor-pointer items-center gap-2 rounded-[9px] border border-[oklch(0.28_0.012_250)] bg-surface-3 px-2 hover:border-[oklch(0.36_0.012_250)] hover:bg-[oklch(0.225_0.012_250)]"
    >
      <DragHandle
        index={index}
        count={count}
        onMove={onMove}
        blockId={block.id}
      />
      <span className="w-11 flex-none font-mono text-[9.5px] tracking-[0.07em] text-text-4">
        {KIND_LABEL[block.kind] ?? block.kind.toUpperCase()}
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-2">
        {thumb && (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-[26px] w-[26px] flex-none rounded object-cover"
          />
        )}
        <span className="min-w-0 truncate text-[13px] text-[oklch(0.86_0.006_250)]">
          {summaryOf(block)}
        </span>
        {block.kind === 'link' && host && (
          <span className="flex-none font-mono text-[11px] text-text-5">
            {host}
          </span>
        )}
      </span>

      <span className="h-5 flex-none rounded-[10px] bg-control px-2 text-[10.5px] leading-5 text-[oklch(0.72_0.01_250)]">
        {visibilityLabel(block.visibility)}
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onBlur={onCancelConfirm}
        title={confirming ? undefined : 'Delete this block'}
        aria-label={confirming ? 'Confirm delete' : 'Delete this block'}
        className={`h-[22px] flex-none rounded-md px-1.5 text-[12px] ${
          confirming
            ? 'bg-[oklch(0.26_0.03_25)] text-[oklch(0.80_0.11_25)]'
            : 'text-text-5 hover:bg-[oklch(0.26_0.03_25)] hover:text-[oklch(0.80_0.11_25)]'
        }`}
      >
        {confirming ? 'Delete?' : '✕'}
      </button>
    </div>
  );
}

function summaryOf(block: BlocksResponse): string {
  if (block.kind === 'note') {
    return block.body?.trim().split('\n')[0] || 'Empty note';
  }
  if (block.kind === 'link') {
    return block.title?.trim() || block.url?.trim() || 'Empty link';
  }
  return block.title?.trim() || block.file || block.url?.trim() || 'No file';
}

function visibilityLabel(v: string): string {
  return v === 'private' ? 'Private' : v === 'public' ? 'Public' : 'Trip';
}

/**
 * The open block: a panel, one at a time.
 *
 * **Deviation from the handoff:** its visibility control is specced as two
 * segments (`Trip` / `Private`) — "two options do not deserve a dropdown".
 * There are three: `public` is what the share hook publishes (WORK 16.6,
 * `share.pb.js`), so dropping it here would make a public block
 * unreachable and quietly break the read-only link. Same control, three
 * segments.
 */
function OpenBlock({
  block,
  index,
  count,
  onUpdate,
  onMove,
  onUploadFile,
  onClose,
  onDragStart,
  onDragEnd,
}: {
  block: BlocksResponse;
  index: number;
  count: number;
  onUpdate: Props['onUpdate'];
  onMove: Props['onMove'];
  onUploadFile: Props['onUploadFile'];
  onClose: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const options: BlockVisibility[] = ['private', 'trip', 'public'];
  return (
    <div className="rounded-[10px] border border-[oklch(0.36_0.012_250)] bg-surface-4">
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="flex h-10 items-center gap-2 border-b border-[oklch(0.28_0.012_250)] px-2"
      >
        <DragHandle
          index={index}
          count={count}
          onMove={onMove}
          blockId={block.id}
        />
        <span className="w-11 flex-none font-mono text-[9.5px] tracking-[0.07em] text-[oklch(0.72_0.01_250)]">
          {KIND_LABEL[block.kind] ?? block.kind.toUpperCase()}
        </span>

        <div className="ml-auto flex h-6 items-center gap-0.5 rounded-xl bg-[oklch(0.185_0.012_250)] p-0.5">
          {options.map((v) => (
            <button
              key={v}
              onClick={() => onUpdate(block.id, { visibility: v })}
              title={
                v === 'private'
                  ? 'Only you can see this'
                  : v === 'trip'
                    ? 'Everyone on the trip can see this'
                    : 'Published on the public share link'
              }
              className={`h-5 rounded-[10px] px-2 text-[10.5px] ${
                block.visibility === v
                  ? 'bg-[oklch(0.30_0.013_250)] text-text'
                  : 'text-text-4 hover:text-text-2'
              }`}
            >
              {visibilityLabel(v)}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          aria-label="Collapse this block"
          title="Collapse"
          className="h-[22px] flex-none rounded-md px-1.5 text-[12px] text-text-5 hover:bg-control hover:text-text"
        >
          ▴
        </button>
      </div>

      <div className="flex flex-col gap-[9px] p-[11px]">
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
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: the handoff asks for a textarea that follows its content
  // rather than a fixed three rows with its own scrollbar.
  function grow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(72, el.scrollHeight)}px`;
  }
  useEffect(() => grow(ref.current), []);

  return (
    <>
      <textarea
        ref={ref}
        defaultValue={block.body}
        onInput={(e) => grow(e.currentTarget)}
        onBlur={(e) => {
          if (e.target.value !== block.body)
            onUpdate(block.id, { body: e.target.value });
        }}
        placeholder="Markdown supported — **bold**, *italic*, [links](…), - lists"
        className="min-h-[72px] w-full resize-none rounded-lg border border-[oklch(0.32_0.012_250)] bg-[oklch(0.19_0.012_250)] px-2.5 py-2 text-[13.5px] text-text outline-none [text-wrap:pretty] placeholder:text-text-4 focus:border-accent"
      />
      {block.body?.trim() && (
        <div
          className="prose-note text-[13px] text-text-2 [text-wrap:pretty] [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-control [&_code]:px-1 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(block.body) }}
        />
      )}
    </>
  );
}

/** URL first, title second — the current order asks for a title before the
 * thing it titles. */
function LinkBody({
  block,
  onUpdate,
}: {
  block: BlocksResponse;
  onUpdate: Props['onUpdate'];
}) {
  return (
    <>
      <input
        defaultValue={block.url}
        onBlur={(e) => {
          if (e.target.value !== block.url)
            onUpdate(block.id, { url: e.target.value });
        }}
        onKeyDown={commitOnEnter}
        placeholder="https://…"
        className={`${FIELD} font-mono text-[12.5px]`}
      />
      <input
        defaultValue={block.title}
        onBlur={(e) => {
          if (e.target.value !== block.title)
            onUpdate(block.id, { title: e.target.value });
        }}
        onKeyDown={commitOnEnter}
        placeholder="Title (optional)"
        className={FIELD}
      />
      {block.url && (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-[12px] text-accent underline"
        >
          {block.title || block.url}
        </a>
      )}
    </>
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
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // onUploadFile funnels through TripEditor's run(), which already surfaces
  // a failure via the shared action-error banner — this only tracks the
  // in-flight state for the "Uploading…" hint below.
  function handleFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    void onUploadFile(block.id, f).finally(() => setUploading(false));
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {block.file ? (
        <div className="flex items-start gap-2.5">
          {src && block.kind === 'photo' && (
            <img
              src={src}
              alt={block.title || ''}
              className="max-h-32 flex-1 rounded-lg object-contain"
            />
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-[30px] flex-none rounded-lg border border-border-strong px-2.5 text-[12px] text-text-2 hover:bg-control hover:text-text disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex h-[92px] w-full flex-col items-center justify-center gap-1 rounded-[9px] border border-dashed ${
              dragOver
                ? 'border-[oklch(0.50_0.05_215)] bg-[oklch(0.21_0.014_250)]'
                : 'border-[oklch(0.36_0.012_250)] bg-[oklch(0.195_0.012_250)] hover:border-[oklch(0.50_0.05_215)] hover:bg-[oklch(0.21_0.014_250)]'
            }`}
          >
            <span className="text-[13px] font-medium text-text-2">
              {uploading
                ? 'Uploading — reading EXIF, then sending…'
                : 'Drop an image, or click to browse'}
            </span>
            <span className="text-[11.5px] text-text-4">{UPLOAD_HINT}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-[oklch(0.54_0.01_250)]">
              or paste a url
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <input
            defaultValue={block.url}
            onBlur={(e) => {
              if (e.target.value !== block.url)
                onUpdate(block.id, { url: e.target.value });
            }}
            onKeyDown={commitOnEnter}
            placeholder="https://… (an image URL)"
            className={`${FIELD} font-mono text-[12.5px]`}
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
        className={FIELD}
      />

      {block.attribution_author && (
        <p className="text-[10.5px] text-text-4">
          © {block.attribution_author}
          {block.attribution_licence ? ` · ${block.attribution_licence}` : ''}
        </p>
      )}
      {(!!block.lat || block.taken_at) && (
        <p className="font-mono text-[10.5px] text-text-4">
          {block.lat
            ? `📍 ${block.lat.toFixed(5)}, ${block.lon.toFixed(5)}`
            : ''}
          {block.lat && block.taken_at ? ' · ' : ''}
          {block.taken_at
            ? `🕘 ${block.taken_at.slice(0, 19).replace('T', ' ')}`
            : ''}
        </p>
      )}
    </>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-[30px] rounded-lg border border-dashed border-border-strong px-2.5 text-[12px] text-text-2 hover:border-text-5 hover:text-text"
    >
      + {label}
    </button>
  );
}
