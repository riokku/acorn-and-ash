import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Where `pnpm dev:web` serves the API and the world server. */
const LOCAL_WORKER = 'http://localhost:8787';

// The repo's one shared copy of every model and texture, tracked alongside
// its licence row in assets/LICENSES.csv rather than duplicated into the
// client. See docs/decisions on the first art pass.
const ASSETS_DIR = fileURLToPath(new URL('../../assets', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@assets': ASSETS_DIR },
  },
  server: {
    // Talk to the local Worker as though it were the same origin, which is how
    // it works once the client is served by apps/web.
    proxy: {
      '/api': { target: LOCAL_WORKER, changeOrigin: true, ws: true },
    },
    // Allow serving assets/ during `pnpm dev`, since it lives outside this
    // package but inside the workspace.
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
  },
  build: {
    outDir: 'dist',
    // Static assets are limited to 25 MiB per file on Workers. Shout well before
    // we get anywhere near that.
    chunkSizeWarningLimit: 2048,
    sourcemap: true,
  },
});
