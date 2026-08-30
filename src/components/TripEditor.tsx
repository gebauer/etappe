import { useMemo, useState } from 'react';
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
import { DayRail } from './DayRail';
import { Timeline } from './Timeline';
import { RightPane } from './RightPane';
import { Drawer } from './Drawer';

export function TripEditor({ tripId }: { tripId: string }) {
  const { records, result, error, reload } = useTripEditor(tripId);
  const routing = useMemo(() => createPocketBaseRouting(pb), []);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
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
        <RightPane trip={trip} selectedDay={selectedDay} />
      </aside>

      {showRail && (
        <Drawer side="left" width="w-64" onClose={() => setShowRail(false)}>
          {rail}
        </Drawer>
      )}
      {showRight && (
        <Drawer side="right" width="w-96" onClose={() => setShowRight(false)}>
          <RightPane trip={trip} selectedDay={selectedDay} />
        </Drawer>
      )}
    </div>
  );
}
