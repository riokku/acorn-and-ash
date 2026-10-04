import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import app from '../src/index';
import { LIVE_SITE, SITE, cookieHeader } from './helpers';

/** A deployed environment: the login services are set up and test sign-in is not. */
const live = {
  ...env,
  TEST_SIGN_IN: undefined,
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  DISCORD_CLIENT_ID: 'discord-id',
  DISCORD_CLIENT_SECRET: 'discord-secret',
};

const get = (path: string, init: RequestInit = {}, where = LIVE_SITE): Request =>
  new Request(`${where}${path}`, init);

const post = (path: string, init: RequestInit = {}, where = LIVE_SITE): Request =>
  new Request(`${where}${path}`, { method: 'POST', ...init });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('what the first screen is told', () => {
  it('lists the login services that are set up, and says nobody is signed in', async () => {
    const response = await app.fetch(get('/api/session'), live);
    expect(await response.json()).toEqual({
      signedIn: false,
      providers: ['google', 'discord'],
      testSignIn: null,
    });
  });

  it('lists none until they have been set up in Cloudflare', async () => {
    const bare = {
      ...live,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      DISCORD_CLIENT_ID: undefined,
      DISCORD_CLIENT_SECRET: undefined,
    };
    const response = await app.fetch(get('/api/session'), bare);
    expect(await response.json()).toMatchObject({ signedIn: false, providers: [] });
  });

  it('says so on your own machine, where a test player can just walk in', async () => {
    const response = await app.fetch(get('/api/session', {}, SITE), env);
    expect(await response.json()).toMatchObject({ testSignIn: 'automatic', providers: [] });
  });
});

describe('starting to sign in', () => {
  it('sends the browser to Google, coming back to the one address Google has been told', async () => {
    const response = await app.fetch(get('/api/login/google'), live);

    expect(response.status).toBe(302);
    const target = new URL(response.headers.get('location') ?? '');
    expect(target.origin + target.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(target.searchParams.get('client_id')).toBe('google-id');
    expect(target.searchParams.get('redirect_uri')).toBe(`${LIVE_SITE}/api/auth/callback/google`);
    expect(target.searchParams.get('scope')).toContain('email');
    expect(target.searchParams.get('state')).toBeTruthy();
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
  });

  it('sends the browser to Discord, the same way', async () => {
    const response = await app.fetch(get('/api/login/discord'), live);

    expect(response.status).toBe(302);
    const target = new URL(response.headers.get('location') ?? '');
    expect(target.origin + target.pathname).toBe('https://discord.com/api/oauth2/authorize');
    expect(target.searchParams.get('client_id')).toBe('discord-id');
    expect(target.searchParams.get('redirect_uri')).toBe(`${LIVE_SITE}/api/auth/callback/discord`);
    expect(target.searchParams.get('scope')).toContain('email');
  });

  it('does not offer a service that has not been set up', async () => {
    const noDiscord = { ...live, DISCORD_CLIENT_SECRET: undefined };
    expect((await app.fetch(get('/api/login/discord'), noDiscord)).status).toBe(404);
  });

  it('does not offer a service we have never heard of', async () => {
    expect((await app.fetch(get('/api/login/facebook'), live)).status).toBe(404);
  });

  it('says to slow down when one address keeps starting sign-ins', async () => {
    const everyoneLimited = { limit: async () => ({ success: false }) };
    const response = await app.fetch(get('/api/login/google'), {
      ...live,
      SIGN_IN_LIMIT: everyoneLimited,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('location')).toBeNull();
  });

  it('counts by address, so one visitor cannot use up everyone else’s turns', async () => {
    const keys: string[] = [];
    const recording = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: true };
      },
    };

    await app.fetch(get('/api/login/google', { headers: { 'CF-Connecting-IP': '203.0.113.7' } }), {
      ...live,
      SIGN_IN_LIMIT: recording,
    });

    expect(keys).toEqual(['203.0.113.7']);
  });
});

