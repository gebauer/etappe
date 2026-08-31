/**
 * Minimal, XSS-safe Markdown renderer for note blocks (WORK 7.1). Travel notes
 * need only a small subset — bold, italic, inline code, links, line breaks and
 * bullet lists — so we hand-roll it rather than pull in a Markdown dependency.
 *
 * Safety: the source is HTML-escaped first, so the only tags in the output are
 * the ones this function emits. Link hrefs are restricted to http(s)/mailto to
 * block `javascript:` and other script-bearing schemes.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeHref(url: string): string | null {
  const u = url.trim();
  return /^(https?:|mailto:)/i.test(u) ? u : null;
}

// Private-use sentinels wrap held-token indices. They cannot occur in escaped
// text, so restoring a token can't collide with real digits in the note.
const HOLD_OPEN = '';
const HOLD_CLOSE = '';

/** Inline spans, applied to already-escaped text. Code spans and links are
 * pulled into placeholders first so bold/italic passes can't reach inside them:
 * markers stay literal in code, and `_`/`*` in a URL are left alone. */
function renderInline(escaped: string): string {
  const held: string[] = [];
  const hold = (html: string): string => {
    held.push(html);
    return `${HOLD_OPEN}${held.length - 1}${HOLD_CLOSE}`;
  };

  const withTokens = escaped
    .replace(/`([^`]+)`/g, (_m, code: string) => hold(`<code>${code}</code>`))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
      const href = safeHref(url);
      return href
        ? hold(
            `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`,
          )
        : text;
    });

  const styled = withTokens
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');

  return styled.replace(
    new RegExp(`${HOLD_OPEN}(\\d+)${HOLD_CLOSE}`, 'g'),
    (_m, i: string) => held[+i]!,
  );
}

/** Render a Markdown subset to a safe HTML string. */
export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src ?? '').split(/\r?\n/);
  const html: string[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (list.length) {
      html.push(`<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>`);
      list = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${para.join('<br>')}</p>`);
      para = [];
    }
  };

  for (const line of lines) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      list.push(renderInline(bullet[1]!));
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(renderInline(line));
    }
  }
  flushPara();
  flushList();
  return html.join('');
}
