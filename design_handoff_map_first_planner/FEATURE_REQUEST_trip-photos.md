# Feature request: sign-in photos from the user's own finished trips

**Status:** requested, not designed. The sign-in redesign ships against a supplied server folder (`photos.json`); this replaces that source later without changing the sign-in layout.

## What

After a trip ends, let the user mark photos they upload to that trip as usable on their sign-in screen. The sign-in then draws from their own trips instead of a curated folder — the screen that is meant to produce Fernweh shows a place they have actually been, captioned with the trip that took them there.

## Why

The curated folder works and is the right first step, but it is generic: the same eight photographs for every account. A user's own Tunnel View, captioned `Day 4 · Yosemite · July 2025`, does the job the curated photo is imitating. It also gives finished trips a reason to be revisited, which today they have none.

## Behaviour

1. **Marking.** On a photo block in a stop of a *past* trip, a control — `Use on my sign-in` — sets a boolean on that photo. Off by default, always. Nothing a user uploads is used decoratively without an explicit opt-in.
2. **Where it can be set.** Only on trips whose last day is in the past. Marking photos mid-trip invites accidental sharing of a place the user is currently at.
3. **Caption is derived, not typed.** The sign-in caption comes from the photo's own stop: place name, day number, trip month. Same field-presence rule as the manifest — render what exists, never a placeholder. The photo's block caption, if any, is ignored: it was written for the itinerary, not for this.
4. **Selection.** One marked photo per sign-in visit, chosen at random from the account's marked set. Same 7 s crossfade and rotation ticks as the folder version.
5. **Fallback.** Fewer than three marked photos, or a brand-new account, falls back to the curated folder. The sign-in must never render an empty or half-populated rotation.
6. **Revocation.** Unmarking removes the photo from the rotation immediately, and `Use none of my photos` in account settings clears every flag at once.

## Open questions

- **Sharing.** Trips are collaborative. Does a photo Julia marks appear on Jan's sign-in? Default answer: no — the flag is per-user, per-photo, and only ever affects the sign-in of the person who set it. Anything else needs consent from the uploader.
- **Storage.** The sign-in is pre-auth, so the photo cannot be fetched from the authenticated trip record. Either the marked photos are copied to a public bucket at marking time (and deleted on unmark), or the sign-in resolves the rotation only *after* the email field identifies an account, which changes the load sequence. The first is simpler and is the recommendation.
- **Moderation.** Public-bucket copies of user photos need a takedown path. Out of scope for the folder approach; unavoidable here.
- **Size.** Marked photos need a wide derivative (2400px) generated at marking time; phone camera originals are too heavy for a pre-auth screen.

## Not part of this

Editing captions, choosing which photo appears, ordering the rotation, or any per-photo sign-in preview. If those turn out to be wanted, they are a follow-up.
