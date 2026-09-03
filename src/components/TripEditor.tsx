import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pb, isAbortError } from '../lib/pb';
import { useTripEditor } from '../hooks/useTripEditor';
import { useAuth } from '../hooks/useAuth';
import { useIsPhone } from '../hooks/useIsPhone';
import { useLinkOut } from '../hooks/useLinkOut';
import { insertDay, deleteDay } from '../lib/pb-days';
import { setSingleCost } from '../lib/pb-costs';
import { costsFor } from '../lib/costs';
import { exportTrip, exportWishlist, exportFilename } from '../lib/export-trip';
import { SharePanel } from './SharePanel';
import { BudgetPopover } from './BudgetPopover';
import { TripDatePopover } from './TripDatePopover';
import { SettingsPanel } from './SettingsPanel';
import { PrintView } from './PrintView';
import { AccountPanel } from './AccountPanel';
import { logout } from '../lib/auth';
import {
  shouldHintLinkOut,
  markLinkOutHinted,
} from '../lib/user-settings';
import {
  listMembers,
  setTripStartDate,
  updateTripSettings,
} from '../lib/pb-trips';
import {
  addStopAtEnd,
  addStopAt,
  deleteStop,
  downgradeStopToWishlist,
  moveStop,
  updateStop,
  updateStopAndReroute,
  rerouteAllLegs,
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
  updatePoi,
} from '../lib/pb-pois';
import { createPocketBaseRouting } from '../lib/routing';
import { addDays } from '../lib/cascade';
import { shiftClock, relativeTime } from '../lib/format';
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
  reorderBlock,
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
  const { records, result, error, offline, stale, savedAt, reload } =
    useTripEditor(tripId);
  const { user } = useAuth();
  const phone = useIsPhone();
  const routing = useMemo(() => createPocketBaseRouting(pb, tripId), [tripId]);
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
    sourceUrl?: string;
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
  const linkOut = useLinkOut();

  /** Every `↗` click. Says once — ever, per browser — that the app the
   * links open is a setting, then gets out of the way. `truncated` is the
   * day export losing stops to Google's 9-waypoint cap; that one is worth
   * saying every time, since the route on screen is genuinely incomplete. */
  const noteLinkOut = useCallback((truncated = 0) => {
    const parts: string[] = [];
    if (truncated > 0) {
      parts.push(
        `Only part of the day fits — ${truncated} stop${
          truncated === 1 ? '' : 's'
        } left out of the link.`,
      );
    }
    if (shouldHintLinkOut()) {
      markLinkOutHinted();
      parts.push('You can change which map app ↗ opens under Account.');
    }
    if (parts.length === 0) return;
    setNotice(parts.join(' '));
    window.setTimeout(() => setNotice(null), 8000);
  }, []);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
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
  // How wishlist pins draw on the map (WORK 18.11): photo thumbnails or the
  // kind's icon. A per-viewer display preference, not trip data — kept in
  // localStorage, defaulting to photos.
  const [wishlistPinMode, setWishlistPinMode] = useState<'photo' | 'icon'>(
    () => {
      try {
        return localStorage.getItem('etappe.wishlistPinMode') === 'icon'
          ? 'icon'
          : 'photo';
      } catch {
        return 'photo';
      }
    },
  );
  function toggleWishlistPinMode() {
    setWishlistPinMode((m) => {
      const next = m === 'photo' ? 'icon' : 'photo';
      try {
        localStorage.setItem('etappe.wishlistPinMode', next);
      } catch {
        /* private mode — the toggle still works for this session */
      }
      return next;
    });
  }
  // Phone only (WORK 17.2): the day detail can be folded down to its header
  // line so the map takes the freed height. Component-local, never
  // persisted; picking a day pill, Fit trip or adding a stop all reset it.
  const [dayCollapsed, setDayCollapsed] = useState(false);
  // Trip overview (WORK 17.6): Fit trip clears the day selection and both
  // panes switch to a whole-trip view — numbered day pins on the map, a day
  // list in the column. Picking any day pill, row or pin leaves it.
  const [tripOverview, setTripOverview] = useState(false);

  // Wishlist lives outside the cascade-oriented trip doc (it has no day/
  // order_index), so it gets its own small fetch rather than riding along
  // with useTripEditor's reload.
  /** Returns the fresh list too, for callers that must act on the item they
   * just changed (re-opening its card, say) rather than the stale copy. */
  useEffect(() => {
    if (!records || !user) return;
    let cancelled = false;
    listMembers(records.trip.id)
      .then((members) => {
        if (cancelled) return;
        const mine = members.find((m) => m.user === user.id);
        setIsOwner(mine?.role === 'owner');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [records?.trip.id, user]);

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

  // Open on today (WORK 10.1 / BUILD §6: "Mobile ... opens on today"). Phone
  // only, once, and only when nothing is selected yet — a returning session
  // that left off on a specific day keeps it. "Today" is read in the trip's
  // own timezone: at a trailhead in Iceland that is the date that matters,
  // not the browser's.
  const openedOnToday = useRef(false);
  useEffect(() => {
    if (openedOnToday.current || !phone || !records || selectedDayId) return;
    openedOnToday.current = true;
    const tz = records.trip.timezone || 'UTC';
    let localDate: string;
    try {
      localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(
        new Date(),
      );
    } catch {
      localDate = new Date().toISOString().slice(0, 10);
    }
    const start = records.trip.start_date.slice(0, 10);
    const todayDay = records.days.find(
      (d) => addDays(start, d.order_index) === localDate,
    );
    if (todayDay) setSelectedDayId(todayDay.id);
  }, [phone, records, selectedDayId]);

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

  /** True while offline — every write funnel below short-circuits through
   * this, so a lost signal pauses editing rather than throwing failed
   * requests at the user (WORK 10.3). Read-only navigation is unaffected. */
  function blockedOffline(): boolean {
    if (!offline) return false;
    setNotice('Offline — showing the last synced version. Editing is paused.');
    window.setTimeout(() => setNotice(null), 5000);
    return true;
  }

  async function run(fn: () => Promise<unknown>) {
    if (blockedOffline()) return;
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
    if (blockedOffline()) return;
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
    setTripOverview(false);
    setDayFolded(false);
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
    setTripOverview(false);
    setDayFolded(false);
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
    if (blockedOffline()) return;
    void deleteWishlistItem(pb, id).then(reloadWishlist);
  }

  // `★ Top choices` toggle (WORK 12.10). Persisted on the poi, then the
  // wishlist refetch re-runs MapPane's pin compositing so the gold badge
  // appears/clears. Not routed through `run()` — that reloads the cascade
  // trip doc, and starring touches neither stops nor legs.
  function toggleWishStar(item: PoisResponse, next: boolean) {
    if (blockedOffline()) return;
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

  /** Fold the phone day detail (WORK 17.2). Expanding it also dismisses the
   * wishlist carousel — the two never share the phone screen (WORK 17.3). */
  function setDayFolded(next: boolean) {
    setDayCollapsed(next);
    if (!next) setBrowsing(false);
  }

  /** Land on a specific day — from a pill, a day-list row or a day-start
   * pin. Always leaves the trip overview and unfolds the phone day detail
   * (WORK 17.6). */
  function selectDay(dayId: string) {
    setTripOverview(false);
    setSelectedDayId(dayId);
    setDayFolded(false);
  }

  /** Fit trip → trip overview (WORK 17.6): frame the whole trip, drop every
   * selection, and on phone hand the map the screen. */
  function enterTripOverview() {
    setTripOverview(true);
    closeCard();
    setSelectedStopIds(new Set());
    if (phone) setDayCollapsed(true);
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
    if (blockedOffline()) return;
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
      <div className="p-6 font-sans text-[13px] text-text-4">
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
    onAddBlock: (
      parentId: string,
      kind: BlockKind,
      parentType: 'stop' | 'poi' = 'stop',
      visibility: 'private' | 'trip' | 'public' = 'trip',
    ) =>
      run(() =>
        addBlock(
          pb,
          tripId,
          parentId,
          kind,
          blocksFor(records.blocks, parentType, parentId).length,
          parentType,
          visibility,
        ),
      ),
    onUpdateBlock: (blockId: string, patch: BlockPatch) =>
      run(() => updateBlock(pb, blockId, patch)),
    onDeleteBlock: (blockId: string) => run(() => deleteBlock(pb, blockId)),
    onMoveBlock: (
      parentId: string,
      blockId: string,
      dir: -1 | 1,
      parentType: 'stop' | 'poi' = 'stop',
    ) =>
      run(() =>
        moveBlock(
          pb,
          blocksFor(records.blocks, parentType, parentId),
          blockId,
          dir,
        ),
      ),
    onReorderBlock: (
      parentId: string,
      blockId: string,
      targetIndex: number,
      parentType: 'stop' | 'poi' = 'stop',
    ) =>
      run(() =>
        reorderBlock(
          pb,
          blocksFor(records.blocks, parentType, parentId),
          blockId,
          targetIndex,
        ),
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
        {days.length > 0 && (
          <TripDatePopover
            startDate={trip.start_date}
            dayCount={days.length}
            onChange={(date) => run(() => setTripStartDate(trip.id, date))}
          />
        )}
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
          <BudgetPopover
            costs={records.costs}
            stops={stops}
            pois={wishlist}
            tripCurrency={trip.currency}
          />
          {/* WORK 12.7: these are planning-desk actions — search-and-place,
              importing a list, configuring who a trip is shared with,
              exporting it — not things a phone companion view needs
              permanently on screen. Hiding them below 860px is also the fix
              for the header overflowing the viewport at phone widths (this
              group was the entire 130px of it, measured): four buttons in
              a row that never wrapped or shrank. The avatar (outside this
              group) is unaffected and was already the fix for the same
              friction with the trip title/email. */}
          <div className="hidden items-center gap-2 desktop:flex">
            <button
              onClick={() => setSettingsOpen(true)}
              title="Trip settings — buffer, surfaces, dwells, timezone, currency"
              aria-label="Trip settings"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-control text-[14px] text-text-2 hover:bg-control-hover"
            >
              ⚙
            </button>
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
                onClick={() => setShareOpen(true)}
                title="Share this trip with people, or publish a read-only link"
                className="h-[30px] rounded-lg bg-control px-3 text-[13px] text-text-2 hover:bg-control-hover"
              >
                Share
              </button>
              <button
                onClick={() => setPrintOpen(true)}
                title="A one-page-per-day printable itinerary"
                className="h-[30px] rounded-lg bg-control px-3 text-[13px] text-text-2 hover:bg-control-hover"
              >
                Print
              </button>
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
          </div>
          {/* The email never renders as text at any width — the fix for the
              known "phone width breaks the header first" friction. */}
          <button
            onClick={() => setAccountOpen(true)}
            title={`${user?.email ?? ''} — account settings`}
            aria-label="Account settings"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[oklch(0.32_0.03_250)] text-[13px] uppercase text-text hover:brightness-125"
          >
            {(user?.email ?? '?').slice(0, 1)}
          </button>
        </div>
      </header>

      {offline && (
        <p className="flex flex-none items-center gap-2 bg-warn-bg px-4 py-1 text-xs text-warn-text">
          <span className="h-[6px] w-[6px] flex-none rounded-full bg-warn-text" />
          Offline — read-only.{' '}
          {stale && savedAt
            ? `Showing the version synced ${relativeTime(savedAt)}.`
            : 'Showing the last synced version.'}{' '}
          Edits resume when you reconnect.
        </p>
      )}
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

      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[minmax(0,1fr)_400px]">
        <div
          className={`relative min-h-0 overflow-hidden border-b border-border desktop:flex-1 desktop:border-b-0 ${
            phone && dayCollapsed ? 'flex-1' : 'flex-none [flex:0_0_58%]'
          }`}
        >
          <MapPane
            records={records}
            result={result}
            onMapClick={onMapClick}
            onSelectStop={(id) => toggleSelect(id, false)}
            onHoverStop={setHoveredStopId}
            hoveredStopId={hoveredStopId}
            focusDayId={tripOverview ? null : selectedDayId}
            overview={tripOverview}
            selectedStop={selectedStop}
            onDragStop={dragStop}
            onDragAccessPoint={dragAccessPoint}
            onSelectNearby={selectNearby}
            wishlist={wishlist}
            onSelectWishlist={(item) => openCard(() => setWishCard(item))}
            flyTo={flyTo}
            selectedWishlistId={wishCard?.id ?? null}
            hoveredWishlistId={hoveredWishId}
            wishlistPinMode={wishlistPinMode}
            onSelectDay={selectDay}
            onFitTrip={enterTripOverview}
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
          {!cardOpen && !picking && !browsing && !phone && (
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
                pinMode={wishlistPinMode}
                onTogglePinMode={toggleWishlistPinMode}
              />
            </div>
          )}

          {/* Phone-only entry to the carousel (WORK 17.3): reachable only
              once the day detail is folded away — browsing places is a map
              activity, so it is offered exactly when the map has the
              screen. Hidden the moment anything else claims the bottom
              slot. */}
          {phone &&
            dayCollapsed &&
            !cardOpen &&
            !browsing &&
            !picking &&
            !placingWish &&
            wishlist.length > 0 && (
              <button
                onClick={openBrowsing}
                className="absolute bottom-2 left-2 z-20 flex h-[38px] items-center gap-1.5 rounded-[19px] border border-[oklch(0.34_0.012_250)] bg-[oklch(0.20_0.013_250/0.92)] px-3.5 text-[12.5px] text-text-2 backdrop-blur-[10px]"
              >
                <span className="text-wishlist">★</span>
                <span className="whitespace-nowrap">
                  Explore {wishlist.length}{' '}
                  {wishlist.length === 1 ? 'place' : 'places'}
                </span>
              </button>
            )}

          {browsing && !cardOpen && !picking && (!phone || dayCollapsed) && (
            <WishlistCarousel
              items={wishlist}
              order={wishChain}
              blocks={records.blocks}
              phone={phone}
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
          {cardTarget && !picking && (
            <PinCard
              phone={phone}
              linkOut={linkOut}
              onLinkOut={() => noteLinkOut()}
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
              onMoveStop={
                cardTarget.type === 'stop'
                  ? (dir) => doMoveSelected(dir)
                  : undefined
              }
              canMoveUp={cardTarget.type === 'stop' && cardTarget.seq > 1}
              canMoveDown={
                cardTarget.type === 'stop' && cardTarget.seq < cardTarget.total
              }
              onOpenDetails={() => setExpanded(true)}
              onRemove={() => {
                if (cardTarget.type === 'stop')
                  deleteOneStop(cardTarget.stop.id);
                closeCard();
              }}
              onDowngrade={() => {
                if (cardTarget.type === 'stop')
                  downgradeStop(cardTarget.stop.id);
                closeCard();
              }}
              onAddToItinerary={() => {
                if (cardTarget.type === 'wish')
                  placeWishlistItem(cardTarget.item);
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
                if (cardTarget.type === 'wish')
                  deleteWishlist(cardTarget.item.id);
                closeCard();
              }}
              onAddWishlist={() => {
                if (cardTarget.type === 'empty') {
                  commitWishlistPick(
                    {
                      name: cardTarget.place?.name ?? 'Dropped pin',
                      kind: cardTarget.place?.kind ?? 'uncategorized',
                      lat: cardTarget.lat,
                      lon: cardTarget.lon,
                    },
                    cardTarget.sourceUrl,
                  );
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
                    sourceUrl: cardTarget.sourceUrl,
                  });
                }
                setEmptyCard(null);
                setEditing(false);
              }}
              onUpdateStop={(patch) => {
                if (cardTarget.type === 'wish') {
                  const id = cardTarget.item.id;
                  void run(async () => {
                    await updatePoi(pb, id, patch);
                    await reloadWishlist();
                  });
                  return;
                }
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
                else if (cardTarget.type === 'wish')
                  blockHandlers.onAddBlock(cardTarget.item.id, kind, 'poi');
              }}
              costs={
                cardTarget.type === 'stop'
                  ? costsFor(records.costs, 'stop', cardTarget.stop.id)
                  : cardTarget.type === 'wish'
                    ? costsFor(records.costs, 'poi', cardTarget.item.id)
                    : []
              }
              onChangeCost={(amount, currency) => {
                const parent =
                  cardTarget.type === 'stop'
                    ? ({ type: 'stop', id: cardTarget.stop.id } as const)
                    : cardTarget.type === 'wish'
                      ? ({ type: 'poi', id: cardTarget.item.id } as const)
                      : null;
                if (!parent) return;
                const existing =
                  cardTarget.type === 'stop'
                    ? costsFor(records.costs, 'stop', cardTarget.stop.id)[0]
                    : cardTarget.type === 'wish'
                      ? costsFor(records.costs, 'poi', cardTarget.item.id)[0]
                      : undefined;
                void run(() =>
                  setSingleCost(
                    pb,
                    tripId,
                    parent,
                    existing?.id ?? null,
                    amount,
                    currency,
                  ),
                );
              }}
              onAddPrivateNote={() => {
                if (cardTarget.type === 'stop')
                  blockHandlers.onAddBlock(
                    cardTarget.stop.id,
                    'note',
                    'stop',
                    'private',
                  );
                else if (cardTarget.type === 'wish')
                  blockHandlers.onAddBlock(
                    cardTarget.item.id,
                    'note',
                    'poi',
                    'private',
                  );
              }}
              openKindPickerSignal={kindPickerSignal}
            />
          )}
        </div>

        <aside
          className={`min-h-0 border-border desktop:flex-1 desktop:border-l ${
            phone && dayCollapsed ? 'flex-none' : 'flex-1'
          }`}
        >
          <Timeline
            trip={trip}
            day={activeDay}
            dayIndex={activeDayIndex}
            days={days}
            overview={tripOverview}
            onSelectDay={selectDay}
            onStepDay={
              phone
                ? (dir) => {
                    const next = days[activeDayIndex + dir];
                    if (next) selectDay(next.id);
                  }
                : undefined
            }
            collapsed={phone && dayCollapsed}
            onToggleCollapse={
              phone ? () => setDayFolded(!dayCollapsed) : undefined
            }
            stops={stops}
            legs={legs}
            blocks={records.blocks}
            costs={records.costs}
            result={result}
            selectedStopIds={selectedStopIds}
            onSelectStop={toggleSelect}
            scrollToStopId={
              selectedStopIds.size === 1 ? [...selectedStopIds][0]! : null
            }
            hoveredStopId={hoveredStopId}
            onHoverStop={setHoveredStopId}
            linkOut={linkOut}
            onLinkOut={noteLinkOut}
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
            if (mode === 'wishlist') {
              commitWishlistPick(place, sourceUrl);
              return;
            }
            // Placement mode (WORK 18.10): a search result opens the
            // unified card first — the same "look before you commit" the
            // rest of the app follows — rather than dropping straight into
            // the ranked placement picker. The card's "+ Day" runs that
            // placement; "+ Wishlist" saves it as an idea. A pasted Maps
            // link rides along so either action can still keep it.
            openCard(() =>
              setEmptyCard({
                lat: place.lat,
                lon: place.lon,
                place,
                identifying: false,
                sourceUrl,
              }),
            );
            setFlyTo({ lat: place.lat, lon: place.lon, nonce: Date.now() });
          }}
          wishlist={wishlist}
          // Picking a saved idea (WORK 18.9) always opens its card — from
          // "+ Idea" and from Search alike (WORK 18.10). Its "Add to
          // itinerary" button runs the ranked placement, so the promotion
          // still happens, just after a look rather than before it.
          onPickWishlist={(item) => {
            setSearchMode(null);
            setShareQuery(null);
            showWishlistItem(item);
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
          // Wishlist and itinerary alike: since WORK 14 a poi is a stop
          // without a day, so an idea already placed on day three is still
          // the same place an import is about to add again.
          existing={[
            ...wishlist.map((p) => ({
              id: p.id,
              kind: 'poi' as const,
              title: p.title,
              placeKind: p.kind,
              lat: p.lat,
              lon: p.lon,
              where: 'on the wishlist',
            })),
            ...stops.map((st) => ({
              id: st.id,
              kind: 'stop' as const,
              title: st.title,
              placeKind: st.kind,
              lat: st.lat,
              lon: st.lon,
              where: `on day ${days.findIndex((d) => d.id === st.day) + 1}`,
            })),
          ]}
          blocks={records.blocks}
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
      {shareOpen && records && user && (
        <SharePanel
          trip={records.trip}
          currentUserId={user.id}
          isOwner={isOwner}
          publicBlockCount={
            records.blocks.filter((b) => b.visibility === 'public').length
          }
          onClose={() => setShareOpen(false)}
          onChanged={() => void reload()}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          trip={trip}
          onClose={() => setSettingsOpen(false)}
          onSave={(patch) => run(() => updateTripSettings(tripId, patch))}
        />
      )}
      {accountOpen && (
        <AccountPanel
          email={user?.email ?? ''}
          onClose={() => setAccountOpen(false)}
          onSignOut={() => {
            onBack();
            logout();
          }}
          // Switching engines invalidates every stored leg: the durations
          // on record are the old engine's, and route_cache keys on the
          // backend so nothing stale is reused (WORK 19.3).
          onEngineChanged={async () => {
            if (!records) return;
            setNotice('Re-routing this trip with the new engine…');
            const { rerouted, failed } = await rerouteAllLegs(
              pb,
              createPocketBaseRouting(pb, tripId),
              records,
              (done, total) => setNotice(`Re-routing legs — ${done}/${total}…`),
            );
            await reload();
            setNotice(
              `Re-routed ${rerouted} leg${rerouted === 1 ? '' : 's'}` +
                (failed ? `, ${failed} could not be routed` : '') +
                '.',
            );
            window.setTimeout(() => setNotice(null), 6000);
          }}
        />
      )}
      {printOpen && (
        <PrintView
          trip={trip}
          days={days}
          stops={stops}
          legs={legs}
          blocks={records.blocks}
          result={result}
          allowPrivate
          onClose={() => setPrintOpen(false)}
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
      {expanded && !picking && cardTarget?.type === 'wish' && (
        <PinCardExpanded
          stop={cardTarget.item}
          isWish
          blocks={blocksFor(records.blocks, 'poi', cardTarget.item.id)}
          days={days}
          tripStartDate={trip.start_date}
          onEditTiming={() => {}}
          daylight={null}
          onClose={() => setExpanded(false)}
          onUpdate={(patch) => {
            const id = cardTarget.item.id;
            void run(async () => {
              await updatePoi(pb, id, patch);
              await reloadWishlist();
            });
          }}
          onPlaceAccessPoint={() => {}}
          onClearAccessPoint={() => {}}
          onMoveToDay={() => {}}
          onRemove={() => {
            deleteWishlist(cardTarget.item.id);
            setExpanded(false);
          }}
          onDowngrade={() => {}}
          onAddBlock={(kind) =>
            blockHandlers.onAddBlock(cardTarget.item.id, kind, 'poi')
          }
          onAddPrivateNote={() =>
            blockHandlers.onAddBlock(
              cardTarget.item.id,
              'note',
              'poi',
              'private',
            )
          }
          onUpdateBlock={blockHandlers.onUpdateBlock}
          onDeleteBlock={blockHandlers.onDeleteBlock}
          onMoveBlock={(blockId, dir) =>
            blockHandlers.onMoveBlock(cardTarget.item.id, blockId, dir, 'poi')
          }
          onReorderBlock={(blockId, index) =>
            blockHandlers.onReorderBlock(
              cardTarget.item.id,
              blockId,
              index,
              'poi',
            )
          }
          onUploadBlockFile={blockHandlers.onUploadBlockFile}
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
          onAddPrivateNote={() =>
            blockHandlers.onAddBlock(
              cardTarget.stop.id,
              'note',
              'stop',
              'private',
            )
          }
          onUpdateBlock={blockHandlers.onUpdateBlock}
          onDeleteBlock={blockHandlers.onDeleteBlock}
          onMoveBlock={(blockId, dir) =>
            blockHandlers.onMoveBlock(cardTarget.stop.id, blockId, dir)
          }
          onReorderBlock={(blockId, index) =>
            blockHandlers.onReorderBlock(cardTarget.stop.id, blockId, index)
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
