import { describe, it, expect } from 'vitest';
import {
  oklchToHex,
  dayHue,
  flatColor,
  legShades,
  legColor,
  categoryColor,
  DAY_HUES,
} from './map-colors';

describe('oklchToHex', () => {
  it('maps the achromatic anchors correctly', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff');
    expect(oklchToHex(0, 0, 0)).toBe('#000000');
  });

  it('returns a 7-char hex for chromatic input', () => {
    expect(oklchToHex(0.65, 0.13, 250)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('day hues', () => {
  it('cycles past ten days', () => {
    expect(dayHue(0)).toBe(DAY_HUES[0]);
    expect(dayHue(DAY_HUES.length)).toBe(DAY_HUES[0]);
    expect(dayHue(DAY_HUES.length + 2)).toBe(DAY_HUES[2]);
  });
});

describe('leg shades', () => {
  it('dark and light differ for a hue', () => {
    const { dark, light } = legShades(250);
    expect(dark).not.toBe(light);
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(light).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('alternates by leg index', () => {
    const hue = 25;
    expect(legColor(hue, 0)).toBe(legShades(hue).dark);
    expect(legColor(hue, 1)).toBe(legShades(hue).light);
    expect(legColor(hue, 2)).toBe(legShades(hue).dark);
  });

  it('flat tone is distinct from the shades', () => {
    expect(flatColor(250)).not.toBe(legShades(250).dark);
  });
});

describe('categoryColor', () => {
  it('groups related kinds under the same colour', () => {
    expect(categoryColor('waterfall')).toBe(categoryColor('hike'));
    expect(categoryColor('hotel')).toBe(categoryColor('campsite'));
  });

  it('distinguishes unrelated buckets', () => {
    expect(categoryColor('restaurant')).not.toBe(categoryColor('museum'));
  });

  it('falls back to a flat grey for unlisted kinds', () => {
    expect(categoryColor('uncategorized')).toBe('#94a3b8');
    expect(categoryColor('parking')).toBe('#94a3b8');
  });
});
