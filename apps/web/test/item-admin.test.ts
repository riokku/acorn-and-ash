import { env, SELF } from 'cloudflare:test';
import { expect, it } from 'vitest';
import app from '../src/index';
import { canEditItems } from '../src/item-admin';
import { startAsTestPlayer, SITE } from './helpers';
import type { WebEnv } from '../src/env';
const OWNER = 'owner@example.com';
const settings = () => ({
  ...env,
  ADMIN_OWNER_EMAIL: OWNER,
  ITEM_CATALOG: env.ITEM_CATALOG as unknown as WebEnv['ITEM_CATALOG'],
});
async function trustedOwner() {
  await env.DB.prepare('UPDATE user SET email = ? WHERE email = ?')
    .bind(crypto.randomUUID() + '@retired.example.com', OWNER)
    .run();
  const { cookie } = await startAsTestPlayer();
  const user = await env.DB.prepare('SELECT id FROM user ORDER BY created_at DESC LIMIT 1').first<{
    id: string;
  }>();
  const id = user!.id;
  await env.DB.prepare(
    'UPDATE user SET email = ?, email_verified = 1, is_anonymous = 0 WHERE id = ?',
  )
    .bind(OWNER, id)
    .run();
  await env.DB.prepare(
    'INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), 'google-owner', 'google', id, Date.now(), Date.now())
    .run();
  return { cookie, id };
}
it('fails closed for missing configuration, anonymous players, unverified email, wrong owner and non-Google accounts', async () => {
  const { id } = await trustedOwner();
  const account = {
    id,
    kind: 'member' as const,
    name: 'Owner',
    playerKey: 'test-player',
    entered: false,
  };
  expect(await canEditItems(account, settings())).toBe(true);
  expect(await canEditItems(account, { ...settings(), ADMIN_OWNER_EMAIL: undefined })).toBe(false);
  expect(await canEditItems({ ...account, kind: 'test' }, settings())).toBe(false);
  expect(
    await canEditItems(account, { ...settings(), ADMIN_OWNER_EMAIL: 'someone@example.com' }),
  ).toBe(false);
  await env.DB.prepare('UPDATE user SET email_verified = 0 WHERE id = ?').bind(id).run();
  expect(await canEditItems(account, settings())).toBe(false);
  await env.DB.prepare('UPDATE user SET email_verified = 1 WHERE id = ?').bind(id).run();
  await env.DB.prepare("UPDATE account SET provider_id = 'discord' WHERE user_id = ?")
    .bind(id)
    .run();
  expect(await canEditItems(account, settings())).toBe(false);
});
it('guards editor HTML and every admin API, including direct addresses and test sign-in', async () => {
  const { cookie } = await startAsTestPlayer();
  for (const path of ['/admin', '/admin/', '/admin/items', '/admin.html', '/api/admin/items']) {
    const response = await app.fetch(new Request(SITE + path, { headers: { cookie } }), settings());
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('no-store');
  }
  expect((await SELF.fetch(SITE + '/api/health')).status).toBe(200);
  expect((await SELF.fetch(SITE + '/api/items')).status).toBe(200);
});
it('accepts only an authenticated owner with same-origin, valid versioned edits', async () => {
  const { cookie } = await trustedOwner();
  const send = (path: string, body?: unknown, origin = SITE) =>
    app.fetch(
      new Request(SITE + path, {
        headers: { cookie, Origin: origin, 'Content-Type': 'application/json' },
        ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
      }),
      settings(),
    );
  const status = await send('/api/session');
  expect(await status.json()).toMatchObject({ canEditItems: true });
  const before = await send('/api/admin/items');
  expect(before.status).toBe(200);
  const state = (await before.json()) as { draft: { revision: number } };
  expect(
    (
      await send(
        '/api/admin/items/draft',
        { draftRevision: state.draft.revision, overrides: {} },
        'https://evil.example',
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await send('/api/admin/items/draft', {
        draftRevision: state.draft.revision,
        overrides: { log: { bonuses: { power: 10 } } },
      })
    ).status,
  ).toBe(400);
  const saved = await send('/api/admin/items/draft', {
    draftRevision: state.draft.revision,
    overrides: { axe: { displayName: 'Custom axe' } },
  });
  expect(saved.status).toBe(200);
  expect(
    (await send('/api/admin/items/draft', { draftRevision: state.draft.revision, overrides: {} }))
      .status,
  ).toBe(409);
  expect(await (await send('/api/items')).json()).not.toHaveProperty('draft');
});

it('serves private editor HTML only to the owner and limits oversized mutations', async () => {
  const { cookie } = await trustedOwner();
  const html = await app.fetch(new Request(SITE + '/admin/items', { headers: { cookie } }), {
    ...settings(),
    ASSETS: {
      fetch: async (request: Request) => {
        expect(new URL(request.url).pathname).toBe('/admin.html');
        return new Response('<html>Private catalogue</html>', {
          headers: { 'Content-Type': 'text/html' },
        });
      },
    } as unknown as WebEnv['ASSETS'],
  });
  expect(html.status).toBe(200);
  expect(html.headers.get('cache-control')).toBe('private, no-store');
  expect(html.headers.get('x-robots-tag')).toContain('noindex');
  const oversized = await app.fetch(
    new Request(SITE + '/api/admin/items/draft', {
      method: 'POST',
      headers: { cookie, Origin: SITE },
      body: 'x'.repeat(256001),
    }),
    settings(),
  );
  expect(oversized.status).toBe(413);
});
