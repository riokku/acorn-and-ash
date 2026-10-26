import { worldAdmin } from './world-admin';
import { Hono } from 'hono';
import { parseItemOverrides } from '@acorn/shared';
import { signedInAccount, type Account } from './accounts/session';
import type { WebEnv } from './env';

/** A verified Google identity; neither a test player nor a matching unverified address can administer items. */
export async function canEditItems(account: Account | null, env: WebEnv): Promise<boolean> {
  const owner = env.ADMIN_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || account?.kind !== 'member') return false;
  const row = await env.DB.prepare(
    `SELECT u.email, u.email_verified, u.is_anonymous FROM user u
    WHERE u.id = ? AND EXISTS (SELECT 1 FROM account a WHERE a.user_id = u.id AND a.provider_id = 'google')`,
  )
    .bind(account.id)
    .first<{ email: string; email_verified: number; is_anonymous: number }>();
  return (
    row !== null &&
    row.email_verified === 1 &&
    row.is_anonymous === 0 &&
    row.email.trim().toLowerCase() === owner
  );
}
export const itemAdmin = new Hono<{ Bindings: WebEnv }>();
for (const path of ['/api/admin/*', '/admin', '/admin/*', '/admin.html'])
  itemAdmin.use(path, async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('Vary', 'Cookie');
    c.header('X-Content-Type-Options', 'nosniff');
    if (!(await canEditItems(await signedInAccount(c.req.raw, c.env), c.env)))
      return c.json({ error: 'Administrator access is restricted' }, 403);
    if (c.req.method !== 'GET' && c.req.header('Origin') !== new URL(c.req.url).origin)
      return c.json({ error: 'Not from this site' }, 403);
    await next();
  });
itemAdmin.route('/', worldAdmin);
function catalogue(env: WebEnv) {
  return env.ITEM_CATALOG.get(env.ITEM_CATALOG.idFromName('items'));
}
itemAdmin.get('/api/admin/items', async (c) => c.json(await catalogue(c.env).adminState()));
itemAdmin.post('/api/admin/items/:action', async (c) => {
  if (!['draft', 'publish'].includes(c.req.param('action')))
    return c.json({ error: 'Not found' }, 404);
  // Bound streamed bodies as well as Content-Length; reject before JSON allocation grows indefinitely.
  const reader = c.req.raw.body?.getReader();
  if (!reader) return c.json({ error: 'Missing body' }, 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 256_000) {
      await reader.cancel();
      return c.json({ error: 'Catalogue is too large' }, 413);
    }
    chunks.push(value);
  }
  let body: { draftRevision?: unknown; publishedRevision?: unknown; overrides?: unknown };
  try {
    body = JSON.parse(await new Blob(chunks).text());
    if (body === null || typeof body !== 'object') throw new Error();
  } catch {
    return c.json({ error: 'Invalid request' }, 400);
  }
  if (!Number.isSafeInteger(body.draftRevision) || (body.draftRevision as number) < 0)
    return c.json({ error: 'Invalid draft revision' }, 400);
  const actor = (await signedInAccount(c.req.raw, c.env))!;
  let state;
  if (c.req.param('action') === 'draft') {
    let overrides;
    try {
      overrides = parseItemOverrides(body.overrides);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Invalid item' }, 400);
    }
    state = await catalogue(c.env).saveDraft(body.draftRevision as number, overrides, actor.id);
  } else {
    if (!Number.isSafeInteger(body.publishedRevision) || (body.publishedRevision as number) < 0)
      return c.json({ error: 'Invalid published revision' }, 400);
    state = await catalogue(c.env).publish(
      body.draftRevision as number,
      body.publishedRevision as number,
      actor.id,
    );
  }
  return state === null
    ? c.json(
        { error: 'The catalogue changed in another tab. Reload before saving or publishing.' },
        409,
      )
    : c.json(state);
});
for (const path of [
  '/admin',
  '/admin/',
  '/admin/items',
  '/admin/items/',
  '/admin/worlds',
  '/admin/worlds/',
  '/admin.html',
]) {
  itemAdmin.get(path, async (c) => {
    const url = new URL('/admin.html', c.req.url);
    const asset = await c.env.ASSETS.fetch(new Request(url));
    const headers = new Headers(asset.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Vary', 'Cookie');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(asset.body, { status: asset.status, headers });
  });
}
