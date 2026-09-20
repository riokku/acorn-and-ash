import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * Tests for the World Durable Object run inside workerd, the same runtime
 * Cloudflare uses in production, so `setInterval`, WebSockets and SQLite behave
 * the way they will when the game is deployed.
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // Trees come back in seconds here rather than the minute a local run
      // uses, so a test can watch one return without dawdling. Not shorter:
      // a tree that returns mid-chop would make the felling tests flaky.
      miniflare: { bindings: { WORLD_REGROW_SECONDS: '5' } },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    // The tick loop runs in real time, so these tests spend real seconds waiting.
    testTimeout: 30_000,
  },
});
