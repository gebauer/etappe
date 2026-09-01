import { useCallback, useEffect, useMemo, useState } from 'react';
import { pb, isAbortError } from '../lib/pb';
import { useTripEditor } from '../hooks/useTripEditor';
import { insertDay, deleteDay } from '../lib/pb-days';
import {
  addStopAtEnd,
  addStopAt,
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
import {
  listWishlist,
  addWishlistItem,
  rejectWishlistItem,
  markWishlistScheduled,
} from '../lib/pb-pois';
import { createPocketBaseRouting } from '../lib/routing';
import { shiftClock } from '../lib/format';
import { photonReverse, type PlaceResult } from '../lib/photon';
import { addLinkBlock, createWikimediaPhotoBlock } from '../lib/pb-capture';
import type { PlacementOption } from '../lib/placement';
import type { NearbyPoi } from '../lib/overpass';
import type { PoisResponse } from '../types/pb';
import {
  addBlock,
  updateBlock,
  deleteBlock,
  moveBlock,
  blocksFor,
  uploadBlockPhoto,
  type BlockKind,
  type BlockPatch,
} from '../lib/pb-blocks';
import { DayRail } from './DayRail';
import { WishlistPanel } from './WishlistPanel';
import { PinCard, type CardTarget } from './PinCard';
import { PinCardExpanded } from './PinCardExpanded';
import { buildProximityChain, stepInChain } from '../lib/wish-order';
import { UncategorizedReview } from './UncategorizedReview';
import { SearchPalette } from './SearchPalette';
import { HighlightsImportDialog } from './HighlightsImportDialog';
import { Timeline } from './Timeline';
import { RightPane } from './RightPane';
import { Drawer } from './Drawer';
import { PlacementPicker, type PlacementCandidate } from './PlacementPicker';
import { MergePrompt } from './MergePrompt';
import { findNearbyStop } from '../lib/merge';
import type { StopsResponse } from '../types/pb';

/** What every capture path (search, paste, map click, wishlist promotion,
 * nearby) ends up as before it's ranked (WORK 6.3) or merge-checked
 * (WORK 6.5). wishlistId is set only when promoting a wishlist item, so its
 * source can be marked scheduled once the capture resolves. wikidataId is
 * set only by Nearby (Overpass carries the tag; Photon doesn't — see
 * wikimedia.ts), and drives an auto-attached Commons photo block (WORK 7.2). */
type CaptureCandidate = PlacementCandidate & {
  kind: string;
  sourceUrl?: string;
  wishlistId?: string;
  wikidataId?: string;
};

export function TripEditor({
  tripId,
  sharedCapture,
  onSharedCaptureConsumed,
}: {
  tripId: string;
  /** Text/URL handed off from the PWA share target (WORK 6.4) — opens the
   * wishlist capture flow prefilled, once. */
  sharedCapture?: string | null;
  onSharedCaptureConsumed?: () => void;
}) {
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
  const [showHighlightsImport, setShowHighlightsImport] = useState(false);
  const [searchMode, setSearchMode] = useState<'placement' | 'wishlist' | null>(
    null,
  );
  const [shareQuery, setShareQuery] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<PoisResponse[]>([]);
  // The unified pin-click card (WORK 12.2). Three sources, one surface;
  // precedence when more than one is set is empty > wishlist > stop, which
  // matches the order they can be opened from.
  const [wishCard, setWishCard] = useState<PoisResponse | null>(null);
  const [emptyCard, setEmptyCard] = useState<{
    lat: number;
    lon: number;
    place: PlaceResult | null;
    identifying: boolean;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [kindPickerSignal, setKindPickerSignal] = useState(0);
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [placingAccessFor, setPlacingAccessFor] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [pendingPlacement, setPendingPlacement] =
    useState<CaptureCandidate | null>(null);
  const [mergeCheck, setMergeCheck] = useState<{
    candidate: CaptureCandidate;
    existingStop: StopsResponse;
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

  // Wishlist lives outside the cascade-oriented trip doc (it has no day/
  // order_index), so it gets its own small fetch rather than riding along
  // with useTripEditor's reload.
  const reloadWishlist = useCallback(() => {
    listWishlist(pb, tripId)
      .then(setWishlist)
      .catch((err) => {
        if (isAbortError(err)) return; // benign under StrictMode double-render
        setActionError(
          err instanceof Error ? err.message : 'Failed to load wishlist.',
        );
      });
  }, [tripId]);
  useEffect(() => {
    reloadWishlist();
  }, [reloadWishlist]);

  // A share-target capture opens the wishlist search prefilled, once. Copied
  // into local state immediately rather than read from the prop at render
  // time — onSharedCaptureConsumed clears the parent's copy right away, and
  // relying on the prop surviving until SearchPalette mounts would race it.
  useEffect(() => {
    if (sharedCapture) {
      setShareQuery(sharedCapture);
      setSearchMode('wishlist');
      onSharedCaptureConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedCapture]);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    }
  }

  /** Opening any card clears the other two sources and collapses the edit
   * region — pin, row and wishlist selection are one state, and the design
   * resets `editing` on every selection change. */
  function openCard(open: () => void) {
    setWishCard(null);
    setEmptyCard(null);
    setSelectedStopIds(new Set());
    setEditing(false);
    setExpanded(false);
    open();
  }

  function closeCard() {
    setWishCard(null);
    setEmptyCard(null);
    setEditing(false);
    setExpanded(false);
    setSelectedStopIds(new Set());
  }

  function toggleSelect(stopId: string, additive: boolean) {
    setWishCard(null);
    setEmptyCard(null);
    setEditing(false);
    setExpanded(false);
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

  // Every capture with coordinates funnels through here (WORK 6.5): a stop
  // within 100m of an existing one prompts to merge instead of silently
  // duplicating it. Only past that check does it reach the placement picker
  // (WORK 6.3), ranked across every gap in the trip, not just one day.
  function beginCapture(candidate: CaptureCandidate) {
    const existingStop =
      records &&
      findNearbyStop({ lat: candidate.lat, lon: candidate.lon }, records.stops);
    if (existingStop) setMergeCheck({ candidate, existingStop });
    else setPendingPlacement(candidate);
  }

  function addPlaceStop(place: PlaceResult, sourceUrl?: string) {
    beginCapture({
      name: place.name,
      kind: place.kind,
      lat: place.lat,
      lon: place.lon,
      sourceUrl,
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
    // A bare map click no longer captures anything on its own (WORK 12.2):
    // it opens the card in empty-click mode and waits for an explicit
    // "+ Wishlist" or "+ Day". Identification streams in behind the card.
    openCard(() => setEmptyCard({ lat, lon, place: null, identifying: true }));
    void (async () => {
      let place: PlaceResult | null = null;
      try {
        place = await photonReverse(lat, lon);
      } catch {
        place = null;
      }
      setEmptyCard((current) =>
        current && current.lat === lat && current.lon === lon
          ? { ...current, place, identifying: false }
          : current,
      );
    })();
  }

  function commitPlacement(option: PlacementOption) {
    const candidate = pendingPlacement;
    setPendingPlacement(null);
    if (!records || !candidate) return;
    const dayStops = records.stops
      .filter((s) => s.day === option.dayId)
      .sort((a, b) => a.order_index - b.order_index);
    const targetIndex = option.nextStopId
      ? dayStops.findIndex((s) => s.id === option.nextStopId)
      : dayStops.length;
    void run(async () => {
      const stopId = await addStopAt(
        pb,
        routing,
        records,
        option.dayId,
        targetIndex,
        {
          title: candidate.name,
          kind: candidate.kind,
          lat: candidate.lat,
          lon: candidate.lon,
          kind_confirmed: false,
        },
      );
      // Keep the pasted URL as a link block on the new stop (BUILD §6).
      if (candidate.sourceUrl) {
        await addLinkBlock(
          pb,
          tripId,
          stopId,
          candidate.sourceUrl,
          candidate.name,
        );
      }
      // A Nearby capture's wikidata tag resolves to a Commons cover photo,
      // attributed, on the new stop (WORK 7.2).
      if (candidate.wikidataId) {
        await createWikimediaPhotoBlock(
          pb,
          tripId,
          stopId,
          candidate.wikidataId,
        );
      }
      if (candidate.wishlistId) {
        await markWishlistScheduled(pb, candidate.wishlistId);
        reloadWishlist();
      }
    });
  }

  // Wishlist (WORK 6.4): captures without a slot land here instead of the
  // placement picker. "+ Idea" and a nearby ghost pin both feed the same
  // SearchPalette; searchMode decides what onPick does with the result.
  function commitWishlistPick(place: PlaceResult, sourceUrl?: string) {
    void run(async () => {
      await addWishlistItem(pb, tripId, {
        title: place.name,
        kind: place.kind,
        lat: place.lat,
        lon: place.lon,
        url: sourceUrl ?? '',
      });
      reloadWishlist();
    });
  }

  function rejectWishlist(id: string) {
    void rejectWishlistItem(pb, id).then(reloadWishlist);
  }

  // The card's `‹`/`›` order for wishlist entries: a nearest-neighbour chain
  // from a fixed anchor, cached. Rebuilding it from the current pin would
  // make the two arrows disagree — see src/lib/wish-order.ts.
  const wishChain = useMemo(
    () =>
      buildProximityChain(
        wishlist
          .filter((item) => item.lat && item.lon)
          .map((item) => ({ id: item.id, lat: item.lat!, lon: item.lon! })),
      ),
    [wishlist],
  );

  // Placing a wishlist item or a nearby ghost pin is the same ranked
  // placement flow as any other capture (WORK 6.3) — a wishlist item just
  // arrives with a wishlistId so commitPlacement can mark it scheduled.
  function placeWishlistItem(item: PoisResponse) {
    if (!item.lat || !item.lon) return;
    beginCapture({
      name: item.title,
      kind: item.kind ?? 'uncategorized',
      lat: item.lat,
      lon: item.lon,
      sourceUrl: item.url || undefined,
      wishlistId: item.id,
    });
  }

  function selectNearby(poi: NearbyPoi) {
    beginCapture({
      name: poi.name,
      kind: poi.kind,
      lat: poi.lat,
      lon: poi.lon,
      wikidataId: poi.wikidataId,
    });
  }

  // The merge prompt's resolution: adopt the existing stop (carrying over
  // the candidate's link and, for a wishlist promotion, marking it
  // scheduled — the same side effects commitPlacement would have applied to
  // a newly created stop), override and create a separate stop anyway, or
  // cancel the capture entirely.
  function useExistingStop() {
    const check = mergeCheck;
    setMergeCheck(null);
    if (!check) return;
    setSelectedStopIds(new Set([check.existingStop.id]));
    if (
      !check.candidate.sourceUrl &&
      !check.candidate.wishlistId &&
      !check.candidate.wikidataId
    ) {
      return;
    }
    void run(async () => {
      if (check.candidate.sourceUrl) {
        await addLinkBlock(
          pb,
          tripId,
          check.existingStop.id,
          check.candidate.sourceUrl,
          check.candidate.name,
        );
      }
      if (check.candidate.wikidataId) {
        await createWikimediaPhotoBlock(
          pb,
          tripId,
          check.existingStop.id,
          check.candidate.wikidataId,
        );
      }
      if (check.candidate.wishlistId) {
        await markWishlistScheduled(pb, check.candidate.wishlistId);
        reloadWishlist();
      }
    });
  }

  function createSeparateStop() {
    const check = mergeCheck;
    setMergeCheck(null);
    if (check) setPendingPlacement(check.candidate);
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

  function dragStop(stopId: string, lat: number, lon: number) {
    if (!records) return;
    void run(() =>
      updateStopAndReroute(pb, routing, records, stopId, { lat, lon }),
    );
  }

  function dragAccessPoint(stopId: string, lat: number, lon: number) {
    if (!records) return;
    void run(() =>
      updateStopAndReroute(pb, routing, records, stopId, {
        access_lat: lat,
        access_lon: lon,
      }),
    );
  }

  function handleUpdateStop(id: string, patch: StopPatch) {
    const reroute =
      patch.lat !== undefined ||
      patch.lon !== undefined ||
      patch.access_lat !== undefined ||
      patch.access_lon !== undefined;
    void run(() =>
      reroute && records
        ? updateStopAndReroute(pb, routing, records, id, patch)
        : updateStop(pb, id, patch),
    );
  }

  // "Move to day…" (WORK 12.3, expanded card): appends to the end of the
  // target day, reusing the same reindex-and-reroute path drag-and-drop
  // already relies on (WORK 4.3) — no ranking needed, the day is explicit.
  function moveStopToDay(stopId: string, targetDayId: string) {
    if (!records) return;
    const targetIndex = records.stops.filter(
      (s) => s.day === targetDayId,
    ).length;
    void run(() =>
      moveStop(pb, routing, records, stopId, targetDayId, targetIndex),
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
        setSearchMode('placement');
        return;
      }
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === 'Escape' && mergeCheck) return setMergeCheck(null);
      if (e.key === 'Escape' && pendingPlacement)
        return setPendingPlacement(null);
      if (e.key === 'Escape' && placingAccessFor)
        return setPlacingAccessFor(null);
      if (e.key === 'Escape' && (wishCard || emptyCard)) return closeCard();
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
      // BUILD §7: "k opens an icon grid" for the one selected stop. Recomputed
      // here rather than closing over the render's `selectedStop` — that const
      // is declared after this component's early "loading" return, so a
      // closure created during a records-not-yet-loaded render would capture
      // a never-initialized binding.
      if (e.key === 'k' && records) {
        const ids = [...selectedStopIds];
        const stop =
          ids.length === 1 ? records.stops.find((s) => s.id === ids[0]) : null;
        if (stop) {
          return void (e.preventDefault(), setKindPickerSignal((n) => n + 1));
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    records,
    selectedStopIds,
    selectedDayId,
    placingAccessFor,
    pendingPlacement,
    mergeCheck,
    wishCard,
    emptyCard,
  ]);

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

  const dayStopsOf = (dayId: string) =>
    stops
      .filter((s) => s.day === dayId)
      .sort((a, b) => a.order_index - b.order_index);

  let cardTarget: CardTarget | null = null;
  if (emptyCard) {
    cardTarget = { type: 'empty', ...emptyCard };
  } else if (wishCard) {
    cardTarget = {
      type: 'wish',
      item: wishCard,
      position: wishChain.indexOf(wishCard.id) + 1,
      total: wishChain.length,
    };
  } else if (selectedStop) {
    const dayStops = dayStopsOf(selectedStop.day);
    const dayResult = result?.days.find((d) => d.dayId === selectedStop.day);
    cardTarget = {
      type: 'stop',
      stop: selectedStop,
      dayLabel: `Day ${days.findIndex((d) => d.id === selectedStop.day) + 1}`,
      seq: dayStops.findIndex((s) => s.id === selectedStop.id) + 1,
      total: dayStops.length,
      timing: dayResult?.stops.find((s) => s.stopId === selectedStop.id),
      daylight: dayResult?.daylight ?? null,
      afterDark: (result?.warnings ?? []).some(
        (w) => w.code === 'AFTER_DARK' && w.stopId === selectedStop.id,
      ),
    };
  }

  /** Stops step in sequence order within the day; wishlist entries step
   * along the cached proximity chain. Both wrap at either end. */
  function stepCard(direction: -1 | 1) {
    if (wishCard) {
      const nextId = stepInChain(wishChain, wishCard.id, direction);
      const next = nextId ? wishlist.find((w) => w.id === nextId) : null;
      if (next) {
        setEditing(false);
        setExpanded(false);
        setWishCard(next);
      }
      return;
    }
    if (!selectedStop) return;
    const ids = dayStopsOf(selectedStop.day).map((s) => s.id);
    const nextId = stepInChain(ids, selectedStop.id, direction);
    if (nextId) {
      setEditing(false);
      setExpanded(false);
      setSelectedStopIds(new Set([nextId]));
    }
  }

  const blockHandlers = {
    onAddBlock: (stopId: string, kind: BlockKind) =>
      run(() =>
        addBlock(
          pb,
          tripId,
          stopId,
          kind,
          blocksFor(records.blocks, 'stop', stopId).length,
        ),
      ),
    onUpdateBlock: (blockId: string, patch: BlockPatch) =>
      run(() => updateBlock(pb, blockId, patch)),
    onDeleteBlock: (blockId: string) => run(() => deleteBlock(pb, blockId)),
    onMoveBlock: (stopId: string, blockId: string, dir: -1 | 1) =>
      run(() =>
        moveBlock(pb, blocksFor(records.blocks, 'stop', stopId), blockId, dir),
      ),
    onUploadBlockFile: (blockId: string, file: File) =>
      run(() => uploadBlockPhoto(pb, blockId, file)),
  };

  const rail = (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
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
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border-t border-slate-200">
        <WishlistPanel
          items={wishlist}
          blocks={records?.blocks ?? []}
          onAdd={() => {
            setShareQuery(null);
            setSearchMode('wishlist');
          }}
          onImport={() => setShowHighlightsImport(true)}
          onPreview={(item) => openCard(() => setWishCard(item))}
          onReject={rejectWishlist}
        />
      </div>
    </div>
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
          onOpenSearch={() => setSearchMode('placement')}
          onOpenUncategorized={() => setShowUncategorized(true)}
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
            onPlaceAccessPoint={startPlacingAccessPoint}
            onClearAccessPoint={clearAccessPoint}
            onDragStop={dragStop}
            onDragAccessPoint={dragAccessPoint}
            onSelectNearby={selectNearby}
            wishlist={wishlist}
            onSelectWishlist={(item) => openCard(() => setWishCard(item))}
            selectedWishlistId={wishCard?.id ?? null}
            onSelectDay={(id) => setSelectedDayId(id)}
            onAddDay={() =>
              run(() =>
                insertDay(pb, tripId, records.days.length, { kind: 'travel' }),
              )
            }
            {...blockHandlers}
            openKindPickerSignal={kindPickerSignal}
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
            onPlaceAccessPoint={startPlacingAccessPoint}
            onClearAccessPoint={clearAccessPoint}
            onDragStop={dragStop}
            onDragAccessPoint={dragAccessPoint}
            onSelectNearby={selectNearby}
            wishlist={wishlist}
            onSelectWishlist={(item) => openCard(() => setWishCard(item))}
            selectedWishlistId={wishCard?.id ?? null}
            onSelectDay={(id) => setSelectedDayId(id)}
            onAddDay={() =>
              run(() =>
                insertDay(pb, tripId, records.days.length, { kind: 'travel' }),
              )
            }
            {...blockHandlers}
            openKindPickerSignal={kindPickerSignal}
            hoveredStopId={hoveredStopId}
            focusDayId={selectedDayId}
            flyTo={flyTo}
          />
        </Drawer>
      )}
      {searchMode && (
        <SearchPalette
          initialQuery={
            searchMode === 'wishlist' ? (shareQuery ?? undefined) : undefined
          }
          onPick={(place, sourceUrl) => {
            const mode = searchMode;
            setSearchMode(null);
            setShareQuery(null);
            if (mode === 'wishlist') commitWishlistPick(place, sourceUrl);
            else addPlaceStop(place, sourceUrl);
          }}
          onClose={() => {
            setSearchMode(null);
            setShareQuery(null);
          }}
        />
      )}
      {showHighlightsImport && (
        <HighlightsImportDialog
          tripId={tripId}
          onClose={() => setShowHighlightsImport(false)}
          onImported={() => {
            reloadWishlist();
            void reload();
          }}
        />
      )}
      {pendingPlacement && records && (
        <PlacementPicker
          candidate={pendingPlacement}
          records={records}
          provider={routing}
          onPick={commitPlacement}
          onCancel={() => setPendingPlacement(null)}
        />
      )}
      {mergeCheck && (
        <MergePrompt
          candidateName={mergeCheck.candidate.name}
          existingStop={mergeCheck.existingStop}
          onUseExisting={useExistingStop}
          onCreateNew={createSeparateStop}
          onCancel={() => setMergeCheck(null)}
        />
      )}
      {cardTarget && (
        <PinCard
          target={cardTarget}
          blocks={
            cardTarget.type === 'stop'
              ? blocksFor(records.blocks, 'stop', cardTarget.stop.id)
              : cardTarget.type === 'wish'
                ? blocksFor(records.blocks, 'poi', cardTarget.item.id)
                : []
          }
          editing={editing}
          onToggleEdit={() => setEditing((v) => !v)}
          onClose={closeCard}
          onStep={stepCard}
          onOpenDetails={() => setExpanded(true)}
          onRemove={() => {
            if (cardTarget.type === 'stop') deleteOneStop(cardTarget.stop.id);
            closeCard();
          }}
          onAddToItinerary={() => {
            if (cardTarget.type === 'wish') placeWishlistItem(cardTarget.item);
            closeCard();
          }}
          onReject={() => {
            if (cardTarget.type === 'wish') rejectWishlist(cardTarget.item.id);
            closeCard();
          }}
          onAddWishlist={() => {
            if (cardTarget.type === 'empty') {
              commitWishlistPick({
                name: cardTarget.place?.name ?? 'Dropped pin',
                kind: cardTarget.place?.kind ?? 'uncategorized',
                lat: cardTarget.lat,
                lon: cardTarget.lon,
              });
            }
            closeCard();
          }}
          onAddDay={() => {
            if (cardTarget.type === 'empty') {
              beginCapture({
                name: cardTarget.place?.name ?? 'Dropped pin',
                kind: cardTarget.place?.kind ?? 'uncategorized',
                lat: cardTarget.lat,
                lon: cardTarget.lon,
              });
            }
            setEmptyCard(null);
            setEditing(false);
          }}
          onUpdateStop={(patch) => {
            if (cardTarget.type === 'stop')
              handleUpdateStop(cardTarget.stop.id, patch);
          }}
          onPlaceAccessPoint={() => {
            if (cardTarget.type === 'stop')
              startPlacingAccessPoint(cardTarget.stop.id);
          }}
          onClearAccessPoint={() => {
            if (cardTarget.type === 'stop')
              clearAccessPoint(cardTarget.stop.id);
          }}
          onAddBlock={(kind) => {
            if (cardTarget.type === 'stop')
              blockHandlers.onAddBlock(cardTarget.stop.id, kind);
          }}
          openKindPickerSignal={kindPickerSignal}
        />
      )}
      {expanded && cardTarget?.type === 'stop' && (
        <PinCardExpanded
          stop={cardTarget.stop}
          blocks={blocksFor(records.blocks, 'stop', cardTarget.stop.id)}
          days={days}
          tripStartDate={trip.start_date}
          timing={cardTarget.timing}
          daylight={cardTarget.daylight}
          onClose={() => setExpanded(false)}
          onUpdate={(patch) => handleUpdateStop(cardTarget.stop.id, patch)}
          onPlaceAccessPoint={() => startPlacingAccessPoint(cardTarget.stop.id)}
          onClearAccessPoint={() => clearAccessPoint(cardTarget.stop.id)}
          onMoveToDay={(dayId) => moveStopToDay(cardTarget.stop.id, dayId)}
          onRemove={() => {
            deleteOneStop(cardTarget.stop.id);
            closeCard();
          }}
          onAddBlock={(kind) =>
            blockHandlers.onAddBlock(cardTarget.stop.id, kind)
          }
          onUpdateBlock={blockHandlers.onUpdateBlock}
          onDeleteBlock={blockHandlers.onDeleteBlock}
          onMoveBlock={(blockId, dir) =>
            blockHandlers.onMoveBlock(cardTarget.stop.id, blockId, dir)
          }
          onUploadBlockFile={blockHandlers.onUploadBlockFile}
          openKindPickerSignal={kindPickerSignal}
        />
      )}
      {showUncategorized && records && (
        <UncategorizedReview
          stops={records.stops.filter((s) => s.kind === 'uncategorized')}
          onUpdateKind={(stopId, kind) =>
            run(() => updateStop(pb, stopId, { kind, kind_confirmed: true }))
          }
          onSelectStop={(id) => {
            setSelectedStopIds(new Set([id]));
            setShowUncategorized(false);
          }}
          onClose={() => setShowUncategorized(false)}
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
