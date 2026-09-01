import { useCallback, useEffect, useMemo, useState } from 'react';
import { pb, isAbortError } from '../lib/pb';
import { useTripEditor } from '../hooks/useTripEditor';
import { useAuth } from '../hooks/useAuth';
import { insertDay, deleteDay } from '../lib/pb-days';
import { exportTrip, exportWishlist, exportFilename } from '../lib/export-trip';
import {
  addStopAtEnd,
  addStopAt,
  deleteStop,
  downgradeStopToWishlist,
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
  deleteWishlistItem,
  setPoiStarred,
  setPoiLocation,
} from '../lib/pb-pois';
import { createPocketBaseRouting } from '../lib/routing';
import { shiftClock } from '../lib/format';
import { photonReverse, type PlaceResult } from '../lib/photon';
import { addLinkBlock, createWikimediaPhotoBlock } from '../lib/pb-capture';
import type { PlacementOption } from '../lib/placement';
import { queryParking, type NearbyPoi, type ParkingLot } from '../lib/overpass';
import type { BlocksResponse, PoisResponse } from '../types/pb';
import {
  addBlock,
  updateBlock,
  deleteBlock,
  moveBlock,
  blocksFor,
  reparentBlocks,
  uploadBlockPhoto,
  type BlockKind,
  type BlockPatch,
} from '../lib/pb-blocks';
import { WishlistPanel } from './WishlistPanel';
import { WishlistCarousel } from './WishlistCarousel';
import { PinCard, type CardTarget } from './PinCard';
import { PinCardExpanded } from './PinCardExpanded';
import { buildProximityChain, stepInChain } from '../lib/wish-order';
import { reconcileLeadingLegs, setDayStartStop } from '../lib/pb-leading-leg';
import { UncategorizedReview } from './UncategorizedReview';
import { SearchPalette } from './SearchPalette';
import { HighlightsImportDialog } from './HighlightsImportDialog';
import { Timeline } from './Timeline';
import { MapPane } from './MapPane';
import { PlacementPicker, type PlacementCandidate } from './PlacementPicker';
import { MergePrompt } from './MergePrompt';
import { AccommodationPrompt } from './AccommodationPrompt';
import { TimingConflictPrompt } from './TimingConflictPrompt';
import {
  planTimingEdit,
  type TimingCell,
  type TimingChange,
  type TimingEditPlan,
  type TimingStop,
} from '../lib/timing-edit';
import { isAccommodationKind, isKind } from '../lib/taxonomy';
import { findNearbyStop } from '../lib/merge';
import type { StopsResponse } from '../types/pb';

/** What every capture path (search, paste, map click, wishlist promotion,
 * nearby) ends up as before it's ranked (WORK 6.3) or merge-checked
 * (WORK 6.5). wishlistId is set only when promoting a wishlist item, so its
 * source's blocks can be re-parented and it deleted once the capture
 * resolves (WORK 14). wikidataId is set only by Nearby (Overpass carries
 * the tag; Photon doesn't — see wikimedia.ts), and drives an auto-attached
 * Commons photo block (WORK 7.2). */
type CaptureCandidate = PlacementCandidate & {
  kind: string;
  sourceUrl?: string;
  wishlistId?: string;
  wikidataId?: string;
};

/** Radius for the access-point parking lookup (WORK 12.9) — small on
 * purpose: this is "the car park for this stop", not a corridor scan. */
const PARKING_RADIUS_M = 600;

