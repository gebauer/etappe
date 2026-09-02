/**
 * The ready-made prompt for the full trip import screen (BUILD §8.1: "ship
 * the schema and a prompt template ... so the text you paste into an LLM
 * reliably produces something that validates"). This is the format
 * `parseTripDoc` reads and `exportTrip` writes — the last piece 8.1 called
 * still open once 16.3 built the schema and the export half.
 *
 * The app never calls an LLM itself (CLAUDE.md rule 1) — the user pastes
 * this into their own chat, gets a day-by-day plan back, and imports it as
 * a brand-new trip.
 */

export const TRIP_PROMPT_TEMPLATE = `I'm planning a multi-day trip and want a day-by-day itinerary, not just \
a shortlist of places. Group stops into days, in the order I'd actually \
visit them, and estimate a sensible dwell time at each one.

Reply with ONLY a JSON object in exactly this shape — no other text:

{
  "version": 1,
  "title": "Short trip name",
  "start_date": "YYYY-MM-DD",
  "timezone": "IANA timezone, e.g. Atlantic/Reykjavik",
  "days": [
    {
      "index": 1,
      "title": "Short label for the day, e.g. \\"KEF to Skálholt\\"",
      "kind": "travel",
      "stops": [
        {
          "title": "Name of the place",
          "kind": "waterfall",
          "place_hint": "Full name + region, for geocoding",
          "lat": 64.3271,
          "lon": -19.9152,
          "dwell_min": 60,
          "is_accommodation": false,
          "notes": "A sentence or two on why it's worth the stop.",
          "links": [
            { "url": "https://...", "title": "Official page" }
          ]
        }
      ],
      "legs": [
        { "from": 0, "to": 1, "mode": "car" }
      ]
    }
  ]
}

Rules:
- "index" starts at 1 and must be consecutive across all days.
- "kind" (the day's) is "travel" or "rest".
- Each stop's "kind" must be one of: waterfall, canyon, glacier, hot_spring, \
volcano, cave, lake, coast, viewpoint, hike, museum, monument, church, \
town, restaurant, hotel, campsite, airport, ferry, fuel, shop, pool, \
wildlife, parking, other, uncategorized. Pick the closest match.
- "lat"/"lon" are optional, but include them whenever you're confident in \
the exact coordinates. Omit both if you're not sure — they'll then be \
geocoded from "place_hint" on import, which is coarser and can miss.
- Mark exactly the stop where each day ends for the night as \
"is_accommodation": true (a hotel, campsite, or similar) — this drives the \
next day's starting point and clears a warning if left unmarked.
- "anchor_time" (HH:MM) and "anchor_type" ("arrival" or "departure") are \
optional — only include them for a stop with a real fixed time (a flight, \
a booked tour), not a guess.
- "legs" connects consecutive stops within a day by their position (0-based) \
in that day's "stops" array. "mode" is one of: car, walk, ferry, flight, \
bike, other. Durations are computed on import from real routing for car \
legs — never invent a duration.
- If a stop forces a detour without being worth stopping at — a mountain \
pass, a specific junction — you can mark it "routing_kind": "waypoint" \
instead of a real stop; it will not get any dwell time.
- "links" is optional per stop — omit it entirely for a stop with none, \
don't invent URLs.
- Leave out "activities" — that's for me to fill in myself after importing.

Destination and rough length: <fill in here>`;
