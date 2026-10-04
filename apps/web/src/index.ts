import { Hono } from 'hono';

import {
  AccountsNotConfiguredError,
  resumeSession,
  signedInAccount,
  startGuest,
} from './accounts/session';
import { DEFAULT_WORLD_ID, isValidWorldId } from './worlds';
import type { WebEnv } from './env';

/**
 * The Worker players actually talk to.
 *
 * It serves the built game client and forwards realtime traffic to the World
 * Durable Object, which lives in the game server Worker. Because this Worker
 * does not implement a Durable Object itself, Cloudflare gives it a preview URL
 * for every pull request.
 *
 * It is also where players are told apart. The browser holds only a session
 * cookie; this Worker looks up who that is and tells the world which player is
 * connecting, so a browser can never claim to be somebody else (decision 0086).
 */
const app = new Hono<{ Bindings: WebEnv }>();

app.onError((error, c) => {
  if (error instanceof AccountsNotConfiguredError) {
    return c.json({ error: 'Accounts are not set up for this environment yet' }, 503);
  }
  // Anything else is a surprise (the database being down, say). Say so plainly
  // rather than letting Cloudflare show its own error page: the game retries.
  console.error(error);
  return c.json({ error: 'Something went wrong' }, 500);
});

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

/**
 * Make sure this browser has an account, creating a guest if it doesn't.
 *
 * Safe to call as often as you like: a browser that is already signed in just
 * hears so. `earlierKey` carries a character from before accounts existed over
 * to its new account (see `startGuest`).
 */
app.post('/api/session', async (c) => {
  const request = c.req.raw;
  if (!isSameSite(request)) return c.json({ error: 'Not from this site' }, 403);

  const { account: existing, cookies } = await resumeSession(request, c.env);
  if (existing) {
    // Each visit pushes the guest's year back, so the cookie has to be renewed too.
    const reply = Response.json({ kind: existing.kind, created: false });
    for (const cookie of cookies) reply.headers.append('set-cookie', cookie);
    return reply;
  }

  // Only a new guest costs anything, so only a new guest is limited.
  const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await c.env.GUEST_LIMIT.limit({ key: address });
  if (!success) return c.json({ error: 'Too many new players from here. Try again soon.' }, 429);

  const body: unknown = await request.json().catch(() => null);
  const earlierKey =
    typeof body === 'object' && body !== null && 'earlierKey' in body ? body.earlierKey : undefined;
  return startGuest(request, c.env, earlierKey);
});

app.get('/api/worlds/:worldId/ws', async (c) => {
  const worldId = c.req.param('worldId');
  if (!isValidWorldId(worldId)) return c.json({ error: 'Unknown world' }, 404);

  // Browsers already keep the cookie off a connection started by another site;
  // this is the second lock on the same door.
  if (!isSameSite(c.req.raw)) return c.json({ error: 'Not from this site' }, 403);

  const account = await signedInAccount(c.req.raw, c.env);
  if (!account) return c.json({ error: 'Sign in first' }, 401);

  return connectToWorld(asPlayer(c.req.raw, account.playerKey), c.env, worldId);
});

app.get('/api/worlds/:worldId/status', (c) =>
  connectToWorld(c.req.raw, c.env, c.req.param('worldId')),
);

app.get('/api/worlds/:worldId/reset-players', (c) =>
  connectToWorld(c.req.raw, c.env, c.req.param('worldId')),
);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Everything else is the game client itself.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

/**
 * The same request, saying who is really connecting.
 *
 * Whatever player the browser put in the address is thrown away: the world
 * believes only the key this Worker looked up from the session.
 */
function asPlayer(request: Request, playerKey: string): Request {
  const url = new URL(request.url);
  url.searchParams.set('player', playerKey);
  return new Request(url, request);
}

/** A browser request from some other site could only be trying to sign a visitor in unasked. */
function isSameSite(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return origin === null || origin === new URL(request.url).origin;
}

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
