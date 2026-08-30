import { describe, it, expect } from 'vitest';
import { createSunCalcDaylight, stubDaylight } from './daylight';

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
