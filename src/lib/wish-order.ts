import { haversineMeters } from './geo';

export interface ChainPoint {
  id: string;
  lat: number;
  lon: number;
}

/**
 * Orders wishlist entries into a nearest-neighbour chain for the card's
 * `‹`/`›` browsing (design handoff, "Wishlist browsing").
 *
 * The chain is built once from a fixed anchor — the first entry — and cached
 * by the caller. It must never be rebuilt from whichever pin is currently
 * selected: doing that makes `‹` and `›` disagree about what comes next and
 * the sequence never settles.
 *
 * Greedy, not optimal: from the anchor, repeatedly append the nearest entry
 * not already in the chain. Distance is great-circle, so it stays honest at
 * the latitudes this app is actually used at — planar distance would order
 * an Icelandic trip visibly wrong.
 */
export function buildProximityChain(points: ChainPoint[]): string[] {
  if (points.length === 0) return [];

  const remaining = points.slice(1);
  const chain: ChainPoint[] = [points[0]!];

  while (remaining.length > 0) {
    const current = chain[chain.length - 1]!;
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineMeters(current, remaining[i]!);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    chain.push(remaining.splice(bestIndex, 1)[0]!);
  }

  return chain.map((point) => point.id);
}

/** Steps through an ordered id list, wrapping at both ends. */
export function stepInChain(
  chain: string[],
  currentId: string,
  direction: -1 | 1,
): string | null {
  if (chain.length === 0) return null;
  const index = chain.indexOf(currentId);
  if (index === -1) return chain[0]!;
  const next = (index + direction + chain.length) % chain.length;
  return chain[next]!;
}
