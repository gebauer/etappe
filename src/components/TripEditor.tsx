import { useEffect, useMemo, useState } from 'react';
import { pb } from '../lib/pb';
import { useTripEditor } from '../hooks/useTripEditor';
import { insertDay, deleteDay } from '../lib/pb-days';
import {
  addStopAtEnd,
  deleteStop,
  moveStop,
  updateStop,
  updateStopAndReroute,
  updateLeg,
  rerouteLeg,
  setLegManual,
  type StopPatch,
  type LegPatch,
} from '../lib/pb-stops';
import { createPocketBaseRouting } from '../lib/routing';
import { shiftClock } from '../lib/format';
import { photonReverse, type PlaceResult } from '../lib/photon';
import { addLinkBlock } from '../lib/pb-capture';
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
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{
    lat: number;
    lon: number;
    nonce: number;
  } | null>(null);
  const [showRail, setShowRail] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [placingAccessFor, setPlacingAccessFor] = useState<{
    id: string;
    title: string;
  } | null>(null);
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

  function addPlaceStop(place: PlaceResult, sourceUrl?: string) {
    const dayId = focusDayId();
    if (!records || !dayId) return;
    void run(async () => {
      const stopId = await addStopAtEnd(
        pb,
        routing,
        dayId,
        records.stops.filter((s) => s.day === dayId),
        {
          title: place.name,
          kind: place.kind,
          lat: place.lat,
          lon: place.lon,
          kind_confirmed: false,
        },
      );
      // Keep the pasted URL as a link block on the new stop (BUILD §6).
      if (sourceUrl)
        await addLinkBlock(pb, tripId, stopId, sourceUrl, place.name);
    });
  }

  function onMapClick(lat: number, lon: number) {
    if (placingAccessFor) {
      const stopId = placingAccessFor.id;
      setPlacingAccessFor(null);
      if (!records) return;
      void run(() =>
        updateStopAndReroute(pb, routing, records, stopId, {
          access_lat: lat,
          access_lon: lon,
        }),
      );
      return;
    }
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

  // Quick bulk delete for the selected stops (no confirmation yet — see the
  // "Noticed" note in WORK.md). Legs cascade away with the stops.
  function deleteSelected() {
    if (!records || selectedStopIds.size === 0) return;
    const ids = [...selectedStopIds];
    setSelectedStopIds(new Set());
    void run(async () => {
      const batch = pb.createBatch();
      for (const id of ids) batch.collection('stops').delete(id);
      await batch.send();
    });
  }

  function startPlacingAccessPoint(stopId: string) {
    const stop = records?.stops.find((s) => s.id === stopId);
    if (!stop) return;
    setPlacingAccessFor({ id: stopId, title: stop.title });
  }

  function clearAccessPoint(stopId: string) {
    if (!records) return;
    void run(() =>
      updateStopAndReroute(pb, routing, records, stopId, {
        access_lat: 0,
        access_lon: 0,
      }),
    );
  }

  function handleUpdateStop(id: string, patch: StopPatch) {
    const reroute = patch.lat !== undefined || patch.lon !== undefined;
    void run(() =>
      reroute && records
        ? updateStopAndReroute(pb, routing, records, id, patch)
        : updateStop(pb, id, patch),
    );
  }

  // Delete a single stop with proper leg re-merge (row ✕ and inspector).
  function deleteOneStop(stopId: string) {
    const stop = records?.stops.find((s) => s.id === stopId);
    if (!records || !stop) return;
    void run(() =>
      deleteStop(
        pb,
        routing,
        records.stops.filter((s) => s.day === stop.day),
        records.legs,
        stopId,
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
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === 'Escape' && placingAccessFor)
        return setPlacingAccessFor(null);
      if (e.key === 'Escape') return setSelectedStopIds(new Set());
      if (e.key === 'Delete' || e.key === 'Backspace')
        return void (e.preventDefault(), deleteSelected());
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
  }, [records, selectedStopIds, selectedDayId, placingAccessFor]);

  if (!records) {
    return (
      <div className="p-6 text-sm text-slate-400">
        {error ?? 'Loading trip…'}
      </div>
    );
  }

  const { trip, days, stops, legs } = records;
  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;
  const selectedStop =
    selectedStopIds.size === 1
      ? (stops.find((s) => s.id === [...selectedStopIds][0]) ?? null)
      : null;

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
        gridTemplateRows: 'minmax(0, 1fr)',
        gridTemplateColumns: bp.wide
          ? `${railW}px 6px minmax(0,1fr) 6px ${rightW}px`
          : bp.mid
            ? `${railW}px 6px minmax(0,1fr)`
            : '1fr',
      }}
    >
      {placingAccessFor && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-900 px-4 py-1.5 text-xs text-white shadow-lg">
            Click the map for an access point for{' '}
            <strong>{placingAccessFor.title}</strong>
            <button
              onClick={() => setPlacingAccessFor(null)}
              className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
            >
              Cancel (Esc)
            </button>
          </div>
        </div>
      )}
      {bp.mid && (
        <div className="min-h-0 overflow-hidden border-r border-slate-200">
          {rail}
        </div>
      )}
      {bp.mid && (
        <ResizeDivider
          onResize={(dx) => setRailW((w) => clampWidth(w + dx, 160, 420))}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
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
          scrollToDayId={selectedDayId}
          scrollToStopId={
            selectedStopIds.size === 1 ? [...selectedStopIds][0]! : null
          }
          hoveredStopId={hoveredStopId}
          onHoverStop={setHoveredStopId}
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
          onDeleteStop={deleteOneStop}
          onUpdateStop={handleUpdateStop}
          onUpdateLeg={(legId, patch: LegPatch) =>
            run(() => updateLeg(pb, legId, patch))
          }
          onRerouteLeg={(legId) =>
            run(() => rerouteLeg(pb, routing, records, legId))
          }
          onSetManualLeg={(legId, durationMin) =>
            run(() => setLegManual(pb, legId, durationMin))
          }
          onPlaceAccessPoint={startPlacingAccessPoint}
          onClearAccessPoint={clearAccessPoint}
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
        <aside className="min-h-0 overflow-hidden border-l border-slate-200">
          <RightPane
            records={records}
            result={result}
            selectedDay={selectedDay}
            selectedStop={selectedStop}
            onMapClick={onMapClick}
            onSelectStop={(id) => setSelectedStopIds(new Set([id]))}
            onHoverStop={setHoveredStopId}
            onUpdateStop={handleUpdateStop}
            onDeleteStop={deleteOneStop}
            onZoomStop={(lat, lon) => setFlyTo({ lat, lon, nonce: Date.now() })}
            hoveredStopId={hoveredStopId}
            focusDayId={selectedDayId}
            flyTo={flyTo}
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
            selectedStop={selectedStop}
            onMapClick={onMapClick}
            onSelectStop={(id) => setSelectedStopIds(new Set([id]))}
            onHoverStop={setHoveredStopId}
            onUpdateStop={handleUpdateStop}
            onDeleteStop={deleteOneStop}
            onZoomStop={(lat, lon) => setFlyTo({ lat, lon, nonce: Date.now() })}
            hoveredStopId={hoveredStopId}
            focusDayId={selectedDayId}
            flyTo={flyTo}
          />
        </Drawer>
      )}
      {showSearch && (
        <SearchPalette
          onPick={(place, sourceUrl) => {
            setShowSearch(false);
            addPlaceStop(place, sourceUrl);
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
