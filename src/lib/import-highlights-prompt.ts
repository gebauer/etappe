/**
 * The ready-made prompt shown on the Highlights import screen (BUILD §8's
 * "ship the schema and a prompt template... so the text you paste into an
 * LLM reliably produces something that validates", applied to the lighter
 * Highlights format in import-highlights.ts). The app never calls an LLM
 * itself — the user pastes this into their own chat and imports the result.
 */

export const HIGHLIGHTS_PROMPT_TEMPLATE = `I'm planning a trip and want a shortlist of highlights — interesting \
places, not a day-by-day itinerary. For each one, give me a short \
description of what it is, and (if you can find one) a couple of photo \
URLs with attribution.

Reply with ONLY a JSON object in exactly this shape — no other text:

{
  "version": 1,
  "highlights": [
    {
      "title": "Short name of the place",
      "kind": "waterfall",
      "place_hint": "Full name + region, for geocoding",
      "lat": 64.3271,
      "lon": -19.9152,
      "description": "A paragraph on what makes it worth visiting.",
      "links": [
        { "url": "https://...", "title": "Official page / more info" }
      ],
      "photos": [
        {
          "url": "https://... (a direct image URL)",
          "title": "Caption",
          "author": "Photographer or site name, if known",
          "licence": "e.g. CC BY-SA 4.0, if known",
          "source_url": "https://... (page the photo came from)"
        }
      ]
    }
  ]
}

Rules:
- "kind" must be one of: waterfall, canyon, glacier, hot_spring, volcano, \
cave, lake, coast, viewpoint, hike, museum, monument, church, town, \
restaurant, hotel, campsite, airport, ferry, fuel, shop, pool, wildlife, \
parking, other, uncategorized. Pick the closest match.
- "lat"/"lon" are optional, but include them whenever you're confident in \
the exact coordinates (you usually know these better than a geocoder does, \
especially for specific trailheads, viewpoints or landmarks vs. a whole \
town). Omit both if you're not sure — they'll then be geocoded from \
"place_hint" on import, which is coarser.
- "links" and "photos" are optional arrays — omit them entirely for a \
highlight with none, don't invent URLs.
- Leave out "notes" — that's for me to fill in myself after importing.

Destination: <fill in your destination here>`;
