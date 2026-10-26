import { Hono } from 'hono';
import type { AdminWorldStatus, WorldResetChallenge, WorldResetResult } from '@acorn/shared';
interface WorldAdminRpc {
  inspectForAdmin(id: string): Promise<AdminWorldStatus>;
  prepareAdminReset(
    id: string,
    actor: string,
    origin: string,
  ): Promise<WorldResetResult<WorldResetChallenge>>;
  resetForAdmin(
    id: string,
    actor: string,
    origin: string,
    token: string,
    confirmation: string,
  ): Promise<WorldResetResult<AdminWorldStatus>>;
}
import { signedInAccount } from './accounts/session';
import { isValidWorldId } from './worlds';
import type { WebEnv } from './env';
/** Mounted beneath the existing verified-owner and same-origin admin middleware. */
export const worldAdmin = new Hono<{ Bindings: WebEnv }>();
function world(env: WebEnv, id: string) {
  return env.WORLD.get(env.WORLD.idFromName(id)) as unknown as WorldAdminRpc;
}
worldAdmin.get('/api/admin/worlds/:worldId', async (c) => {
  const id = c.req.param('worldId');
  if (!isValidWorldId(id)) return c.json({ error: 'Invalid world ID' }, 400);
  return c.json(await world(c.env, id).inspectForAdmin(id));
});
worldAdmin.post('/api/admin/worlds/:worldId/:action', async (c) => {
  const id = c.req.param('worldId'),
    action = c.req.param('action');
  if (!isValidWorldId(id) || !['prepare-reset', 'reset'].includes(action))
    return c.json({ error: 'Not found' }, 404);
  if (c.req.header('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
    return c.json({ error: 'Send JSON' }, 415);
  const reader = c.req.raw.body?.getReader();
  if (!reader) return c.json({ error: 'Missing body' }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) {
      await reader.cancel();
      return c.json({ error: 'Request too large' }, 413);
    }
    chunks.push(value);
  }
  let body: { token?: unknown; confirmation?: unknown };
  try {
    body = JSON.parse(await new Blob(chunks).text());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch {
    return c.json({ error: 'Invalid request' }, 400);
  }
  const actor = await signedInAccount(c.req.raw, c.env);
  if (!actor) return c.json({ error: 'Administrator access required' }, 403);
  const stub = world(c.env, id),
    origin = new URL(c.req.url).origin;
  if (action === 'prepare-reset') {
    const result = await stub.prepareAdminReset(id, actor.id, origin);
    return result.ok ? c.json(result.value) : c.json({ error: result.error }, 409);
  }
  if (
    typeof body.token !== 'string' ||
    body.token.length > 100 ||
    typeof body.confirmation !== 'string' ||
    body.confirmation !== `RESET ${id}`
  )
    return c.json({ error: 'Type the exact world confirmation' }, 400);
  const result = await stub.resetForAdmin(id, actor.id, origin, body.token, body.confirmation);
  return result.ok ? c.json(result.value) : c.json({ error: result.error }, 409);
});
