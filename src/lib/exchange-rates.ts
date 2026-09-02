/**
 * Exchange rates for the budget popover (WORK 16.10) — fetched from a free,
 * keyless rate server and cached for roughly a month, per the author's own
 * framing ("average conversion rates... monthly average or so", 2026-09-02):
 * not a live spot rate that moves on every reload, and not a true
 * statistically-averaged rate either (no free source offers that cleanly)
 * — a snapshot that stays fixed for about a month, which is close enough to
 * both and simple.
 *
 * Called directly from the browser, no key, no hook — same reasoning as
 * `photon.ts`: there is no secret to hide server-side (unlike ORS, whose
 * key stays in the PocketBase hook per CLAUDE.md rule 4). The cache lives
 * in `localStorage`, not PocketBase: the underlying stored fact is each
 * cost's own {amount, currency} (already durable, shared, in `costs`), and
 * the *converted* total is explicitly allowed to drift a little between
 * viewers or reloads as the cached rate refreshes — there is nothing here
 * that needs to be identical across every device looking at the same trip
 * at the same moment.
 */

import type { CurrencyCode, ExchangeRates } from './currency';

const RATE_URL = 'https://open.er-api.com/v6/latest/';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // ~monthly, per the author's framing
const CACHE_PREFIX = 'etappe:fx:';

interface CachedRates {
  fetchedAt: number;
  rates: ExchangeRates;
}

function readCache(base: CurrencyCode): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + base);
    if (!raw) return null;
    return JSON.parse(raw) as CachedRates;
  } catch {
    return null; // corrupt entry, a private window, storage disabled — refetch
  }
}

function writeCache(base: CurrencyCode, rates: ExchangeRates): void {
  try {
    const entry: CachedRates = { fetchedAt: Date.now(), rates };
    localStorage.setItem(CACHE_PREFIX + base, JSON.stringify(entry));
  } catch {
    // Storage full or disabled — the rate still works for this session,
    // it just won't survive a reload. Not worth surfacing as an error.
  }
}

async function fetchRates(base: CurrencyCode): Promise<ExchangeRates> {
  const res = await fetch(`${RATE_URL}${base}`);
  if (!res.ok) throw new Error(`Exchange rate lookup failed (${res.status})`);
  const data = (await res.json()) as { result?: string; rates?: unknown };
  if (data.result !== 'success' || typeof data.rates !== 'object') {
    throw new Error('Exchange rate response was not usable.');
  }
  return { base, rates: data.rates as ExchangeRates['rates'] };
}

/**
 * Rates with `base`, refreshing the cache only when it is missing or
 * older than `MAX_AGE_MS`. Throws only when there is neither a usable
 * cache nor a working fetch — the caller (a hook) is expected to catch
 * this and show the budget as unavailable rather than wrong.
 */
export async function getExchangeRates(
  base: CurrencyCode,
): Promise<ExchangeRates> {
  const cached = readCache(base);
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) {
    return cached.rates;
  }
  try {
    const fresh = await fetchRates(base);
    writeCache(base, fresh);
    return fresh;
  } catch (err) {
    // Offline, or the free server is down: a stale cache is still a better
    // budget total than none, however old, since it stays clearly labelled
    // as an estimate throughout this feature.
    if (cached) return cached.rates;
    throw err;
  }
}
