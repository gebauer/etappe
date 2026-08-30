/**
 * Sprite build (WORK 5.1). Rasterises the Maki/Temaki subset named by the
 * taxonomy into a MapLibre spritesheet (1x and 2x). Fails if any taxonomy icon
 * cannot be resolved, so the enum and the sprite can never drift.
 *
 * Run with `npm run sprites` after changing taxonomy icons; the output in
 * public/sprites is committed so the SPA build needs no native tooling.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { KINDS, TAXONOMY } from '../src/lib/taxonomy';

const ROOT = process.cwd();
const MAKI = join(ROOT, 'node_modules/@mapbox/maki/icons');
const TEMAKI = join(ROOT, 'node_modules/@rapideditor/temaki/icons');
const OUT = join(ROOT, 'public/sprites');
const BASE_SIZE = 20; // px at 1x

function resolveIcon(name: string): string {
  for (const dir of [MAKI, TEMAKI]) {
    const p = join(dir, `${name}.svg`);
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Sprite build: no Maki/Temaki icon named "${name}". Fix the taxonomy or pick another icon.`,
  );
}

interface Entry {
  name: string;
  x: number;
  y: number;
}

async function buildAtlas(
  scale: number,
): Promise<{ png: Buffer; entries: Entry[] }> {
  const size = BASE_SIZE * scale;
  const names = [...new Set(KINDS.map((k) => TAXONOMY[k].icon))].sort();
  const cols = Math.ceil(Math.sqrt(names.length));
  const rows = Math.ceil(names.length / cols);

  const composites: sharp.OverlayOptions[] = [];
  const entries: Entry[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    const svg = readFileSync(resolveIcon(name));
    const icon = await sharp(svg, { density: 300 })
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const x = (i % cols) * size;
    const y = Math.floor(i / cols) * size;
    composites.push({ input: icon, left: x, top: y });
    entries.push({ name, x, y });
  }

  const png = await sharp({
    create: {
      width: cols * size,
      height: rows * size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return { png, entries };
}

function writeSprite(
  suffix: string,
  scale: number,
  png: Buffer,
  entries: Entry[],
) {
  const size = BASE_SIZE * scale;
  const index: Record<string, unknown> = {};
  for (const e of entries) {
    index[e.name] = {
      width: size,
      height: size,
      x: e.x,
      y: e.y,
      pixelRatio: scale,
    };
  }
  writeFileSync(join(OUT, `sprite${suffix}.png`), png);
  writeFileSync(
    join(OUT, `sprite${suffix}.json`),
    JSON.stringify(index, null, 2) + '\n',
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const one = await buildAtlas(1);
  writeSprite('', 1, one.png, one.entries);
  const two = await buildAtlas(2);
  writeSprite('@2x', 2, two.png, two.entries);
  console.log(`Sprite build: ${one.entries.length} icons -> public/sprites/`);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