/** An unsigned token of the shape Google hands back; only its contents are read. */
function googleToken(profile: Record<string, unknown>): string {
  const part = (value: unknown): string =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${part({ alg: 'none' })}.${part(profile)}.signature`;
}

/** Stand in for Google and Discord, so the sign-in can be walked all the way through. */
function stubLoginServices(people: {
  google?: { sub: string; email: string; name: string; verified: boolean };
  discord?: { id: string; email: string; username: string; verified: boolean };
}): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('https://oauth2.googleapis.com/token') && people.google) {
      return Response.json({
        access_token: 'google-access',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: googleToken({
          iss: 'https://accounts.google.com',
          aud: 'google-id',
          sub: people.google.sub,
          email: people.google.email,
          email_verified: people.google.verified,
          name: people.google.name,
        }),
      });
    }
    if (url.startsWith('https://discord.com/api/oauth2/token') && people.discord) {
      return Response.json({
        access_token: 'discord-access',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }
    if (url.startsWith('https://discord.com/api/users/') && people.discord) {
      return Response.json({
        id: people.discord.id,
        username: people.discord.username,
        email: people.discord.email,
        verified: people.discord.verified,
        avatar: null,
      });
    }
    throw new Error(`The test did not expect a request to ${url}`);
  });
}

/** Go to the login service and come back, the way a browser would, and return where that leaves it. */
async function signInWith(
  provider: 'google' | 'discord',
  cookie = '',
): Promise<{ response: Response; cookie: string }> {
  const start = await app.fetch(get(`/api/login/${provider}`, { headers: { cookie } }), live);
  const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
  const withState = [cookie, cookieHeader(start)].filter(Boolean).join('; ');

  const response = await app.fetch(
    get(`/api/auth/callback/${provider}?code=a-code&state=${state}`, {
      headers: { cookie: withState },
    }),
    live,
  );
  return { response, cookie: [cookieHeader(response)].filter(Boolean).join('; ') };
}

/** Which player the world is told about for this cookie, on the deployed address. */
async function playerFor(cookie: string): Promise<string | null> {
  const response = await app.fetch(
    get('/api/worlds/home-clearing/ws', { headers: { Upgrade: 'websocket', cookie } }),
    live,
  );
  return ((await response.json()) as { player: string | null }).player;
}

const ada = { sub: 'google-ada', email: 'ada@example.com', name: 'Ada', verified: true };

describe('coming back from Google or Discord', () => {
  it('makes an account and signs the player in, then on into the game', async () => {
    stubLoginServices({ google: ada });
    const { response, cookie } = await signInWith('google');

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location') ?? '', LIVE_SITE).pathname).toBe('/');
    expect(cookie).toContain('session_token');

    const status = await app.fetch(get('/api/session', { headers: { cookie } }), live);
    expect(await status.json()).toMatchObject({ signedIn: true, name: 'Ada' });
  });

  it('gives the account a private key for the worlds, which is not a test player', async () => {
    stubLoginServices({ google: ada });
    await signInWith('google');

    const row = await env.DB.prepare('SELECT player_key, is_anonymous FROM user WHERE email = ?')
      .bind(ada.email)
      .first<{ player_key: string; is_anonymous: number }>();
    expect(row?.player_key).toMatch(/^[0-9a-f]{32}$/);
    expect(row?.is_anonymous).toBe(0);
  });

  it('recognises the same person on their next visit, and makes no second account', async () => {
    stubLoginServices({ google: { ...ada, sub: 'google-ada-2', email: 'ada2@example.com' } });
    await signInWith('google');
    await signInWith('google');

    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM user WHERE email = ?')
      .bind('ada2@example.com')
      .first<{ n: number }>();
    expect(row?.n).toBe(1);
  });

  it('is the same account, with the same single character, whichever service they use', async () => {
    const person = { email: 'grace@example.com' };
    stubLoginServices({
      google: { sub: 'google-grace', name: 'Grace', verified: true, ...person },
      discord: { id: 'discord-grace', username: 'grace', verified: true, ...person },
    });

    const viaGoogle = await signInWith('google');
    const viaDiscord = await signInWith('discord');
    expect(viaDiscord.cookie).toContain('session_token');

    const accounts = await env.DB.prepare('SELECT COUNT(*) AS n FROM user WHERE email = ?')
      .bind(person.email)
      .first<{ n: number }>();
    const logins = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM account WHERE user_id = (SELECT id FROM user WHERE email = ?)',
    )
      .bind(person.email)
      .first<{ n: number }>();
    expect(accounts?.n).toBe(1);
    expect(logins?.n).toBe(2);

    const playerViaGoogle = await playerFor(viaGoogle.cookie);
    expect(playerViaGoogle).toMatch(/^[0-9a-f]{32}$/);
    expect(await playerFor(viaDiscord.cookie)).toBe(playerViaGoogle);
  });

  it('does not merge a Discord account whose email Discord never checked into somebody else’s', async () => {
    stubLoginServices({
      google: { sub: 'google-sam', email: 'sam@example.com', name: 'Sam', verified: true },
      discord: {
        id: 'discord-not-sam',
        email: 'sam@example.com',
        username: 'imposter',
        verified: false,
      },
    });

    await signInWith('google');
    const { response, cookie } = await signInWith('discord');

    // Sent back to the game with an error, and signed in as nobody.
    expect(
      new URL(response.headers.get('location') ?? '', LIVE_SITE).searchParams.get('error'),
    ).toBeTruthy();
    expect(cookie).not.toContain('session_token');
  });

  it('sends the player back to the game with a reason when they say no at the login service', async () => {
    const start = await app.fetch(get('/api/login/google'), live);
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');

    const response = await app.fetch(
      get(`/api/auth/callback/google?error=access_denied&state=${state}`, {
        headers: { cookie: cookieHeader(start) },
      }),
      live,
    );

    expect(response.status).toBe(302);
    const target = new URL(response.headers.get('location') ?? '', LIVE_SITE);
    expect(target.pathname).toBe('/');
    expect(target.searchParams.get('signin') ?? target.searchParams.get('error')).toBeTruthy();
  });

  it('refuses an answer that did not start here, so nobody can be signed in unasked', async () => {
    stubLoginServices({ google: { ...ada, sub: 'google-forged', email: 'forged@example.com' } });
    const response = await app.fetch(
      get('/api/auth/callback/google?code=a-code&state=made-up-by-someone-else'),
      live,
    );

    expect(response.headers.getSetCookie().join(';')).not.toContain('session_token');
  });
});

describe('everything else of Better Auth', () => {
  it('is not reachable from outside', async () => {
    for (const path of [
      '/api/auth/sign-in/anonymous',
      '/api/auth/sign-in/social',
      '/api/auth/list-sessions',
      '/api/auth/update-user',
    ]) {
      const response = await app.fetch(
        post(path, { headers: { 'content-type': 'application/json' }, body: '{}' }),
        live,
      );
      expect(response.status, path).toBe(404);
    }
  });
});

describe('test players', () => {
  it('can sign in on your own machine', async () => {
    const response = await app.fetch(post('/api/test-sign-in', {}, SITE), env);
    expect(response.status).toBe(201);
    expect(cookieHeader(response)).toContain('session_token');
  });

  it('are not a thing at the real staging or production address, even if it were switched on there by mistake', async () => {
    const switchedOnByMistake = { ...live, TEST_SIGN_IN: 'automatic' };
    const response = await app.fetch(post('/api/test-sign-in'), switchedOnByMistake);
    expect(response.status).toBe(404);
  });

  it('are not a thing where test sign-in was never switched on', async () => {
    const response = await app.fetch(post('/api/test-sign-in', {}, SITE), {
      ...env,
      TEST_SIGN_IN: undefined,
    });
    expect(response.status).toBe(404);
  });

  it('are refused when the request comes from another website', async () => {
    const response = await app.fetch(
      post('/api/test-sign-in', { headers: { Origin: 'https://elsewhere.example' } }, SITE),
      env,
    );
    expect(response.status).toBe(403);
  });

  it('do not get a second account for signing in twice', async () => {
    const first = await app.fetch(post('/api/test-sign-in', {}, SITE), env);
    const second = await app.fetch(
      post('/api/test-sign-in', { headers: { cookie: cookieHeader(first) } }, SITE),
      env,
    );
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ created: false });
  });

  it('say to slow down when one address makes too many', async () => {
    const everyoneLimited = { limit: async () => ({ success: false }) };
    const response = await app.fetch(post('/api/test-sign-in', {}, SITE), {
      ...env,
      SIGN_IN_LIMIT: everyoneLimited,
    });
    expect(response.status).toBe(429);
  });
});

describe('signing out', () => {
  it('ends the session, so the old cookie no longer gets anyone in', async () => {
    const started = await app.fetch(post('/api/test-sign-in', {}, SITE), env);
    const cookie = cookieHeader(started);

    const out = await app.fetch(post('/api/sign-out', { headers: { cookie } }, SITE), env);
    expect(out.status).toBe(200);

    const after = await app.fetch(get('/api/session', { headers: { cookie } }, SITE), env);
    expect(await after.json()).toMatchObject({ signedIn: false });
  });

  it('is refused when the request comes from another website', async () => {
    const response = await app.fetch(
      post('/api/sign-out', { headers: { Origin: 'https://elsewhere.example' } }, SITE),
      env,
    );
    expect(response.status).toBe(403);
  });
});
