import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { KINDS, TAXONOMY } from './taxonomy';

// The committed sprite (public/sprites/sprite.json) must cover every taxonomy
// icon. If this fails after a taxonomy change, run `npm run sprites`.
const sprite = JSON.parse(
  readFileSync(
    new URL('../../public/sprites/sprite.json', import.meta.url),
    'utf8',
  ),
) as Record<string, unknown>;

describe('sprite sheet', () => {
  it('has an entry for every taxonomy icon', () => {
    for (const kind of KINDS) {
      const icon = TAXONOMY[kind].icon;
      expect(
        sprite,
        `no sprite for kind "${kind}" (icon "${icon}")`,
      ).toHaveProperty(icon);
    }
  });
});
