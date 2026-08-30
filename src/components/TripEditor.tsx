import { useEffect, useMemo, useState } from 'react';
import { pb } from '../lib/pb';
import { useTripEditor } from '../hooks/useTripEditor';
import { insertDay, deleteDay } from '../lib/pb-days';
import {
  addStopAtEnd,
  deleteStop,
  moveStop,
  updateStop,
  updateLeg,
  type StopPatch,
  type LegPatch,
} from '../lib/pb-stops';
import { createPocketBaseRouting } from '../lib/routing';
import { shiftClock } from '../lib/format';
import { DayRail } from './DayRail';
import { Timeline } from './Timeline';
import { RightPane } from './RightPane';
import { Drawer } from './Drawer';

export function TripEditor({ tripId }: { tripId: string }) {
  const { records, result, error, reload } = useTripEditor(tripId);
  const routing = useMemo(() => createPocketBaseRouting(pb), []);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedStopIds, setSelectedStopIds] = useState<Set<string>>(
    new Set(),
  );
  const [showRail, setShowRail] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    }
  }

  function toggleSelect(stopId: string, additive: boolean) {
    setSelectedStopIds((prev) => {
      if (!additive) return new Set([stopId]);
      const next = new Set(prev);
      if (next.has(stopId)) next.delete(stopId);
      else next.add(stopId);
      return next;
    });
  }

  function doAddStopToFocus() {
    if (!records) return;
    let dayId = selectedDayId;
    if (!dayId && selectedStopIds.size > 0) {
      const first = [...selectedStopIds][0]!;
      dayId = records.stops.find((s) => s.id === first)?.day ?? null;
    }
    if (!dayId) dayId = records.days[records.days.length - 1]?.id ?? null;
    if (!dayId) return;
    const target = dayId;
    void run(() =>
      addStopAtEnd(
        pb,
        routing,
        target,
        records.stops.filter((s) => s.day === target),
      ),
    );
  }

  function doMoveSelected(dir: -1 | 1) {
    if (!records || selectedStopIds.size !== 1) return;
    const id = [...selectedStopIds][0]!;
    const stop = records.stops.find((s) => s.id === id);
    if (!stop) return;
    const dayStops = records.stops
      .filter((s) => s.day === stop.day)
      .sort((a, b) => a.order_index - b.order_index);
    const i = dayStops.findIndex((s) => s.id === id);
    const target = i + dir;
    if (target < 0 || target >= dayStops.length) return;
    void run(() => moveStop(pb, routing, records, id, stop.day, target));
  }

  function doBulkShift(delta: number) {
    if (!records) return;
    const targets = records.stops.filter(
      (s) => selectedStopIds.has(s.id) && s.anchor_time,
    );
    if (targets.length === 0) return;
    void run(() =>
      Promise.all(
        targets.map((s) =>
          updateStop(pb, s.id, {
            anchor_time: shiftClock(s.anchor_time, delta),
          }),
        ),
      ),
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === 'Escape') return setSelectedStopIds(new Set());
      if (e.altKey && e.key === 'ArrowUp')
        return void (e.preventDefault(), doMoveSelected(-1));
      if (e.altKey && e.key === 'ArrowDown')
        return void (e.preventDefault(), doMoveSelected(1));
      if (e.shiftKey && e.key === 'ArrowUp')
        return void (e.preventDefault(), doBulkShift(-5));
      if (e.shiftKey && e.key === 'ArrowDown')
        return void (e.preventDefault(), doBulkShift(5));
      if (e.key === 'd' && records)
        return void (e.preventDefault(),
        run(() =>
          insertDay(pb, tripId, records.days.length, { kind: 'travel' }),
        ));
      if (e.key === 'n') return void (e.preventDefault(), doAddStopToFocus());
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, selectedStopIds, selectedDayId]);

  if (!records) {
    return (
      <div className="p-6 text-sm text-slate-400">
        {error ?? 'Loading trip…'}
      </div>
    );
  }

  const { trip, days, stops, legs } = records;
  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;

  const rail = (
    <DayRail
      trip={trip}
      days={days}
      selectedDayId={selectedDayId}
      onSelectDay={(id) => {
        setSelectedDayId(id);
        setShowRail(false);
      }}
      onAddDay={() =>
        run(() => insertDay(pb, tripId, days.length, { kind: 'travel' }))
      }
      onDeleteDay={(id) => run(() => deleteDay(pb, tripId, id))}
    />
  );

  return (
    <div className="grid h-full grid-cols-1 min-[900px]:grid-cols-[220px_minmax(0,1fr)] min-[1280px]:grid-cols-[220px_minmax(0,1fr)_380px]">
      <div className="hidden overflow-hidden border-r border-slate-200 min-[900px]:block">
        {rail}
      </div>

      <div className="flex min-w-0 flex-col">
        {actionError && (
          <p className="bg-red-50 px-4 py-1 text-xs text-red-600">
            {actionError}
          </p>
        )}
        <Timeline
          trip={trip}
          days={days}
          stops={stops}
          legs={legs}
          result={result}
          selectedStopIds={selectedStopIds}
          onSelectStop={toggleSelect}
          onToggleRail={() => setShowRail(true)}
          onToggleRight={() => setShowRight(true)}
          onAddStop={(dayId) =>
            run(() =>
              addStopAtEnd(
                pb,
                routing,
                dayId,
                stops.filter((s) => s.day === dayId),
              ),
            )
          }
          onDeleteStop={(stopId) => {
            const stop = stops.find((s) => s.id === stopId);
            if (!stop) return;
            void run(() =>
              deleteStop(
                pb,
                routing,
                stops.filter((s) => s.day === stop.day),
                legs,
                stopId,
              ),
            );
          }}
          onUpdateStop={(stopId, patch: StopPatch) =>
            run(() => updateStop(pb, stopId, patch))
          }
          onUpdateLeg={(legId, patch: LegPatch) =>
            run(() => updateLeg(pb, legId, patch))
          }
          onMoveStop={(stopId, targetDayId, targetIndex) =>
            run(() =>
              moveStop(pb, routing, records, stopId, targetDayId, targetIndex),
            )
          }
        />
      </div>

      <aside className="hidden overflow-hidden border-l border-slate-200 min-[1280px]:block">
        <RightPane
          records={records}
          result={result}
          selectedDay={selectedDay}
        />
      </aside>

      {showRail && (
        <Drawer side="left" width="w-64" onClose={() => setShowRail(false)}>
          {rail}
        </Drawer>
      )}
      {showRight && (
        <Drawer side="right" width="w-96" onClose={() => setShowRight(false)}>
          <RightPane
            records={records}
            result={result}
            selectedDay={selectedDay}
          />
        </Drawer>
      )}
    </div>
  );
}
