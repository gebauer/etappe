import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold, italic and inline code', () => {
    expect(renderMarkdown('a **b** c *d* `e`')).toBe(
      '<p>a <strong>b</strong> c <em>d</em> <code>e</code></p>',
    );
  });

  it('renders underscore italics', () => {
    expect(renderMarkdown('an _emphasised_ word')).toBe(
      '<p>an <em>emphasised</em> word</p>',
    );
  });

  it('renders http links and opens them safely', () => {
    expect(renderMarkdown('see [docs](https://x.io/y)')).toBe(
      '<p>see <a href="https://x.io/y" target="_blank" rel="noopener noreferrer">docs</a></p>',
    );
  });

  it('drops javascript: link hrefs, keeping the text', () => {
    // eslint-disable-next-line no-script-url
    expect(renderMarkdown('[x](javascript:alert)')).toBe('<p>x</p>');
  });

  it('escapes HTML so raw tags cannot inject markup', () => {
    expect(renderMarkdown('<img src=x onerror=alert(1)>')).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
    );
  });

  it('groups consecutive bullets into one list', () => {
    expect(renderMarkdown('- one\n- two')).toBe(
      '<ul><li>one</li><li>two</li></ul>',
    );
  });

  it('separates paragraphs on a blank line and joins soft breaks', () => {
    expect(renderMarkdown('a\nb\n\nc')).toBe('<p>a<br>b</p><p>c</p>');
  });

  it('leaves markdown markers inside code spans literal', () => {
    expect(renderMarkdown('`**not bold**`')).toBe(
      '<p><code>**not bold**</code></p>',
    );
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
