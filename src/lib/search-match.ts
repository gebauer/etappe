import { TAXONOMY, type Kind } from './taxonomy';

/** A kind's display label, falling back to the raw value for anything the
 * taxonomy doesn't know. */
export function kindLabel(kind: string | undefined): string {
  return TAXONOMY[kind as Kind]?.label ?? kind ?? 'uncategorized';
}

export interface SearchableItem {
  title: string;
  kind?: string;
}

/**
 * The palette's local matcher: title first, then the kind's label, so
 * "waterfall" finds every waterfall whatever it is called. Case- and
 * position-insensitive substring matching — a name typed from memory is
 * rarely typed from its first letter.
 *
 * Shared by the wishlist and itinerary sections so the two cannot drift
 * into matching differently on the same query.
 */
export function matchByNameOrKind<T extends SearchableItem>(
  items: T[],
  query: string,
  limit: number,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return items
    .filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        kindLabel(item.kind).toLowerCase().includes(needle),
    )
    .slice(0, limit);
}
