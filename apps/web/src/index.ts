import { Hono } from 'hono';

import { DEFAULT_WORLD_ID, isValidWorldId } from './worlds';
import type { WebEnv } from './env';

/**
 * The Worker players actually talk to.
 *
 * It serves the built game client and forwards realtime traffic to the World
 * Durable Object, which lives in the game server Worker. Because this Worker
 * does not implement a Durable Object itself, Cloudflare gives it a preview URL
 * for every pull request.
 */
const app = new Hono<{ Bindings: WebEnv }>();

app.get('/api/health', (c) => c.json({ ok: true, service: 'web' }));

/** Where the browser should connect for realtime play. */
app.get('/api/config', (c) =>
  c.json({
    defaultWorldId: DEFAULT_WORLD_ID,
    // The client connects back to this same origin, so a preview build talks to
    // the world its own environment is bound to.
    realtimePath: '/api/worlds/{worldId}/ws',
  }),
);

app.get('/api/worlds/:worldId/ws', (c) => connectToWorld(c.req.raw, c.env, c.req.param('worldId')));

app.get('/api/worlds/:worldId/status', (c) =>
  connectToWorld(c.req.raw, c.env, c.req.param('worldId')),
);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Everything else is the game client itself.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

/** Hand a request to the World Durable Object that owns this world. */
export function connectToWorld(
  request: Request,
  env: WebEnv,
  worldId: string,
): Promise<Response> | Response {
  if (!isValidWorldId(worldId)) {
    return Response.json({ error: 'Unknown world' }, { status: 404 });
  }
  const id = env.WORLD.idFromName(worldId);
  return env.WORLD.get(id).fetch(request);
}

export default app;
