/// <reference path="../pb_data/types.d.ts" />

// Short-link resolver (WORK 6.2). Google "maps.app.goo.gl" short links are
// CORS-blocked in the browser, so the client asks the server to resolve them.
// We follow the redirect (Go's http client follows by default) and scan the
// final response for coordinates. Best-effort: returns {lat,lon} or nulls.

routerAdd(
  'POST',
  '/api/resolve-link',
  (e) => {
    const url = e.requestInfo().body.url;
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return e.json(400, { message: 'A url is required.' });
    }

    let res;
    try {
      res = $http.send({ url: url, method: 'GET', timeout: 15 });
    } catch (err) {
      return e.json(502, { message: 'Could not resolve link: ' + String(err) });
    }

    const body = res.raw || '';
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /[?&](?:q|ll|center|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /\/(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];
    for (let i = 0; i < patterns.length; i++) {
      const m = patterns[i].exec(body);
      if (m) {
        const lat = Number(m[1]);
        const lon = Number(m[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return e.json(200, { lat: lat, lon: lon });
        }
      }
    }
    return e.json(200, { lat: null, lon: null });
  },
  $apis.requireAuth(),
);
