import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * The web Worker borrows the World Durable Object from the game server Worker.
 * These tests stand a stub game server next to it under the same script name, so
 * that the binding itself is exercised rather than assumed.
 *
 * The stub says which player key it was told about, because the web Worker is
 * what decides that, not the browser.
 */
const stubGameServer = `
  export class World {
    constructor(ctx) { this.ctx = ctx; }
    async fetch(request) {
      const url = new URL(request.url);
      return Response.json({
        stub: true,
        objectId: this.ctx.id.toString(),
        path: url.pathname,
        upgrade: request.headers.get('Upgrade'),
        player: url.searchParams.get('player'),
      });
    }
  }
  export default { fetch: () => new Response('stub game server') };
`;

export default defineConfig(async () => {
  // The same SQL files that create the real accounts database, applied to the
  // test one by `test/apply-migrations.ts` before each test file runs.
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
          workers: [
            {
              name: 'acorn-ash-game-server',
              modules: true,
              script: stubGameServer,
              durableObjects: { WORLD: { className: 'World', useSQLite: true } },
            },
          ],
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  };
});
