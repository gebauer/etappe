import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cascade, formatClock } from './cascade';
import { stubDaylight } from './daylight';
import {
  importToCascade,
  defaultSettings,
  type ImportDoc,
  type RouteResolver,
} from './import-cascade';

const doc = JSON.parse(
  readFileSync(
    new URL('../../fixtures/iceland-day1.json', import.meta.url),
    'utf8',
  ),
) as ImportDoc;

// Routing is stubbed with the §12 values (100 min paved, 40 min gravel) so the
// fixture is deterministic (BUILD §8/§12).
const icelandRouting: RouteResolver = ({ legIndex }) => ({
  duration_min: legIndex === 0 ? 100 : 40,
});

describe('importToCascade + fixtures/iceland-day1.json', () => {
  it('maps the import document into cascade input', () => {
    const trip = importToCascade(doc, icelandRouting);
    expect(trip.start_date).toBe('2026-09-12');
    const day = trip.days[0]!;
    expect(day.order_index).toBe(0);
    expect(day.stops.map((s) => s.id)).toEqual(['d1-s0', 'd1-s1', 'd1-s2']);
    expect(day.stops[0]!.dwell_override).toBe(65); // dwell_min -> dwell_override
    expect(day.stops[1]!.activities).toEqual([
      { duration_min: 120, kind: 'activity' },
    ]);
    expect(day.stops[2]!.is_accommodation).toBe(true);
    expect(day.legs.map((l) => [l.mode, l.surface, l.duration_min])).toEqual([
      ['car', 'paved', 100],
      ['car', 'gravel', 40],
    ]);
  });

  it('reproduces the §12 timings and emits no warnings', () => {
    const trip = importToCascade(doc, icelandRouting);
    const { days, warnings } = cascade(
      trip,
      stubDaylight({ sunrise: 400, sunset: 1215, dusk: 1245 }),
    );
    const [kef, gullfoss, skalholt] = days[0]!.stops;
    expect(formatClock(kef!.arrival)).toBe('10:25');
    expect(formatClock(kef!.departure)).toBe('11:30');
    expect(formatClock(gullfoss!.arrival)).toBe('13:15');
    expect(formatClock(skalholt!.arrival)).toBe('15:57');
    expect(days[0]!.legs.map((l) => l.effectiveDuration)).toEqual([105, 42]);
    expect(days[0]!.elapsedMin).toBe(332);
    expect(warnings).toEqual([]);
  });

  it('is the after-dark case under a 15:56 sunset stub (deficit 1 min)', () => {
    const trip = importToCascade(doc, icelandRouting);
    const { warnings } = cascade(
      trip,
      stubDaylight({ sunrise: 400, sunset: 956, dusk: 986 }),
    );
    expect(warnings).toEqual([
      { code: 'AFTER_DARK', dayId: 'd1', stopId: 'd1-s2', deficitMin: 1 },
    ]);
  });

  it('uses BUILD default trip settings', () => {
    const settings = defaultSettings();
    expect(settings.car_buffer_pct).toBe(5);
    expect(settings.default_dwell.waterfall).toBe(45);
  });
});
