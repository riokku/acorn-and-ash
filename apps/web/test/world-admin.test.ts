import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';
import app from '../src/index';
import { startAsTestPlayer, SITE } from './helpers';
import type { WebEnv } from '../src/env';
const OWNER = 'world-owner@example.com';
const settings = () => ({
  ...env,
  ADMIN_OWNER_EMAIL: OWNER,
  ITEM_CATALOG: env.ITEM_CATALOG as unknown as WebEnv['ITEM_CATALOG'],
});
async function owner() {
  await env.DB.prepare('UPDATE user SET email=? WHERE email=?')
    .bind(crypto.randomUUID() + '@retired.example.com', OWNER)
    .run();
  const { cookie } = await startAsTestPlayer();
  const row = await env.DB.prepare('SELECT id FROM user ORDER BY created_at DESC LIMIT 1').first<{
    id: string;
  }>();
  const id = row!.id;
  await env.DB.prepare('UPDATE user SET email=?,email_verified=1,is_anonymous=0 WHERE id=?')
    .bind(OWNER, id)
    .run();
  await env.DB.prepare(
    'INSERT INTO account (id,account_id,provider_id,user_id,created_at,updated_at) VALUES (?,?,?,?,?,?)',
  )
    .bind(crypto.randomUUID(), 'world-owner', 'google', id, Date.now(), Date.now())
    .run();
  return { cookie, id };
}
function send(
  path: string,
  cookie: string,
  body?: unknown,
  origin = SITE,
  method = body === undefined ? 'GET' : 'POST',
) {
  return app.fetch(
    new Request(SITE + path, {
      method,
      headers: { cookie, origin, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    settings(),
  );
}
it('denies direct world admin HTML and APIs to guests, ordinary players and unverified owners', async () => {
  const { cookie } = await startAsTestPlayer();
  for (const path of [
    '/admin/worlds',
    '/api/admin/worlds/home-clearing',
    '/api/admin/worlds/home-clearing/prepare-reset',
    '/api/admin/worlds/home-clearing/reset',
  ]) {
    expect((await send(path, '', path.endsWith('reset') ? {} : undefined)).status).toBe(403);
    expect((await send(path, cookie, path.endsWith('reset') ? {} : undefined)).status).toBe(403);
  }
  const trusted = await owner();
  await env.DB.prepare('UPDATE user SET email_verified=0 WHERE id=?').bind(trusted.id).run();
  expect(
    (await send('/api/admin/worlds/home-clearing/prepare-reset', trusted.cookie, {})).status,
  ).toBe(403);
});
it('checks origin, method, content type, body bounds, typed world confirmation and server actor identity', async () => {
  const { cookie, id } = await owner(),
    path = '/api/admin/worlds/owner-world-test';
  const status = await send(path, cookie);
  expect(status.status).toBe(200);
  expect(status.headers.get('Cache-Control')).toBe('private, no-store');
  expect((await send(path + '/prepare-reset', cookie, {}, 'https://evil.example')).status).toBe(
    403,
  );
  expect((await send(path + '/prepare-reset', cookie, {}, 'null')).status).toBe(403);
  expect((await send(path + '/prepare-reset', cookie)).status).toBe(404);
  expect(
    (
      await send(path + '/reset', cookie, {
        token: 'test-proof',
        confirmation: 'RESET another-world',
      })
    ).status,
  ).toBe(400);
  expect((await send(path + '/prepare-reset', cookie, { padding: 'x'.repeat(5000) })).status).toBe(
    413,
  );
  const wrongType = new Request(SITE + path + '/prepare-reset', {
    method: 'POST',
    headers: { cookie, origin: SITE, 'Content-Type': 'text/plain' },
    body: '{}',
  });
  expect((await app.fetch(wrongType, settings())).status).toBe(415);
  const proof = await send(path + '/prepare-reset', cookie, {});
  expect(proof.status).toBe(200);
  expect(await proof.json()).toMatchObject({
    token: 'test-proof',
    confirmation: 'RESET owner-world-test',
  });
  expect(
    (
      await send(path + '/reset', cookie, {
        token: 'test-proof',
        confirmation: 'RESET owner-world-test',
        actor: 'spoofed',
      })
    ).status,
  ).toBe(200);
  const calls = await env.WORLD.get(env.WORLD.idFromName('owner-world-test')).fetch(
    new Request(SITE + '/__admin-calls'),
  );
  expect(await calls.json()).toContainEqual({
    name: 'reset',
    worldId: 'owner-world-test',
    actor: id,
    origin: SITE,
    token: 'test-proof',
    confirmation: 'RESET owner-world-test',
  });
  expect(
    (
      await send(path + '/reset', cookie, {
        token: 'expired',
        confirmation: 'RESET owner-world-test',
      })
    ).status,
  ).toBe(409);
});
it('retires the unauthenticated reset URL and rejects invalid world IDs before resolving a world', async () => {
  const { cookie } = await owner();
  for (const method of ['GET', 'POST', 'DELETE'])
    expect(
      (
        await send(
          '/api/worlds/home-clearing/reset-players?confirm=clear-everyone',
          cookie,
          undefined,
          SITE,
          method,
        )
      ).status,
    ).toBe(404);
  expect((await send('/api/admin/worlds/UPPERCASE', cookie)).status).toBe(400);
  expect((await send('/api/admin/worlds/UPPERCASE/prepare-reset', cookie, {})).status).toBe(404);
  expect(
    (
      await app.fetch(new Request(SITE + '/api/admin/worlds/home-clearing'), {
        ...settings(),
        ADMIN_OWNER_EMAIL: undefined,
      })
    ).status,
  ).toBe(403);
});
