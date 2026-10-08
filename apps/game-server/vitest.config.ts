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
      // Hunger empties in seconds too, for the same reason, and a picked-clean
      // stick or flower patch is back somewhere new in a couple of seconds.
      // Skeleton raids never come at all: one turning up mid-chop would make
      // every other test flaky.
      miniflare: {
        bindings: {
          WORLD_REGROW_SECONDS: '5',
          WORLD_HUNGER_EMPTY_SECONDS: '3',
          WORLD_PATCH_REGROW_SECONDS: '2',
          WORLD_RAID_SECONDS: '86400',
          // A deleted character's builds are gone in three seconds, so a test
          // can watch them stand locked and then disappear.
          WORLD_ABANDONED_SECONDS: '3',
          WORLD_ALLOW_TEST_SEASON: '1',
          WORLD_ALLOW_TEST_GEAR: '1',
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    // The tick loop runs in real time, so these tests spend real seconds waiting.
    testTimeout: 30_000,
  },
});
