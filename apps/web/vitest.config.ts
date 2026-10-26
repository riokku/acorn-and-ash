import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * The web Worker borrows the World Durable Object from the game server Worker.
 * These tests stand a stub game server next to it under the same script name, so
 * that the binding itself is exercised rather than assumed.
 *
 * The stub says which player key and season it was told about, because the web
 * Worker is what decides those, not the browser.
 */
const stubGameServer = `
  import { DurableObject } from 'cloudflare:workers';
  export class ItemCatalog extends DurableObject {
    draft = {revision: 0, overrides: {}}; publishedValue = {revision: 0, overrides: {}};
    published() { return this.publishedValue; }
    adminState() { return {draft: this.draft, published: this.publishedValue, history: []}; }
    saveDraft(revision, overrides) { if (revision !== this.draft.revision) return null; this.draft = {revision: revision + 1, overrides}; return this.adminState(); }
    publish(draftRevision, publishedRevision) { if (draftRevision !== this.draft.revision || publishedRevision !== this.publishedValue.revision) return null; this.publishedValue = {revision: publishedRevision + 1, overrides: this.draft.overrides}; return this.adminState(); }
  }

  export class World extends DurableObject {
    calls = [];
    inspectForAdmin(worldId) { this.calls.push({name:'inspect', worldId}); return {worldId, seed:42, players:0, savedCharacters:3, builtStructures:4, canReset:true, history:[]}; }
    prepareAdminReset(worldId, actor, origin) { this.calls.push({name:'prepare', worldId, actor, origin}); return {ok:true,value:{token:'test-proof',expiresAt:Date.now()+120000,confirmation:'RESET '+worldId,world:{worldId,seed:42,players:0,savedCharacters:3,builtStructures:4,canReset:true,history:[]}}}; }
    resetForAdmin(worldId, actor, origin, token, confirmation) { this.calls.push({name:'reset', worldId, actor, origin, token, confirmation}); return token==='test-proof' ? {ok:true,value:{worldId,seed:42,players:0,savedCharacters:0,builtStructures:0,canReset:true,history:[]}} : {ok:false,error:'Expired confirmation'}; }
    async fetch(request) {
      const url = new URL(request.url);
      if(url.pathname === '/__admin-calls') return Response.json(this.calls);
      return Response.json({
        stub: true,
        objectId: this.ctx.id.toString(),
        path: url.pathname,
        method: request.method,
        upgrade: request.headers.get('Upgrade'),
        player: url.searchParams.get('player'),
        season: url.searchParams.get('season'),
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
              durableObjects: {
                WORLD: { className: 'World', useSQLite: true },
                ITEM_CATALOG: { className: 'ItemCatalog', useSQLite: true },
              },
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
