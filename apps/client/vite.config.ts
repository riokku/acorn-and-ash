import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Where `pnpm dev:web` serves the API and the world server. */
const LOCAL_WORKER = 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    // Talk to the local Worker as though it were the same origin, which is how
    // it works once the client is served by apps/web.
    proxy: {
      '/api': { target: LOCAL_WORKER, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    // Static assets are limited to 25 MiB per file on Workers. Shout well before
    // we get anywhere near that.
    chunkSizeWarningLimit: 2048,
    sourcemap: true,
  },
});
