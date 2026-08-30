import { useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { listDays, insertDay, deleteDay } from '../lib/pb-days';
import { DayRail } from './DayRail';
import { Timeline } from './Timeline';
import { RightPane } from './RightPane';
import { Drawer } from './Drawer';
import type { TripsResponse, DaysResponse } from '../types/pb';

function isAbort(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'isAbort' in err && !!err.isAbort;
}

export function TripEditor({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<TripsResponse | null>(null);
  const [days, setDays] = useState<DaysResponse[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [showRail, setShowRail] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [t, d] = await Promise.all([
        pb.collection('trips').getOne(tripId, { requestKey: null }),
        listDays(pb, tripId),
      ]);
      setTrip(t);
      setDays(d);
    } catch (err) {
      if (isAbort(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to load trip.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function addDay() {
    await insertDay(pb, tripId, days.length, { kind: 'travel' });
    await load();
  }

  async function removeDay(id: string) {
    await deleteDay(pb, tripId, id);
    if (selectedDayId === id) setSelectedDayId(null);
    await load();
  }

  if (!trip) {
    return (
      <div className="p-6 text-sm text-slate-400">
        {error ?? 'Loading trip…'}
      </div>
    );
  }

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
      onAddDay={addDay}
      onDeleteDay={removeDay}
    />
  );

  return (
    <div className="grid h-full grid-cols-1 min-[900px]:grid-cols-[220px_minmax(0,1fr)] min-[1280px]:grid-cols-[220px_minmax(0,1fr)_380px]">
      <div className="hidden overflow-hidden border-r border-slate-200 min-[900px]:block">
        {rail}
      </div>

      <Timeline
        trip={trip}
        days={days}
        onToggleRail={() => setShowRail(true)}
        onToggleRight={() => setShowRight(true)}
      />

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
