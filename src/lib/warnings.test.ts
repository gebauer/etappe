import { describe, it, expect } from 'vitest';
import { warningText } from './warnings';
import type { Warning, WarningCode } from './cascade';

const CODES: WarningCode[] = [
  'MISSED_ANCHOR',
  'NO_ACCOMMODATION',
  'AFTER_DARK',
  'LONG_DAY',
  'FROAD_SEASON',
  'UNCATEGORIZED',
];

describe('warningText', () => {
  it('keeps the engine code visible and explains it', () => {
    expect(warningText({ code: 'NO_ACCOMMODATION', dayId: 'd1' })).toBe(
      'NO_ACCOMMODATION — day ends without a place to stay',
    );
  });

  it('appends the deficit when the engine reports one', () => {
    expect(
      warningText({
        code: 'MISSED_ANCHOR',
        dayId: 'd1',
        stopId: 's1',
        deficitMin: 25,
      }),
    ).toBe('MISSED_ANCHOR — arrives later than its anchor time by 25 min');
  });

  it('has copy for every code the engine can emit', () => {
    for (const code of CODES) {
      const text = warningText({ code, dayId: 'd1' } as Warning);
      expect(text.startsWith(`${code} — `)).toBe(true);
      expect(text.length).toBeGreaterThan(code.length + 4);
    }
  });
});
