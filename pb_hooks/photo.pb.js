/// <reference path="../pb_data/types.d.ts" />

// Server-side photo fetch (WORK 12.8). POST /api/photo-fetch with
// { blockId } downloads that photo block's external `url` and stores it as
// the block's `file`, so the app owns the bytes instead of hotlinking.
//
// Why this can't live in the browser: an imported photo is a plain URL on
// someone else's webserver, and those hosts routinely send no CORS header
// (the Highlights source that prompted this, roads-and-rivers.com, sends
// none). Without CORS the browser may *display* the image but may neither
// fetch its bytes nor read them back off a canvas — which is exactly what
// building a map pin's thumbnail needs, so wishlist pins fell back to a
// flat category colour. Server-side there is no such restriction.
//
// Storing the file also buys the PocketBase thumbnails the pin actually
// wants (an 80x80 crop rather than a 300 KB full-size JPEG) and stops the
// trip depending on a third party still hosting those images next year.
//
// Idempotent: a block that already has a file is returned untouched, so
// re-running over an imported set is safe.

routerAdd(
  'POST',
  '/api/photo-fetch',
  (e) => {
    const auth = e.auth;
    if (!auth) return e.json(401, { message: 'Not signed in.' });

    const body = e.requestInfo().body;
    const blockId = body.blockId;
    if (!blockId || typeof blockId !== 'string') {
      return e.json(400, { message: 'Expected { blockId }.' });
    }

    let block;
    try {
      block = e.app.findRecordById('blocks', blockId);
    } catch (_) {
      return e.json(404, { message: 'No such block.' });
    }

    if (block.get('kind') !== 'photo') {
      return e.json(400, { message: 'Not a photo block.' });
    }

    // Writable only by a member of the block's trip. Mirrors the collection
    // API rules rather than trusting the caller: this endpoint writes a file
    // onto a record the caller named.
    let member = null;
    try {
      member = e.app.findFirstRecordByFilter(
        'trip_members',
        'trip = {:trip} && user = {:user}',
        { trip: block.get('trip'), user: auth.id },
      );
    } catch (_) {
      member = null;
    }
    if (!member || member.get('role') === 'viewer') {
      return e.json(403, { message: 'Not allowed to edit this trip.' });
    }

    if (block.get('file')) {
      return e.json(200, { fetched: false, reason: 'already stored' });
    }

    const url = block.get('url');
    if (!url) {
      return e.json(200, { fetched: false, reason: 'no url' });
    }

    // A dead link, a hotlink block, or an HTML error page dressed as an
    // image are all normal outcomes for third-party URLs — report them as a
    // non-fetch rather than a server error, so one bad photo never fails an
    // import of thirty.
    let file;
    try {
      file = $filesystem.fileFromURL(url, 20);
    } catch (err) {
      return e.json(200, { fetched: false, reason: String(err) });
    }

    try {
      block.set('file', file);
      e.app.save(block);
    } catch (err) {
      return e.json(200, { fetched: false, reason: String(err) });
    }

    return e.json(200, { fetched: true });
  },
  $apis.requireAuth(),
);
