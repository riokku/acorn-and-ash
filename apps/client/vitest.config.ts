import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The same alias the game's own build uses (see vite.config.ts), so a test
  // can build a model that loads part of itself from assets/, like the
  // flower bed's blooms.
  resolve: {
    alias: { '@assets': fileURLToPath(new URL('../../assets', import.meta.url)) },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
