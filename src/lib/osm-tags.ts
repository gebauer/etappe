import type { Kind } from './taxonomy';

/**
 * Deterministic OSM tag → stop kind mapping (BUILD §7). Photon and Overpass
 * return raw OSM tags; this resolves them to a taxonomy kind. The caller marks
 * such matches `kind_confirmed = false`. Unknown tags return null, which the
 * caller stores as `uncategorized`.
 *
 * Rules are evaluated top to bottom and the first match wins, so specific tags
 * precede generic ones. A rule with no `value` matches any value for that key
 * (e.g. any `shop=*` is a shop).
 */

type Rule = { key: string; value?: string; kind: Kind };

const RULES: readonly Rule[] = [
  // Water, ice, and landform
  { key: 'waterway', value: 'waterfall', kind: 'waterfall' },
  { key: 'natural', value: 'waterfall', kind: 'waterfall' },
  { key: 'natural', value: 'glacier', kind: 'glacier' },
  { key: 'natural', value: 'hot_spring', kind: 'hot_spring' },
  { key: 'natural', value: 'geyser', kind: 'hot_spring' },
  { key: 'natural', value: 'volcano', kind: 'volcano' },
  { key: 'natural', value: 'cave_entrance', kind: 'cave' },
  { key: 'natural', value: 'beach', kind: 'coast' },
  { key: 'natural', value: 'bay', kind: 'coast' },
  { key: 'natural', value: 'cape', kind: 'coast' },
  { key: 'natural', value: 'water', kind: 'lake' },
  { key: 'water', value: 'lake', kind: 'lake' },
  { key: 'natural', value: 'peak', kind: 'viewpoint' },

  // Tourism and culture
  { key: 'tourism', value: 'viewpoint', kind: 'viewpoint' },
  { key: 'tourism', value: 'museum', kind: 'museum' },
  { key: 'tourism', value: 'hotel', kind: 'hotel' },
  { key: 'tourism', value: 'hostel', kind: 'hotel' },
  { key: 'tourism', value: 'guest_house', kind: 'hotel' },
  { key: 'tourism', value: 'motel', kind: 'hotel' },
  { key: 'tourism', value: 'camp_site', kind: 'campsite' },
  { key: 'tourism', value: 'zoo', kind: 'wildlife' },
  { key: 'historic', value: 'monument', kind: 'monument' },
  { key: 'historic', value: 'memorial', kind: 'monument' },
  { key: 'historic', value: 'archaeological_site', kind: 'monument' },
  { key: 'historic', value: 'castle', kind: 'monument' },
  { key: 'historic', value: 'ruins', kind: 'monument' },

  // Amenities
  { key: 'amenity', value: 'place_of_worship', kind: 'church' },
  { key: 'amenity', value: 'restaurant', kind: 'restaurant' },
  { key: 'amenity', value: 'cafe', kind: 'restaurant' },
  { key: 'amenity', value: 'fast_food', kind: 'restaurant' },
  { key: 'amenity', value: 'fuel', kind: 'fuel' },
  { key: 'amenity', value: 'parking', kind: 'parking' },
  { key: 'amenity', value: 'ferry_terminal', kind: 'ferry' },

  // Leisure
  { key: 'leisure', value: 'swimming_pool', kind: 'pool' },
  { key: 'leisure', value: 'nature_reserve', kind: 'wildlife' },

  // Transport
  { key: 'aeroway', value: 'aerodrome', kind: 'airport' },
  { key: 'aeroway', value: 'terminal', kind: 'airport' },

  // Places
  { key: 'place', value: 'city', kind: 'town' },
  { key: 'place', value: 'town', kind: 'town' },
  { key: 'place', value: 'village', kind: 'town' },
  { key: 'place', value: 'hamlet', kind: 'town' },

  // Trails
  { key: 'highway', value: 'trailhead', kind: 'hike' },
  { key: 'information', value: 'trailhead', kind: 'hike' },

  // Any shop — kept last so more specific rules win first
  { key: 'shop', kind: 'shop' },
];

export function mapOsmTags(
  tags: Readonly<Record<string, string>>,
): Kind | null {
  for (const rule of RULES) {
    const actual = tags[rule.key];
    if (actual === undefined) continue;
    if (rule.value === undefined || rule.value === actual) return rule.kind;
  }
  return null;
}
