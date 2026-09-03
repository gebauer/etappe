/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite tags the entry `<script>`/`<link>` with `crossorigin`, which forces
 * a CORS-mode fetch for them. The app is served same-origin (PocketBase
 * from `pb_public`), so CORS buys nothing — and a CORS-mode subresource
 * load does not reliably resolve against a Cache API entry when the service
 * worker (WORK 10.3) is serving the shell offline. Dropping the attribute
 * keeps those as plain same-origin loads the worker can satisfy.
 */
function noCrossorigin(): Plugin {
  return {
    name: 'no-crossorigin',
    enforce: 'post',
    transformIndexHtml: (html) => html.replace(/\s+crossorigin\b/g, ''),
  };
}

export default defineConfig({
  plugins: [react(), noCrossorigin()],
  server: {
    // Proxy the PocketBase API and admin UI so the SPA runs same-origin in dev
    // (no CORS). Run `npm run pb` alongside `npm run dev`.
    proxy: {
      '/api': 'http://127.0.0.1:8090',
      '/_': 'http://127.0.0.1:8090',
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
