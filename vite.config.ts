/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