export function TripEditor({
  tripId,
  onBack,
  sharedCapture,
  onSharedCaptureConsumed,
}: {
  tripId: string;
  /** Back to the trip list — the header lives here now, not in `App`. */
  onBack: () => void;
  /** Text/URL handed off from the PWA share target (WORK 6.4) — opens the
   * wishlist capture flow prefilled, once. */
  sharedCapture?: string | null;
  onSharedCaptureConsumed?: () => void;
}) {
  const { records, result, error, reload } = useTripEditor(tripId);
  const { user } = useAuth();
  const routing = useMemo(() => createPocketBaseRouting(pb), []);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedStopIds, setSelectedStopIds] = useState<Set<string>>(
    new Set(),
  );
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  // Centres the map on demand. Its old trigger (the inspector's zoom
  // button) retired with the inspector; now it's wishlist selection, where
  // the item is regularly outside the current view.
  const [flyTo, setFlyTo] = useState<{
    lat: number;
    lon: number;
    nonce: number;
  } | null>(null);
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
  // Access-point picking (WORK 12.9): a real mode, not just a banner. While
  // set, the docked card, the expanded modal and the wishlist panel all hide
  // and the map is handed back — see the render gates below.
  const [picking, setPicking] = useState<{
    stopId: string;
    title: string;
    lat: number;
    lon: number;
    returnToExpanded: boolean;
  } | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [pendingPlacement, setPendingPlacement] =
    useState<CaptureCandidate | null>(null);
  const [mergeCheck, setMergeCheck] = useState<{
    candidate: CaptureCandidate;
    existingStop: StopsResponse;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Repairing a wishlist idea the importer couldn't geocode: the next map
  // click is its location. Separate from access-point `picking`, which zooms
  // to a stop it already has coordinates for.
  const [placingWish, setPlacingWish] = useState<{
    id: string;
    title: string;
  } | null>(null);
  // A timing edit that needs a decision before it can be written (WORK 16.1).
  const [timingConflict, setTimingConflict] = useState<Extract<
    TimingEditPlan,
    { kind: 'conflict' }
  > | null>(null);
  // The stop a timing edit changed *without* being asked to — the dwell that
  // absorbed someone else's slack. Marked on its cell for a while so it is
  // findable, not just announced once in a dialog.
  const [timingFlash, setTimingFlash] = useState<string | null>(null);
  // Neutral counterpart to actionError: something happened that the planner
  // should know about but nothing went wrong.
  const [notice, setNotice] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  // Raised the moment a stop becomes a hotel or campsite — see
  // AccommodationPrompt for why this is asked rather than assumed.
  const [accommodationAsk, setAccommodationAsk] = useState<{
    stopId: string;
    title: string;
    dayLabel: string;
  } | null>(null);
  // Wishlist fallback list, bottom-left over the map — hidden whenever a
  // card is open, since they share that corner (design handoff).
  const [wishlistPanelOpen, setWishlistPanelOpen] = useState(true);
  // Wishlist carousel (WORK 12.10): the full-width "photo wheel", desktop
  // only. Shares the bottom-left slot with the panel, so opening it hides
  // the panel and clears any selection. `hoveredWishId` is the highlight
  // shared by the carousel, the panel list and the map pins; `starOnly` is
  // the carousel's `★ Top choices` filter.
  const [browsing, setBrowsing] = useState(false);
  const [hoveredWishId, setHoveredWishId] = useState<string | null>(null);
  const [starOnly, setStarOnly] = useState(false);

  // Wishlist lives outside the cascade-oriented trip doc (it has no day/
  // order_index), so it gets its own small fetch rather than riding along
  // with useTripEditor's reload.
  /** Returns the fresh list too, for callers that must act on the item they
   * just changed (re-opening its card, say) rather than the stale copy. */
  const reloadWishlist = useCallback(() => {
    return listWishlist(pb, tripId)
      .then((items) => {
        setWishlist(items);
        return items;
      })
      .catch((err) => {
        if (isAbortError(err)) return null; // benign under StrictMode
        setActionError(
          err instanceof Error ? err.message : 'Failed to load wishlist.',
        );
        return null;
      });
  }, [tripId]);
  useEffect(() => {
    void reloadWishlist();
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

  /** `run` plus a cross-day leading-leg reconcile (WORK 13.2): a structural
   * edit — adding/removing/reordering/moving a stop, or moving a start-point /
   * first-stop's coordinates — can leave a day's leading leg pointing at the
   * wrong stop or needing a re-route. Skipped entirely until some day has a
   * start point, so it's free for trips that don't use the feature.
   * `rerouteStopIds` names stops whose coordinates just moved. */
  async function runStructural(
    fn: () => Promise<unknown>,
    rerouteStopIds?: Iterable<string>,
  ) {
    try {
      await fn();
      if (records?.days.some((d) => d.start_stop)) {
        await reconcileLeadingLegs(
          pb,
          routing,
          tripId,
          new Set(rerouteStopIds ?? []),
        );
      }
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
    setBrowsing(false);
    setHoveredWishId(null);
    open();
  }

  /** Opening a wishlist idea also centres the map on it. Ideas sit
   * anywhere in the trip's country, routinely outside the current view, so
   * without this, picking one from the list (or stepping to it with the
   * card's ‹/›) looks like nothing happened. */
  function showWishlistItem(item: PoisResponse) {
    openCard(() => setWishCard(item));
    if (item.lat && item.lon) {
      setFlyTo({ lat: item.lat, lon: item.lon, nonce: Date.now() });
    }
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
    void runStructural(() =>
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
    if (picking) {
      finishPicking({ access_lat: lat, access_lon: lon });
      return;
    }
    if (placingWish) {
      const { id } = placingWish;
      setPlacingWish(null);
      void run(async () => {
        await setPoiLocation(pb, id, lat, lon);
        const items = await reloadWishlist();
        const placed = items?.find((i) => i.id === id);
        if (placed) openCard(() => setWishCard(placed));
      });
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
    void runStructural(async () => {
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
      maybeAskAccommodation(
        stopId,
        candidate.kind,
        candidate.name,
        option.dayId,
      );
      // Promoting a wishlist idea (WORK 14): its blocks — photos,
      // description, links — move onto the new stop wholesale, then the
      // idea itself is deleted rather than left as a hidden tombstone.
      if (candidate.wishlistId) {
        await reparentBlocks(
          pb,
          records.blocks,
          { type: 'poi', id: candidate.wishlistId },
          { type: 'stop', id: stopId },
        );
        await deleteWishlistItem(pb, candidate.wishlistId);
        reloadWishlist();
      }
      // Keep the pasted URL as a link block on the new stop (BUILD §6) —
      // only reachable for a non-wishlist capture; a promoted idea's own
      // links already came across via reparentBlocks above.
      if (candidate.sourceUrl) {
        await addLinkBlock(
          pb,
          tripId,
          { type: 'stop', id: stopId },
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
    });
  }

  // Wishlist (WORK 6.4): captures without a slot land here instead of the
  // placement picker. "+ Idea" and a nearby ghost pin both feed the same
  // SearchPalette; searchMode decides what onPick does with the result.
  function commitWishlistPick(place: PlaceResult, sourceUrl?: string) {
    void run(async () => {
      const poiId = await addWishlistItem(pb, tripId, {
        title: place.name,
        kind: place.kind,
        lat: place.lat,
        lon: place.lon,
      });
      // A pasted/shared URL becomes a link block (WORK 14: pois have no url
      // field of their own any more).
      if (sourceUrl) {
        await addLinkBlock(
          pb,
          tripId,
          { type: 'poi', id: poiId },
          sourceUrl,
          place.name,
        );
      }
      reloadWishlist();
    });
  }

  function deleteWishlist(id: string) {
    void deleteWishlistItem(pb, id).then(reloadWishlist);
  }

  // `★ Top choices` toggle (WORK 12.10). Persisted on the poi, then the
  // wishlist refetch re-runs MapPane's pin compositing so the gold badge
  // appears/clears. Not routed through `run()` — that reloads the cascade
  // trip doc, and starring touches neither stops nor legs.
  function toggleWishStar(item: PoisResponse, next: boolean) {
    void setPoiStarred(pb, item.id, next)
      .then(reloadWishlist)
      .catch((err) =>
        setActionError(
          err instanceof Error ? err.message : 'Failed to update star.',
        ),
      );
  }

  function openBrowsing() {
    closeCard();
    setHoveredWishId(null);
    setBrowsing(true);
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

  // Stable {lat,lon} identity for MapPane's picking effects — `picking` state
  // only changes on start/finish, so this memo only recomputes then.
  const mapPicking = useMemo(
    () => (picking ? { lat: picking.lat, lon: picking.lon } : null),
    [picking],
  );

  // Placing a wishlist item or a nearby ghost pin is the same ranked
  // placement flow as any other capture (WORK 6.3) — a wishlist item just
  // arrives with a wishlistId so commitPlacement can re-parent its blocks
  // and delete it once the new stop lands (WORK 14).
  function placeWishlistItem(item: PoisResponse) {
    if (!item.lat || !item.lon) return;
    beginCapture({
      name: item.title,
      kind: item.kind ?? 'uncategorized',
      lat: item.lat,
      lon: item.lon,
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
  // the candidate's link and, for a wishlist promotion, its blocks — the
  // same side effects commitPlacement would have applied to a newly
  // created stop), override and create a separate stop anyway, or cancel
  // the capture entirely.
  function useExistingStop() {
    const check = mergeCheck;
    setMergeCheck(null);
    if (!check || !records) return;
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
          { type: 'stop', id: check.existingStop.id },
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
        await reparentBlocks(
          pb,
          records.blocks,
          { type: 'poi', id: check.candidate.wishlistId },
          { type: 'stop', id: check.existingStop.id },
        );
        await deleteWishlistItem(pb, check.candidate.wishlistId);
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
    void runStructural(async () => {
      const batch = pb.createBatch();
      for (const id of ids) batch.collection('stops').delete(id);
      await batch.send();
    });
  }

  function startPlacingAccessPoint(stopId: string) {
    const stop = records?.stops.find((s) => s.id === stopId);
    if (!stop || !stop.lat || !stop.lon) return;
    setPicking({
      stopId,
      title: stop.title,
      lat: stop.lat,
      lon: stop.lon,
      returnToExpanded: expanded,
    });
    setExpanded(false);
    setParkingLots([]);
    // Zero chips in range is a valid state — freehand clicking is the fallback.
    void queryParking({ lat: stop.lat, lon: stop.lon }, PARKING_RADIUS_M)
      .then(setParkingLots)
      .catch(() => setParkingLots([]));
  }

  /** Leave picking. `patch` writes an access point (a freehand click or a
   * parking chip); a `0,0` patch clears it (the banner's Reset); `null`
   * cancels with no change. Returns to the expanded modal when picking
   * started there. */
  function finishPicking(
    patch: { access_lat: number; access_lon: number } | null,
  ) {
    const p = picking;
    if (!p) return;
    setPicking(null);
    setParkingLots([]);
    if (p.returnToExpanded) setExpanded(true);
    if (patch && records) {
      void runStructural(
        () => updateStopAndReroute(pb, routing, records, p.stopId, patch),
        [p.stopId],
      );
    }
  }

  function clearAccessPoint(stopId: string) {
    if (!records) return;
    void runStructural(
      () =>
        updateStopAndReroute(pb, routing, records, stopId, {
          access_lat: 0,
          access_lon: 0,
        }),
      [stopId],
    );
  }

  function dragStop(stopId: string, lat: number, lon: number) {
    if (!records) return;
    void runStructural(
      () => updateStopAndReroute(pb, routing, records, stopId, { lat, lon }),
      [stopId],
    );
  }

  function dragAccessPoint(stopId: string, lat: number, lon: number) {
    if (!records) return;
    void runStructural(
      () =>
        updateStopAndReroute(pb, routing, records, stopId, {
          access_lat: lat,
          access_lon: lon,
        }),
      [stopId],
    );
  }

  /** Ask about a stop that just became somewhere you sleep. Silent when the
   * kind isn't one, or when the stop is already the day's accommodation. */
  function maybeAskAccommodation(
    stopId: string,
    kind: string | undefined,
    title: string,
    dayId: string,
  ) {
    if (!records || !kind || !isKind(kind) || !isAccommodationKind(kind)) {
      return;
    }
    const dayIndex = records.days.findIndex((d) => d.id === dayId);
    if (dayIndex < 0) return;
    setAccommodationAsk({
      stopId,
      title,
      dayLabel: `Day ${dayIndex + 1}`,
    });
  }

  /** Download the trip, or just its wishlist, as JSON (WORK 16.3). Files
   * are not carried — `exportTrip` reports how many it left behind. */
  function doExport(what: 'trip' | 'wishlist') {
    setExportOpen(false);
    if (!records) return;
    const doc =
      what === 'trip'
        ? exportTrip(records)
        : exportWishlist(wishlist, records.blocks);
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename(records.trip.title, what);
    a.click();
    URL.revokeObjectURL(url);
    const omitted = 'omitted_files' in doc ? (doc.omitted_files ?? 0) : 0;
    setNotice(
      omitted
        ? `Exported. ${omitted} uploaded file${omitted === 1 ? '' : 's'} could not travel in JSON — re-attach them after importing.`
        : 'Exported.',
    );
    window.setTimeout(() => setNotice(null), 6000);
  }

  /** Insert a day at `atIndex` (WORK 16.2). The data layer reindexes the
   * days below it in one batch and hands back the day-parented blocks whose
   * derived date moved as a result — a booking pinned to "day 4" is now a
   * day later, which the planner has to be told rather than discover. */
  function doInsertDay(atIndex: number) {
    if (!records) return;
    void run(async () => {
      const { changedBlocks } = await insertDay(pb, tripId, atIndex, {
        kind: 'travel',
      });
      noteShiftedBlocks(changedBlocks, 'A new day pushed');
    });
  }

  function doDeleteDay(dayId: string) {
    if (!records) return;
    void run(async () => {
      const changedBlocks = await deleteDay(pb, tripId, dayId);
      noteShiftedBlocks(changedBlocks, 'Removing that day pulled');
      setSelectedStopIds(new Set());
    });
  }

  function noteShiftedBlocks(changed: BlocksResponse[], lead: string) {
    if (changed.length === 0) return setNotice(null);
    setNotice(
      `${lead} ${changed.length} note${changed.length === 1 ? '' : 's'} onto a different date.`,
    );
    window.setTimeout(() => setNotice(null), 8000);
  }

  /** Writes a plan's changes in one go, then reloads once. */
  function applyTimingChanges(changes: TimingChange[]) {
    if (changes.length === 0) return;
    void run(async () => {
      for (const change of changes) {
        await updateStop(pb, change.stopId, change.patch);
      }
    });
  }

  /** A timing cell was typed into. The three cells are cascade output, so
   * this translates the edit back into the stored fields that produce it —
   * and asks first when the result would fight an anchor further up the day
   * (WORK 16.1, `planTimingEdit`). */
  function editTiming(stopId: string, cell: TimingCell, value: string) {
    if (!records || !result) return;
    const stop = records.stops.find((s) => s.id === stopId);
    if (!stop) return;
    const dayStops = records.stops
      .filter((s) => s.day === stop.day)
      .sort((a, b) => a.order_index - b.order_index);
    const dayResult = result.days.find((d) => d.dayId === stop.day);
    const timingById = new Map(
      dayResult?.stops.map((t) => [t.stopId, t]) ?? [],
    );
    const timingStops: TimingStop[] = dayStops.map((s) => {
      const t = timingById.get(s.id);
      return {
        id: s.id,
        title: s.title,
        anchorTime: s.anchor_time?.trim() ? s.anchor_time : null,
        dwell: t?.dwell ?? 0,
        arrival: t?.arrival ?? 0,
        departure: t?.departure ?? 0,
      };
    });
    const plan = planTimingEdit({
      stops: timingStops,
      index: dayStops.findIndex((s) => s.id === stopId),
      cell,
      value,
    });
    if (plan.kind === 'noop') return;
    if (plan.kind === 'apply') return applyTimingChanges(plan.changes);
    setTimingConflict(plan);
  }

  function handleUpdateStop(id: string, patch: StopPatch) {
    const existing = records?.stops.find((s) => s.id === id);
    if (existing && !existing.is_accommodation) {
      maybeAskAccommodation(
        id,
        patch.kind,
        patch.title ?? existing.title,
        existing.day,
      );
    }
    const reroute =
      patch.lat !== undefined ||
      patch.lon !== undefined ||
      patch.access_lat !== undefined ||
      patch.access_lon !== undefined;
    if (reroute && records) {
      void runStructural(
        () => updateStopAndReroute(pb, routing, records, id, patch),
        [id],
      );
    } else {
      void run(() => updateStop(pb, id, patch));
    }
  }

  // Day-start continuity (WORK 13.3): point a day at (or clear) the stop it
  // leaves from in the morning, then reconcile its leading leg. Not routed
  // through `runStructural` — that skips the reconcile until some day
  // already has a start point, which is exactly the case this creates.
  function setStartPoint(dayId: string, stopId: string | null) {
    void (async () => {
      try {
        await setDayStartStop(pb, dayId, stopId);
        await reconcileLeadingLegs(pb, routing, tripId);
        await reload();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Failed to set start point.',
        );
      }
    })();
  }

  // "Move to day…" (WORK 12.3, expanded card): appends to the end of the
  // target day, reusing the same reindex-and-reroute path drag-and-drop
  // already relies on (WORK 4.3) — no ranking needed, the day is explicit.
  function moveStopToDay(stopId: string, targetDayId: string) {
    if (!records) return;
    const targetIndex = records.stops.filter(
      (s) => s.day === targetDayId,
    ).length;
    void runStructural(() =>
      moveStop(pb, routing, records, stopId, targetDayId, targetIndex),
    );
  }

  // Delete a single stop with proper leg re-merge (row ✕ and inspector).
  function deleteOneStop(stopId: string) {
    const stop = records?.stops.find((s) => s.id === stopId);
    if (!records || !stop) return;
    void runStructural(() =>
      deleteStop(
        pb,
        routing,
        records.stops.filter((s) => s.day === stop.day),
        records.legs,
        stopId,
      ),
    );
  }

  // The mirror of promotion (WORK 14.2): the ♻ button on the stop card.
  function downgradeStop(stopId: string) {
    if (!records) return;
    void runStructural(() =>
      downgradeStopToWishlist(pb, routing, records, stopId),
    ).then(reloadWishlist);
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
    void runStructural(() =>
      moveStop(pb, routing, records, id, stop.day, target),
    );
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
      if (e.key === 'Escape' && timingConflict) return setTimingConflict(null);
      if (e.key === 'Escape' && placingWish) return setPlacingWish(null);
      if (e.key === 'Escape' && picking) return finishPicking(null);
      if (e.key === 'Escape' && browsing) return setBrowsing(false);
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
    picking,
    placingWish,
    timingConflict,
    pendingPlacement,
    mergeCheck,
    wishCard,
    emptyCard,
    browsing,
  ]);

  if (!records) {
    return (
      <div className="p-6 text-sm text-slate-400">
        {error ?? 'Loading trip…'}
      </div>
    );
  }

  const { trip, days, stops, legs } = records;
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
        if (next.lat && next.lon) {
          setFlyTo({ lat: next.lat, lon: next.lon, nonce: Date.now() });
        }
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

  // BUILD §7: "the trip header shows an uncategorized counter" — real kind
  // uncategorized specifically, not the kind_confirmed "auto-detected"
  // flag.
  const uncategorizedCount = stops.filter(
    (s) => s.kind === 'uncategorized',
  ).length;
  const activeDay = days.find((d) => d.id === selectedDayId) ?? days[0] ?? null;
  const activeDayIndex = activeDay
    ? days.findIndex((d) => d.id === activeDay.id)
    : 0;

  // Day-start continuity (WORK 13.3). The stop the active day leaves from
  // (`start_stop`), its routed leading leg, and — for the "Start from …"
  // button — the previous accommodation the button would point at: the
  // nearest earlier non-empty day's last `is_accommodation` stop, or its
  // last stop if that day has none.
  const startPointStop = activeDay?.start_stop
    ? (stops.find((s) => s.id === activeDay.start_stop) ?? null)
    : null;
  const activeDayFirstStop = activeDay
    ? dayStopsOf(activeDay.id)[0]
    : undefined;
  const startPointLeg =
    startPointStop && activeDayFirstStop
      ? legs.find(
          (l) =>
            l.from_stop === startPointStop.id &&
            l.to_stop === activeDayFirstStop.id,
        )
      : undefined;
  let startPointCandidate: StopsResponse | null = null;
  for (let di = activeDayIndex - 1; di >= 0 && !startPointCandidate; di--) {
    const ds = dayStopsOf(days[di]!.id);
    if (ds.length === 0) continue;
    startPointCandidate =
      [...ds].reverse().find((s) => s.is_accommodation) ?? ds[ds.length - 1]!;
  }

  const cardOpen = !!cardTarget;
  const pickingStop = picking
    ? (stops.find((s) => s.id === picking.stopId) ?? null)
    : null;
  const pickingHasAccess =
    !!pickingStop?.access_lat && !!pickingStop?.access_lon;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg font-sans text-text">
      <header className="flex h-[52px] flex-none items-center gap-3.5 border-b border-border bg-surface-2 px-3.5">
        <button
          onClick={onBack}
          className="flex-none whitespace-nowrap text-[13px] text-text-3 hover:text-text"
        >
          ← Trips
        </button>
        <span className="h-5 w-px flex-none bg-[oklch(0.30_0.012_250)]" />
        <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em]">
          {trip.title}
        </h1>
        <span className="flex-none font-mono text-[11px] text-text-4">
          {days.length} {days.length === 1 ? 'day' : 'days'} · {stops.length}{' '}
          {stops.length === 1 ? 'stop' : 'stops'}
        </span>
        {uncategorizedCount > 0 && (
          <button
            onClick={() => setShowUncategorized(true)}
            title="Review and give these stops a kind"
            className="h-[30px] flex-none rounded-lg border border-warn-border bg-warn-bg px-2.5 text-xs text-warn-text"
          >
            ⚠ {uncategorizedCount}
          </button>
        )}
        <div className="ml-auto flex flex-none items-center gap-2">
          <button
            onClick={() => setSearchMode('placement')}
            title="Search places (⌘K)"
            className="h-[30px] rounded-lg bg-control px-3 text-[13px] text-text-2 hover:bg-control-hover"
          >
            Search
          </button>
          <button
            onClick={() => setShowHighlightsImport(true)}
            title="Import highlights from pasted JSON"
            className="h-[30px] rounded-lg bg-control px-3 text-[13px] text-text-2 hover:bg-control-hover"
          >
            Import
          </button>
          <div className="relative">
            <button
              onClick={() => setExportOpen((open) => !open)}
              title="Download this trip as JSON"
              className="h-[30px] rounded-lg bg-control px-3 text-[13px] text-text-2 hover:bg-control-hover"
            >
              Export
            </button>
            {exportOpen && (
              <div
                onMouseLeave={() => setExportOpen(false)}
                className="absolute right-0 top-[34px] z-40 w-56 overflow-hidden rounded-lg border border-border-strong bg-surface-2 py-1 shadow-card"
              >
                <button
                  onClick={() => doExport('trip')}
                  className="block w-full px-3 py-2 text-left text-[13px] text-text-2 hover:bg-control"
                >
                  Whole trip
                  <span className="mt-0.5 block text-[11px] text-text-4">
                    days, stops, legs, notes and links
                  </span>
                </button>
                <button
                  onClick={() => doExport('wishlist')}
                  className="block w-full px-3 py-2 text-left text-[13px] text-text-2 hover:bg-control"
                >
                  Wishlist only
                  <span className="mt-0.5 block text-[11px] text-text-4">
                    the Highlights format — pastes back into Import
                  </span>
                </button>
              </div>
            )}
          </div>
          {/* The email never renders as text at any width — the fix for the
              known "phone width breaks the header first" friction. */}
          <span
            title={user?.email ?? ''}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[oklch(0.32_0.03_250)] text-[13px] uppercase text-text"
          >
            {(user?.email ?? '?').slice(0, 1)}
          </span>
        </div>
      </header>

      {actionError && (
        <p className="flex-none bg-warn-bg px-4 py-1 text-xs text-warn-text">
          {actionError}
        </p>
      )}
      {notice && !actionError && (
        <p className="flex-none bg-accent-surface px-4 py-1 text-xs text-text-2">
          {notice}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px]">
        <div className="relative min-h-0 overflow-hidden">
          <MapPane
            records={records}
            result={result}
            onMapClick={onMapClick}
            onSelectStop={(id) => toggleSelect(id, false)}
            onHoverStop={setHoveredStopId}
            hoveredStopId={hoveredStopId}
            focusDayId={selectedDayId}
            selectedStop={selectedStop}
            onDragStop={dragStop}
            onDragAccessPoint={dragAccessPoint}
            onSelectNearby={selectNearby}
            wishlist={wishlist}
            onSelectWishlist={(item) => openCard(() => setWishCard(item))}
            flyTo={flyTo}
            selectedWishlistId={wishCard?.id ?? null}
            hoveredWishlistId={hoveredWishId}
            onSelectDay={(id) => setSelectedDayId(id)}
            onAddDay={() => doInsertDay(records.days.length)}
            onInsertDay={doInsertDay}
            picking={mapPicking}
            placing={!!placingWish}
            parkingLots={parkingLots}
            onPickParking={(lot) =>
              finishPicking({ access_lat: lot.lat, access_lon: lot.lon })
            }
          />

          {placingWish && (
            <div className="pointer-events-none absolute inset-x-0 top-[62px] z-40 flex justify-center px-4">
              <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[oklch(0.42_0.08_80)] bg-[oklch(0.20_0.013_250/0.95)] py-2.5 pl-4 pr-3 text-text shadow-card backdrop-blur-[12px]">
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 border-dashed border-wishlist font-mono text-[10px] text-wishlist">
                  ?
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[13px] font-medium">
                    Click the map to place {placingWish.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-text-4">
                    The import couldn&rsquo;t find this one — zoom in and put it
                    where it belongs
                  </span>
                </span>
                <span className="h-[26px] w-px flex-none bg-border-strong" />
                <button
                  onClick={() => setPlacingWish(null)}
                  className="h-[30px] flex-none whitespace-nowrap rounded-lg border border-border-strong px-3 text-[12.5px] text-text-2 hover:bg-control-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* Access-point picking banner (WORK 12.9), below the day-pill row. */}
          {picking && (
            <div className="pointer-events-none absolute inset-x-0 top-[62px] z-40 flex justify-center px-4">
              <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[oklch(0.40_0.06_215)] bg-[oklch(0.20_0.013_250/0.95)] py-2.5 pl-4 pr-3 text-text shadow-card backdrop-blur-[12px]">
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 border-dashed border-accent font-mono text-[10px] text-accent">
                  P
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[13px] font-medium">
                    Click the map to set the access point
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-text-4">
                    Zoomed to {picking.title} · nearby parking shown
                  </span>
                </span>
                <span className="h-[26px] w-px flex-none bg-border-strong" />
                {pickingHasAccess && (
                  <button
                    onClick={() =>
                      finishPicking({ access_lat: 0, access_lon: 0 })
                    }
                    className="h-[30px] flex-none whitespace-nowrap rounded-lg border border-border-strong px-3 text-[12.5px] text-text-2 hover:bg-control-hover"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => finishPicking(null)}
                  className="h-[30px] flex-none whitespace-nowrap rounded-lg border border-border-strong px-3 text-[12.5px] text-text-2 hover:bg-control-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Wishlist fallback list, the carousel and the card all share the
              bottom-left slot; the card wins, then the carousel (design
              handoff). Everything here hides while picking. */}
          {!cardOpen && !picking && !browsing && (
            <div className="absolute bottom-3.5 left-3.5 z-10">
              <WishlistPanel
                items={wishlist}
                blocks={records.blocks}
                open={wishlistPanelOpen}
                onToggle={() => setWishlistPanelOpen((v) => !v)}
                selectedId={wishCard?.id ?? null}
                hoveredId={hoveredWishId}
                onHover={setHoveredWishId}
                onAdd={() => {
                  setShareQuery(null);
                  setSearchMode('wishlist');
                }}
                onImport={() => setShowHighlightsImport(true)}
                onPreview={showWishlistItem}
                onBrowseAll={openBrowsing}
              />
            </div>
          )}

          {browsing && !cardOpen && !picking && (
            <WishlistCarousel
              items={wishlist}
              order={wishChain}
              blocks={records.blocks}
              starOnly={starOnly}
              onToggleStarOnly={() => setStarOnly((v) => !v)}
              hoveredId={hoveredWishId}
              onHover={setHoveredWishId}
              onToggleStar={toggleWishStar}
              onPick={(item) => {
                setBrowsing(false);
                showWishlistItem(item);
              }}
              onClose={() => {
                setBrowsing(false);
                setHoveredWishId(null);
              }}
            />
          )}
        </div>

        <aside className="min-h-0 border-l border-border">
          <Timeline
            trip={trip}
            day={activeDay}
            dayIndex={activeDayIndex}
            stops={stops}
            legs={legs}
            blocks={records.blocks}
            result={result}
            selectedStopIds={selectedStopIds}
            onSelectStop={toggleSelect}
            scrollToStopId={
              selectedStopIds.size === 1 ? [...selectedStopIds][0]! : null
            }
            hoveredStopId={hoveredStopId}
            onHoverStop={setHoveredStopId}
            startPointStop={startPointStop}
            startPointLeg={startPointLeg}
            startPointCandidate={startPointCandidate}
            onSetStartPoint={() =>
              activeDay &&
              startPointCandidate &&
              setStartPoint(activeDay.id, startPointCandidate.id)
            }
            onClearStartPoint={() =>
              activeDay && setStartPoint(activeDay.id, null)
            }
            onDeleteDay={doDeleteDay}
            onAddStop={(dayId) =>
              runStructural(() =>
                addStopAtEnd(
                  pb,
                  routing,
                  dayId,
                  stops.filter((s) => s.day === dayId),
                ),
              )
            }
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
              runStructural(() =>
                moveStop(
                  pb,
                  routing,
                  records,
                  stopId,
                  targetDayId,
                  targetIndex,
                ),
              )
            }
          />
        </aside>
      </div>

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
      {timingConflict && (
        <TimingConflictPrompt
          plan={timingConflict}
          onShift={() => {
            applyTimingChanges([timingConflict.anchor, timingConflict.shift]);
            setTimingConflict(null);
          }}
          onAbsorb={() => {
            const absorb = timingConflict.absorb;
            if (!absorb) return;
            applyTimingChanges([timingConflict.anchor, absorb]);
            setTimingFlash(absorb.stopId);
            window.setTimeout(() => setTimingFlash(null), 8000);
            setTimingConflict(null);
          }}
          onCancel={() => setTimingConflict(null)}
        />
      )}
      {accommodationAsk && (
        <AccommodationPrompt
          title={accommodationAsk.title}
          dayLabel={accommodationAsk.dayLabel}
          onConfirm={() => {
            handleUpdateStop(accommodationAsk.stopId, {
              is_accommodation: true,
            });
            setAccommodationAsk(null);
          }}
          onDismiss={() => setAccommodationAsk(null)}
        />
      )}
      {cardTarget && !picking && (
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
          onDowngrade={() => {
            if (cardTarget.type === 'stop') downgradeStop(cardTarget.stop.id);
            closeCard();
          }}
          onAddToItinerary={() => {
            if (cardTarget.type === 'wish') placeWishlistItem(cardTarget.item);
            closeCard();
          }}
          onEditTiming={(cell, value) => {
            if (cardTarget.type === 'stop') {
              editTiming(cardTarget.stop.id, cell, value);
            }
          }}
          timingFlashStopId={timingFlash}
          onSetLocation={() => {
            if (cardTarget.type !== 'wish') return;
            setPlacingWish({
              id: cardTarget.item.id,
              title: cardTarget.item.title,
            });
            closeCard();
          }}
          onDelete={() => {
            if (cardTarget.type === 'wish') deleteWishlist(cardTarget.item.id);
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
      {expanded && !picking && cardTarget?.type === 'stop' && (
        <PinCardExpanded
          stop={cardTarget.stop}
          blocks={blocksFor(records.blocks, 'stop', cardTarget.stop.id)}
          days={days}
          tripStartDate={trip.start_date}
          onEditTiming={(cell, value) =>
            editTiming(cardTarget.stop.id, cell, value)
          }
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
          onDowngrade={() => {
            downgradeStop(cardTarget.stop.id);
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
            handleUpdateStop(stopId, { kind, kind_confirmed: true })
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
