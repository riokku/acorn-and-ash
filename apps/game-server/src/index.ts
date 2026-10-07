import { Hono } from 'hono';

import type { WorldEnv } from './env';

export { World } from './world';

/**
 * The game server Worker.
 *
 * Almost all of the traffic goes straight into a World Durable Object. These
 * routes exist for local development and for health checks; in production the
 * browser talks to `apps/web`, which forwards to the very same object.
 */
const app = new Hono<{ Bindings: WorldEnv }>();

app.get('/health', (c) => c.json({ ok: true, service: 'game-server' }));

app.all('/worlds/:worldId/*', (c) => forwardToWorld(c.req.raw, c.env, c.req.param('worldId')));
app.all('/worlds/:worldId', (c) => forwardToWorld(c.req.raw, c.env, c.req.param('worldId')));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export function forwardToWorld(
  request: Request,
  env: WorldEnv,
  worldId: string,
): Promise<Response> {
  // Deleting a character is only ever done on behalf of the signed-in player,
  // through `apps/web`, which knows who that is. Anybody can reach these
  // routes, so they must not be a way round it.
  if (request.method === 'DELETE') {
    return Promise.resolve(Response.json({ error: 'Not found' }, { status: 404 }));
  }
  const id = env.WORLD.idFromName(worldId);
  return env.WORLD.get(id).fetch(request);
}

export default app;
