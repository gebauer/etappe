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
import { photonReverse, type PlaceResult } from '../lib/photon';
import { DayRail } from './DayRail';
import { SearchPalette } from './SearchPalette';
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
  const [showSearch, setShowSearch] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [railW, setRailW] = useState(() => loadWidths().rail);
  const [rightW, setRightW] = useState(() => loadWidths().right);
  const [bp, setBp] = useState({ mid: false, wide: false });

  useEffect(() => {
    const midQ = matchMedia('(min-width: 900px)');
    const wideQ = matchMedia('(min-width: 1280px)');
    const update = () => setBp({ mid: midQ.matches, wide: wideQ.matches });
    update();
    midQ.addEventListener('change', update);
    wideQ.addEventListener('change', update);
    return () => {
      midQ.removeEventListener('change', update);
      wideQ.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'etappe.paneWidths',
        JSON.stringify({ rail: railW, right: rightW }),
      );
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [railW, rightW]);

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

  // The day new stops land in: the selected day, else the selected stop's day,
  // else the last day.
  function focusDayId(): string | null {
    if (!records) return null;
    if (selectedDayId) return selectedDayId;
    if (selectedStopIds.size > 0) {
      const first = [...selectedStopIds][0]!;
      const d = records.stops.find((s) => s.id === first)?.day;
      if (d) return d;
    }
    return records.days[records.days.length - 1]?.id ?? null;
  }

  function doAddStopToFocus() {
    const dayId = focusDayId();
    if (!records || !dayId) return;
    void run(() =>
      addStopAtEnd(
        pb,
        routing,
        dayId,
        records.stops.filter((s) => s.day === dayId),
      ),
    );
  }

  function addPlaceStop(place: PlaceResult, lat = place.lat, lon = place.lon) {
    const dayId = focusDayId();
    if (!records || !dayId) return;
    void run(() =>
      addStopAtEnd(
        pb,
        routing,
        dayId,
        records.stops.filter((s) => s.day === dayId),
        {
          title: place.name,
          kind: place.kind,
          lat,
          lon,
          kind_confirmed: false,
        },
      ),
    );
  }

  function onMapClick(lat: number, lon: number) {
    const dayId = focusDayId();
    if (!records || !dayId) return;
    void run(async () => {
      let place: PlaceResult | null = null;
      try {
        place = await photonReverse(lat, lon);
      } catch {
        place = null;
      }
      await addStopAtEnd(
        pb,
        routing,
        dayId,
        records.stops.filter((s) => s.day === dayId),
        {
          title: place?.name ?? 'Dropped pin',
          kind: place?.kind ?? 'uncategorized',
          lat,
          lon,
          kind_confirmed: false,
        },
      );
    });
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
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
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
    <div
      className="grid h-full"
      style={{
        gridTemplateColumns: bp.wide
          ? `${railW}px 6px minmax(0,1fr) 6px ${rightW}px`
          : bp.mid
            ? `${railW}px 6px minmax(0,1fr)`
            : '1fr',
      }}
    >
      {bp.mid && (
        <div className="overflow-hidden border-r border-slate-200">{rail}</div>
      )}
      {bp.mid && (
        <ResizeDivider
          onResize={(dx) => setRailW((w) => clampWidth(w + dx, 160, 420))}
        />
      )}

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
          onOpenSearch={() => setShowSearch(true)}
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

      {bp.wide && (
        <ResizeDivider
          onResize={(dx) => setRightW((w) => clampWidth(w - dx, 280, 680))}
        />
      )}
      {bp.wide && (
        <aside className="overflow-hidden border-l border-slate-200">
          <RightPane
            records={records}
            result={result}
            selectedDay={selectedDay}
            onMapClick={onMapClick}
          />
        </aside>
      )}

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
            onMapClick={onMapClick}
          />
        </Drawer>
      )}
      {showSearch && (
        <SearchPalette
          onPick={(place) => {
            setShowSearch(false);
            addPlaceStop(place);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

function clampWidth(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadWidths(): { rail: number; right: number } {
  try {
    const raw = localStorage.getItem('etappe.paneWidths');
    if (raw) {
      const o = JSON.parse(raw) as { rail?: number; right?: number };
      return { rail: Number(o.rail) || 220, right: Number(o.right) || 380 };
    }
  } catch {
    /* storage unavailable */
  }
  return { rail: 220, right: 380 };
}

/** A draggable column divider; reports the horizontal delta as the user drags. */
function ResizeDivider({ onResize }: { onResize: (dx: number) => void }) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    let last = e.clientX;
    const move = (ev: MouseEvent) => {
      onResize(ev.clientX - last);
      last = ev.clientX;
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }
  return (
    <div
      onMouseDown={onMouseDown}
      className="cursor-col-resize bg-slate-200 transition-colors hover:bg-sky-400"
      title="Drag to resize"
    />
  );
}
