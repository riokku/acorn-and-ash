import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import app from '../src/index';
import { adoptEarlierKey } from '../src/accounts/session';
import {
  LIVE_SITE,
  SITE,
  cookieHeader,
  playerSeenByWorld,
  sayHere,
  startAsTestPlayer,
} from './helpers';

async function userFor(player: string | null): Promise<{ id: string; entered_at: number | null }> {
  const row = await env.DB.prepare('SELECT id, entered_at FROM user WHERE player_key = ?')
    .bind(player)
    .first<{ id: string; entered_at: number | null }>();
  if (row === null) throw new Error('No account has that key');
  return row;
}

describe('being signed in', () => {
  it('is remembered by a cookie that lasts about a year', async () => {
    const response = await SELF.fetch(`${SITE}/api/test-sign-in`, { method: 'POST' });
    const sessionCookie = response.headers.getSetCookie().find((c) => c.includes('session_token'));
    expect(sessionCookie).toMatch(/Max-Age=31536000/i);
    expect(sessionCookie).toMatch(/HttpOnly/i);
  });

  it('is told back to the browser without the key the worlds know it by', async () => {
    const { cookie } = await startAsTestPlayer();
    const { player } = await playerSeenByWorld(cookie);
    const response = await sayHere(cookie);

    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain(player);
  });

  it('is required before saying "I am here"', async () => {
    const response = await sayHere('');
    expect(response.status).toBe(401);
  });

  it('pushes the year back when a player returns a few days later, cookie and all', async () => {
    const { cookie } = await startAsTestPlayer();
    // Two days have gone by since the session was last refreshed.
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    await env.DB.prepare('UPDATE session SET expires_at = expires_at - ?').bind(twoDays).run();
    const before = await env.DB.prepare('SELECT MAX(expires_at) AS latest FROM session').first<{
      latest: number;
    }>();

    const response = await SELF.fetch(`${SITE}/api/session`, { headers: { cookie } });

    const renewed = response.headers.getSetCookie().find((c) => c.includes('session_token'));
    expect(renewed).toMatch(/Max-Age=31536000/i);
    const after = await env.DB.prepare('SELECT MAX(expires_at) AS latest FROM session').first<{
      latest: number;
    }>();
    expect(after?.latest ?? 0).toBeGreaterThan(before?.latest ?? 0);
  });

  it('is the same player every time', async () => {
    const { cookie } = await startAsTestPlayer();
    const first = await playerSeenByWorld(cookie);
    const second = await playerSeenByWorld(cookie);
    expect(first.player).not.toBeNull();
    expect(second.player).toBe(first.player);
  });

  it('is never held back by the sign-in limit, which only guards starting to sign in', async () => {
    const { cookie } = await startAsTestPlayer();
    const everyoneLimited = { limit: async () => ({ success: false }) };

    const response = await app.fetch(new Request(`${SITE}/api/session`, { headers: { cookie } }), {
      ...env,
      SIGN_IN_LIMIT: everyoneLimited,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ signedIn: true });
  });
});

describe('getting into a world', () => {
  it('turns away a browser that is not signed in', async () => {
    const response = await SELF.fetch(`${SITE}/api/worlds/home-clearing/ws`, {
      headers: { Upgrade: 'websocket' },
    });
    expect(response.status).toBe(401);
  });

  it('turns away a cookie that does not belong to anyone', async () => {
    const { status } = await playerSeenByWorld('acorn.session_token=not-a-real-session');
    expect(status).toBe(401);
  });

  it('refuses a connection started by a page on another website, even with a good cookie', async () => {
    const { cookie } = await startAsTestPlayer();
    const response = await SELF.fetch(`${SITE}/api/worlds/home-clearing/ws`, {
      headers: { Upgrade: 'websocket', cookie, Origin: 'https://elsewhere.example' },
    });
    expect(response.status).toBe(403);
  });

  it('lets in the game page itself, which names its own site as the origin', async () => {
    const { cookie } = await startAsTestPlayer();
    const response = await SELF.fetch(`${SITE}/api/worlds/home-clearing/ws`, {
      headers: { Upgrade: 'websocket', cookie, Origin: SITE },
    });
    expect(response.status).toBe(200);
  });

  it('gives different people different players', async () => {
    const one = await playerSeenByWorld((await startAsTestPlayer()).cookie);
    const two = await playerSeenByWorld((await startAsTestPlayer()).cookie);
    expect(one.player).not.toBe(two.player);
  });

  it('tells the world who is connecting with a key that is long and random', async () => {
    const { player } = await playerSeenByWorld((await startAsTestPlayer()).cookie);
    expect(player).toMatch(/^[0-9a-f]{32}$/);
  });

  it('does not let a browser pick its own player by asking for one', async () => {
    const { cookie } = await startAsTestPlayer();
    const honest = await playerSeenByWorld(cookie);
    const pretending = await playerSeenByWorld(cookie, '?player=somebody-elses-key');
    expect(pretending.player).toBe(honest.player);
  });

  it('hands on a season asked for with ?season= from your own machine', async () => {
    const { cookie } = await startAsTestPlayer();
    expect((await playerSeenByWorld(cookie, '?season=winter')).season).toBe('winter');
    expect((await playerSeenByWorld(cookie)).season).toBeNull();
  });

  it('hands it on from a pull request preview too', async () => {
    const { cookie } = await startAsTestPlayer();
    const preview = 'https://pr-97-acorn-ash-web-staging.example.workers.dev';
    expect((await playerSeenByWorld(cookie, '?season=winter', preview)).season).toBe('winter');
  });

  it('keeps a season out of the real worlds, where the seasons follow their own clock', async () => {
    const { cookie } = await startAsTestPlayer();
    const seen = await playerSeenByWorld(cookie, '?season=winter', LIVE_SITE);
    expect(seen.status).toBe(200);
    expect(seen.season).toBeNull();
    // The rest of the request is untouched.
    expect(seen.player).toMatch(/^[0-9a-f]{32}$/);
  });

  it('notes that the account has been in a world, once', async () => {
    const { cookie } = await startAsTestPlayer();
    const { player } = await playerSeenByWorld(cookie);
    const first = await userFor(player);
    expect(first.entered_at).not.toBeNull();

    await playerSeenByWorld(cookie);
    expect((await userFor(player)).entered_at).toBe(first.entered_at);
  });
});

