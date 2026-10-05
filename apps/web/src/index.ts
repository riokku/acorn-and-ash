import { Hono } from 'hono';

import { createAuth } from './accounts/auth';
import { isProvider, isTestHost, offeredProviders, testSignInMode } from './accounts/options';
import { isPlayerKey } from './accounts/player-key';
import {
  AccountsNotConfiguredError,
  adoptEarlierKey,
  beginSignIn,
  endSession,
  markEntered,
  resumeSession,
  signedInAccount,
  startTestPlayer,
  type Account,
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
 * It is also where players are told apart. A player signs in with Google or
 * Discord and the browser holds only a session cookie; this Worker looks up who
 * that is and tells the world which player is connecting, so a browser can
 * never claim to be somebody else (decision 0086).
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
 * What the browser needs to know to show its first screen: whether somebody is
 * signed in, and if not, what they can sign in with. Never says anything about
 * the key the worlds use.
 */
function sessionStatus(account: Account | null, env: WebEnv, hostname: string) {
  return {
    signedIn: account !== null,
    name: account?.name,
    providers: offeredProviders(env, hostname),
    testSignIn: testSignInMode(env, hostname),
  };
}

app.get('/api/session', async (c) => {
  const { account, cookies } = await resumeSession(c.req.raw, c.env);
  const reply = Response.json(sessionStatus(account, c.env, new URL(c.req.url).hostname));
  // Each visit pushes the year back, so the cookie has to be renewed too.
  for (const cookie of cookies) reply.headers.append('set-cookie', cookie);
  return reply;
});

/**
 * Say "I'm here" as somebody signed in. A browser that played before accounts
 * existed sends its old key along, so its character carries over to the account
 * it has just signed in with (see `adoptEarlierKey`). Safe to repeat.
 */
app.post('/api/session', async (c) => {
  const request = c.req.raw;
  if (!isSameSite(request)) return c.json({ error: 'Not from this site' }, 403);

  const { account, cookies } = await resumeSession(request, c.env);
  if (!account) return c.json({ error: 'Sign in first' }, 401);

  const body: unknown = await request.json().catch(() => null);
  const earlierKey =
    typeof body === 'object' && body !== null && 'earlierKey' in body ? body.earlierKey : undefined;
  if (isPlayerKey(earlierKey) && !account.entered) {
    await adoptEarlierKey(c.env.DB, account.id, earlierKey);
  }

  const reply = Response.json(sessionStatus(account, c.env, new URL(request.url).hostname));
  for (const cookie of cookies) reply.headers.append('set-cookie', cookie);
  return reply;
});

/** Throttle people starting to sign in, per address. Only starting counts. */
async function tooManySignIns(request: Request, env: WebEnv): Promise<boolean> {
  const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.SIGN_IN_LIMIT.limit({ key: address });
  return !success;
}

/** The link behind each "Continue with…" button: off to Google or Discord. */
app.get('/api/login/:provider', async (c) => {
  const provider = c.req.param('provider');
  const offered = offeredProviders(c.env, new URL(c.req.url).hostname);
  if (!isProvider(provider) || !offered.includes(provider)) {
    return c.json({ error: 'That way of signing in is not available' }, 404);
  }
  if (await tooManySignIns(c.req.raw, c.env)) {
    return c.json({ error: 'Too many sign-in attempts from here. Try again soon.' }, 429);
  }
  return beginSignIn(c.req.raw, c.env, provider);
});

/**
 * Where Google and Discord send the player back to. Better Auth checks the
 * answer, makes or finds the account, sets the session cookie and sends the
 * browser on to the game. Nothing else of Better Auth's is reachable from
 * outside: this is the one address the login services need.
 */
app.get('/api/auth/callback/:provider', (c) =>
  createAuth(c.env, new URL(c.req.url).origin).handler(c.req.raw),
);

app.post('/api/sign-out', async (c) => {
  if (!isSameSite(c.req.raw)) return c.json({ error: 'Not from this site' }, 403);
  return endSession(c.req.raw, c.env);
});

/**
 * A test player: an account with no Google or Discord behind it, for your own
 * machine, the browser tests and pull request previews. Anywhere else this does
 * not exist.
 */
app.post('/api/test-sign-in', async (c) => {
  const request = c.req.raw;
  if (testSignInMode(c.env, new URL(request.url).hostname) === null) {
    return c.json({ error: 'Not found' }, 404);
  }
  if (!isSameSite(request)) return c.json({ error: 'Not from this site' }, 403);

  if (await signedInAccount(request, c.env)) return c.json({ created: false });
  if (await tooManySignIns(request, c.env)) {
    return c.json({ error: 'Too many sign-in attempts from here. Try again soon.' }, 429);
  }
  return startTestPlayer(request, c.env);
});

/** The character this player made in this world, if they have made one. */
app.get('/api/worlds/:worldId/character', async (c) => {
  const worldId = c.req.param('worldId');
  if (!isValidWorldId(worldId)) return c.json({ error: 'Unknown world' }, 404);

  const account = await signedInAccount(c.req.raw, c.env);
  if (!account) return c.json({ error: 'Sign in first' }, 401);

  return connectToWorld(asPlayer(c.req.raw, account.playerKey), c.env, worldId);
});

app.get('/api/worlds/:worldId/ws', async (c) => {
  const worldId = c.req.param('worldId');
  if (!isValidWorldId(worldId)) return c.json({ error: 'Unknown world' }, 404);

  // Browsers already keep the cookie off a connection started by another site;
  // this is the second lock on the same door.
  if (!isSameSite(c.req.raw)) return c.json({ error: 'Not from this site' }, 403);

  const account = await signedInAccount(c.req.raw, c.env);
  if (!account) return c.json({ error: 'Sign in first' }, 401);

  // From here on the key is in use, so it can never be swapped for another.
  if (!account.entered) await markEntered(c.env.DB, account.id);

  const request = asPlayer(c.req.raw, account.playerKey, isTestHost(new URL(c.req.url).hostname));
  return connectToWorld(request, c.env, worldId);
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
 * believes only the key this Worker looked up from the session. The same goes
 * for a season asked for with `?season=` (decision 0089), which only goes on
 * to the world from your own machine and pull request previews: anywhere else
 * the seasons follow the world's own clock.
 */
function asPlayer(request: Request, playerKey: string, mayPickSeason = false): Request {
  const url = new URL(request.url);
  url.searchParams.set('player', playerKey);
  if (!mayPickSeason) url.searchParams.delete('season');
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
