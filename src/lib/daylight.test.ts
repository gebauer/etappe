import { describe, it, expect } from 'vitest';
import {
  createSunCalcDaylight,
  describeDaylight,
  stubDaylight,
} from './daylight';

describe('stubDaylight', () => {
  it('returns the fixed value regardless of arguments', () => {
    const provider = stubDaylight({ sunrise: 300, sunset: 984, dusk: 1014 });
    expect(provider('2026-09-12', 64, -22)).toEqual({
      sunrise: 300,
      sunset: 984,
      dusk: 1014,
    });
  });

  it('can represent a day with no daylight band (null)', () => {
    expect(stubDaylight(null)('2026-06-21', 78, 15)).toBeNull();
  });
});

describe('createSunCalcDaylight', () => {
  it('gives a Reykjavík sunset near 20:15 on 2026-09-12 (matches BUILD §12)', () => {
    const provider = createSunCalcDaylight('Atlantic/Reykjavik');
    const daylight = provider('2026-09-12', 64.14, -21.94);
    expect(daylight).not.toBeNull();
    // ~20:08 local; assert a tight band around the stated ~20:15.
    expect(daylight!.sunset).toBeGreaterThan(19 * 60 + 50);
    expect(daylight!.sunset).toBeLessThan(20 * 60 + 40);
    expect(daylight!.sunrise).toBeLessThan(daylight!.sunset);
    expect(daylight!.dusk).toBeGreaterThan(daylight!.sunset);
  });

  it('returns null for a polar day with no sunset (Svalbard in June)', () => {
    const provider = createSunCalcDaylight('Arctic/Longyearbyen');
    expect(provider('2026-06-21', 78.22, 15.65)).toBeNull();
  });

  it('returns null for polar night with no sunset (Svalbard in December)', () => {
    const provider = createSunCalcDaylight('Arctic/Longyearbyen');
    expect(provider('2026-12-21', 78.22, 15.65)).toBeNull();
  });
});

describe('describeDaylight', () => {
  // dawn 04:12, sunset 20:00, dusk 20:30.
  const band = { sunrise: 252, sunset: 1200, dusk: 1230 };

  it('reads a morning arrival against dawn', () => {
    const r = describeDaylight(band, 9 * 60); // 09:00, 4h48m past dawn
    expect(r.line).toBe('4 h 48 m after dawn · dawn 04:12');
    expect(r.token).toBe('dawn +4:48');
  });

  it('flags an arrival within 45 min of dawn as first light', () => {
    const r = describeDaylight(band, 252 + 28);
    expect(r.line).toBe('28 m after dawn · dawn 04:12 · first light');
  });

  it('handles an arrival before dawn', () => {
    const r = describeDaylight(band, 252 - 52);
    expect(r.line).toBe('Before dawn · dawn 04:12');
    expect(r.token).toBe('dawn −0:52');
  });

  it('reads an afternoon arrival against dusk, well clear', () => {
    const r = describeDaylight(band, 13 * 60); // 13:00, 7h before sunset
    expect(r.line).toBe('Daylight until 20:00 · well clear');
    expect(r.token).toBe('dusk −7:30');
  });

  it('counts down the remaining margin under three hours', () => {
    const r = describeDaylight(band, 19 * 60); // 19:00, 1h before sunset
    expect(r.line).toBe('Daylight until 20:00 · 1 h 0 m left');
  });

  it('says after dark once the AFTER_DARK verdict is in', () => {
    const r = describeDaylight(band, 13 * 60, true);
    expect(r.line).toBe('Daylight until 20:00 · after dark');
  });

  it('says after dark when the arrival is already past sunset', () => {
    const r = describeDaylight(band, 21 * 60);
    expect(r.line).toBe('Daylight until 20:00 · after dark');
  });
});