describe('the character a player made in a world', () => {
  const characterUrl = `${SITE}/api/worlds/home-clearing/character`;

  it('is asked of the world, as the signed-in player and nobody else', async () => {
    const { cookie } = await startAsTestPlayer();
    const response = await SELF.fetch(`${characterUrl}?player=somebody-elses-key`, {
      headers: { cookie },
    });
    const body = (await response.json()) as { path: string; player: string };

    expect(response.status).toBe(200);
    expect(body.path).toBe('/api/worlds/home-clearing/character');
    expect(body.player).toBe((await playerSeenByWorld(cookie)).player);
  });

  it('is private: no sign-in, no answer', async () => {
    expect((await SELF.fetch(characterUrl)).status).toBe(401);
  });

  it('is only asked of a world that exists', async () => {
    const { cookie } = await startAsTestPlayer();
    const response = await SELF.fetch(`${SITE}/api/worlds/..%2Fetc/character`, {
      headers: { cookie },
    });
    expect(response.status).toBe(404);
  });
});

describe('characters from before accounts', () => {
  const earlierKey = '0123456789abcdef01234567';

  it('carry on under the account that signs in, so nobody starts again', async () => {
    const { cookie } = await startAsTestPlayer();
    await sayHere(cookie, earlierKey);
    expect((await playerSeenByWorld(cookie)).player).toBe(earlierKey);
  });

  it('cannot be claimed twice: the second account gets a fresh player instead', async () => {
    const key = 'fedcba98765432100123456789abcdef';
    const first = (await startAsTestPlayer()).cookie;
    const second = (await startAsTestPlayer()).cookie;
    await sayHere(first, key);
    await sayHere(second, key);

    expect((await playerSeenByWorld(first)).player).toBe(key);
    const other = (await playerSeenByWorld(second)).player;
    expect(other).not.toBe(key);
    expect(other).toMatch(/^[0-9a-f]{32}$/);
  });

  it('are ignored when the key is not shaped like one', async () => {
    const { cookie } = await startAsTestPlayer();
    await sayHere(cookie, 'short');
    expect((await playerSeenByWorld(cookie)).player).toMatch(/^[0-9a-f]{32}$/);
  });

  it('cannot be taken by an account that has already been in a world', async () => {
    const { cookie } = await startAsTestPlayer();
    const { player } = await playerSeenByWorld(cookie);

    await sayHere(cookie, 'abcdefabcdefabcdefabcdef');

    expect((await playerSeenByWorld(cookie)).player).toBe(player);
  });

  it('leave an account that has been in a world with the key it has, however it is asked', async () => {
    const { cookie } = await startAsTestPlayer();
    const { player } = await playerSeenByWorld(cookie);
    const { id } = await userFor(player);

    expect(await adoptEarlierKey(env.DB, id, 'abcdefabcdefabcdefabcdef')).toBe(false);
  });
});

describe('what goes wrong', () => {
  it('refuses to say "I am here" on the say-so of another website', async () => {
    const { cookie } = await startAsTestPlayer();
    const response = await SELF.fetch(`${SITE}/api/session`, {
      method: 'POST',
      headers: { cookie, Origin: 'https://elsewhere.example', 'content-type': 'application/json' },
      body: JSON.stringify({ earlierKey: '0123456789abcdef01234567' }),
    });

    expect(response.status).toBe(403);
  });

  it('says plainly that accounts are not set up when the session secret is missing', async () => {
    const response = await app.fetch(new Request(`${SITE}/api/session`), {
      ...env,
      BETTER_AUTH_SECRET: undefined,
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Accounts are not set up for this environment yet',
    });
  });

  it('rejects a session cookie signed with a different secret', async () => {
    const cookie = cookieHeader(await SELF.fetch(`${SITE}/api/test-sign-in`, { method: 'POST' }));

    const otherSecret = await app.fetch(
      new Request(`${SITE}/api/worlds/home-clearing/ws`, { headers: { cookie } }),
      { ...env, BETTER_AUTH_SECRET: 'a-completely-different-secret-value' },
    );

    expect(otherSecret.status).toBe(401);
  });
});
