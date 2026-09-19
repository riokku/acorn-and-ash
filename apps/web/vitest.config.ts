import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * The web Worker borrows the World Durable Object from the game server Worker.
 * These tests stand a stub game server next to it under the same script name, so
 * that the binding itself is exercised rather than assumed.
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
      });
    }
  }
  export default { fetch: () => new Response('stub game server') };
`;

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
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
  },
});
