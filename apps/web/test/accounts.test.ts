import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import app from '../src/index';
import { adoptEarlierKey } from '../src/accounts/session';
import { SITE, cookieHeader, playerSeenByWorld, startAsGuest } from './helpers';

async function countUsers(): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM user').first<{ n: number }>();
  return row?.n ?? 0;
}

function postSession(headers: Record<string, string> = {}, body: unknown = {}): Request {
  return new Request(`${SITE}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('a first visit', () => {
  it('gives the browser a guest account and a cookie to remember it by', async () => {
    const before = await countUsers();
    const response = await SELF.fetch(postSession());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ kind: 'guest', created: true });
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    expect(await countUsers()).toBe(before + 1);
  });

  it('keeps the guest signed in for about a year', async () => {
    const response = await SELF.fetch(postSession());
    const sessionCookie = response.headers.getSetCookie().find((c) => c.includes('session_token'));
    expect(sessionCookie).toMatch(/Max-Age=31536000/i);
    expect(sessionCookie).toMatch(/HttpOnly/i);
  });

  it('never tells the browser the key the worlds know it by', async () => {
    const { cookie } = await startAsGuest();
    const { player } = await playerSeenByWorld(cookie);
    const response = await SELF.fetch(postSession({ cookie }));
    expect(JSON.stringify(await response.json())).not.toContain(player);
  });
});

describe('coming back', () => {
  it('recognises a browser that already has an account and makes no new one', async () => {
    const { cookie } = await startAsGuest();
    const before = await countUsers();

    const response = await SELF.fetch(postSession({ cookie }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ kind: 'guest', created: false });
    expect(await countUsers()).toBe(before);
  });

  it('pushes the year back when a guest returns a few days later, cookie and all', async () => {
    const { cookie } = await startAsGuest();
    // Two days have gone by since the session was last refreshed.
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    await env.DB.prepare('UPDATE session SET expires_at = expires_at - ?').bind(twoDays).run();
    const before = await env.DB.prepare('SELECT MAX(expires_at) AS latest FROM session').first<{
      latest: number;
    }>();

    const response = await SELF.fetch(postSession({ cookie }));

    const renewed = response.headers.getSetCookie().find((c) => c.includes('session_token'));
    expect(renewed).toMatch(/Max-Age=31536000/i);
    const after = await env.DB.prepare('SELECT MAX(expires_at) AS latest FROM session').first<{
      latest: number;
    }>();
    expect(after?.latest ?? 0).toBeGreaterThan(before?.latest ?? 0);
  });

  it('is the same player every time', async () => {
    const { cookie } = await startAsGuest();
    const first = await playerSeenByWorld(cookie);
    const second = await playerSeenByWorld(cookie);
    expect(first.player).not.toBeNull();
    expect(second.player).toBe(first.player);
  });

  it('is never held back by the guest limit, which only guards making new guests', async () => {
    const { cookie } = await startAsGuest();
    const everyoneLimited = { limit: async () => ({ success: false }) };

    const response = await app.fetch(postSession({ cookie }), {
      ...env,
      GUEST_LIMIT: everyoneLimited,
    });

    expect(response.status).toBe(200);
  });
});

describe('getting into a world', () => {
  it('turns away a browser that has no account', async () => {
    const response = await SELF.fetch(`${SITE}/api/worlds/home-clearing/ws`, {
      headers: { Upgrade: 'websocket' },
    });
    expect(response.status).toBe(401);
  });

  it('turns away a cookie that does not belong to anyone', async () => {
    const { status } = await playerSeenByWorld('acorn.session_token=not-a-real-session');
    expect(status).toBe(401);
  });

  it('gives different browsers different players', async () => {
    const one = await playerSeenByWorld((await startAsGuest()).cookie);
    const two = await playerSeenByWorld((await startAsGuest()).cookie);
    expect(one.player).not.toBe(two.player);
  });

  it('tells the world who is connecting with a key that is long and random', async () => {
    const { player } = await playerSeenByWorld((await startAsGuest()).cookie);
    expect(player).toMatch(/^[0-9a-f]{32}$/);
  });

  it('does not let a browser pick its own player by asking for one', async () => {
    const { cookie } = await startAsGuest();
    const honest = await playerSeenByWorld(cookie);
    const pretending = await playerSeenByWorld(cookie, '?player=somebody-elses-key');
    expect(pretending.player).toBe(honest.player);
  });
});

describe('characters from before accounts', () => {
  const earlierKey = '0123456789abcdef01234567';

  it('carries on under the new account, so nobody starts again', async () => {
    const { cookie } = await startAsGuest(earlierKey);
    expect((await playerSeenByWorld(cookie)).player).toBe(earlierKey);
  });

  it('cannot be claimed twice: the second browser gets a fresh player instead', async () => {
    const key = 'fedcba98765432100123456789abcdef';
    const first = await playerSeenByWorld((await startAsGuest(key)).cookie);
    const second = await playerSeenByWorld((await startAsGuest(key)).cookie);

    expect(first.player).toBe(key);
    expect(second.player).not.toBe(key);
    expect(second.player).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is ignored when it is not shaped like a key', async () => {
    const { cookie } = await startAsGuest('short');
    expect((await playerSeenByWorld(cookie)).player).toMatch(/^[0-9a-f]{32}$/);
  });

  it('cannot be picked up by someone who is not a brand-new guest', async () => {
    const { cookie } = await startAsGuest();
    const { player } = await playerSeenByWorld(cookie);
    const user = await env.DB.prepare('SELECT id FROM user WHERE player_key = ?')
      .bind(player)
      .first<{ id: string }>();
    await env.DB.prepare('UPDATE user SET is_anonymous = 0 WHERE id = ?').bind(user?.id).run();

    expect(await adoptEarlierKey(env.DB, user?.id ?? '', 'abcdefabcdefabcdefabcdef')).toBe(false);
  });
});

describe('what goes wrong', () => {
  it('refuses to sign somebody in on the say-so of another website', async () => {
    const before = await countUsers();
    const response = await SELF.fetch(postSession({ Origin: 'https://elsewhere.example' }));

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await countUsers()).toBe(before);
  });

  it('says to slow down, and makes no guest, when one address makes too many', async () => {
    const before = await countUsers();
    const everyoneLimited = { limit: async () => ({ success: false }) };

    const response = await app.fetch(postSession(), { ...env, GUEST_LIMIT: everyoneLimited });

    expect(response.status).toBe(429);
    expect(await countUsers()).toBe(before);
  });

  it('counts guests by address, so one visitor cannot use up everyone else’s turns', async () => {
    const keys: string[] = [];
    const recording = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: true };
      },
    };

    await app.fetch(postSession({ 'CF-Connecting-IP': '203.0.113.7' }), {
      ...env,
      GUEST_LIMIT: recording,
    });

    expect(keys).toEqual(['203.0.113.7']);
  });

  it('says plainly that accounts are not set up when the session secret is missing', async () => {
    const response = await app.fetch(postSession(), { ...env, BETTER_AUTH_SECRET: undefined });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Accounts are not set up for this environment yet',
    });
  });

  it('rejects a session cookie signed with a different secret', async () => {
    const response = await SELF.fetch(postSession());
    const cookie = cookieHeader(response);

    const otherSecret = await app.fetch(
      new Request(`${SITE}/api/worlds/home-clearing/ws`, { headers: { cookie } }),
      { ...env, BETTER_AUTH_SECRET: 'a-completely-different-secret-value' },
    );

    expect(otherSecret.status).toBe(401);
  });
});
