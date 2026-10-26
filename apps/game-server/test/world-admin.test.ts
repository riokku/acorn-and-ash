import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { buildableKindIndex, itemIndex } from '@acorn/shared';
import { TestClient, waitFor, sleep } from './helpers';
const ORIGIN = 'https://owner.example',
  ACTOR = 'verified-owner';
const stubFor = (id: string) => env.WORLD.get(env.WORLD.idFromName(id));
it('atomically resets all world content, preserves map seed, other worlds and audit history, and consumes proof once', async () => {
  const id = 'admin-reset-isolated',
    stub = stubFor(id),
    other = stubFor('admin-reset-neighbor');
  await runInDurableObject(other, (_instance, state) =>
    state.storage.sql.exec("INSERT INTO world_meta VALUES ('neighbor-marker','keep')").toArray(),
  );
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    sql.exec(
      "INSERT INTO players (player_key,x,y,z,facing_yaw,updated_at,name) VALUES ('reset-owner',0,0,0,0,1,'Tester')",
    );
    sql.exec('INSERT INTO player_items VALUES (?,?,?)', 'reset-owner', itemIndex('axe'), 1);
    sql.exec(
      'INSERT INTO built_props (id,kind_index,x,z,built_at_ms,owner_key) VALUES (1,?,0,0,1,?)',
      buildableKindIndex('cabin'),
      'reset-owner',
    );
    sql.exec("INSERT INTO home_chests VALUES (1,'[]')");
    sql.exec("INSERT INTO home_gardens VALUES (1,'[]')");
    sql.exec('CREATE TABLE future_world_content (id INTEGER PRIMARY KEY, value TEXT)');
    sql.exec("INSERT INTO future_world_content VALUES (1,'clear')");
    sql.exec(
      "INSERT OR REPLACE INTO world_meta VALUES ('staging-build-reset','keep-marker'),('wildfire','old-fire'),('tick','300')",
    );
  });
  const catalogue = env.ITEM_CATALOG.get(env.ITEM_CATALOG.idFromName('items'));
  const state = await catalogue.adminState();
  await catalogue.saveDraft(
    state.draft.revision,
    { axe: { displayName: 'Owner reset test axe' } },
    ACTOR,
  );
  await catalogue.publish(state.draft.revision + 1, state.published.revision, ACTOR);
  const published = await catalogue.published();
  const before = await stub.inspectForAdmin(id);
  expect(before).toMatchObject({
    players: 0,
    savedCharacters: 1,
    builtStructures: 1,
    canReset: true,
  });
  const prepared = await stub.prepareAdminReset(id, ACTOR, ORIGIN);
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new Error(prepared.error);
  const { token, confirmation } = prepared.value;
  expect(
    (
      await other.resetForAdmin(
        'admin-reset-neighbor',
        ACTOR,
        ORIGIN,
        token,
        'RESET admin-reset-neighbor',
      )
    ).ok,
  ).toBe(false);
  expect((await stub.resetForAdmin(id, 'wrong-owner', ORIGIN, token, confirmation)).ok).toBe(false);
  expect(
    (await stub.resetForAdmin(id, ACTOR, 'https://other.example', token, confirmation)).ok,
  ).toBe(false);
  expect((await stub.resetForAdmin(id, ACTOR, ORIGIN, token, 'RESET wrong-world')).ok).toBe(false);
  expect((await stub.inspectForAdmin(id)).savedCharacters).toBe(1);
  const reset = await stub.resetForAdmin(id, ACTOR, ORIGIN, token, confirmation);
  expect(reset.ok).toBe(true);
  if (!reset.ok) throw new Error(reset.error);
  expect(reset.value).toMatchObject({
    seed: before.seed,
    players: 0,
    savedCharacters: 0,
    builtStructures: 0,
  });
  expect(await catalogue.published()).toEqual(published);
  expect(reset.value.history).toHaveLength(1);
  expect(reset.value.history[0]).toMatchObject({ characters: 1, structures: 1 });
  expect((await stub.resetForAdmin(id, ACTOR, ORIGIN, token, confirmation)).ok).toBe(false);
  await runInDurableObject(stub, (_instance, state) => {
    for (const table of [
      'players',
      'player_items',
      'built_props',
      'home_chests',
      'home_gardens',
      'future_world_content',
    ])
      expect(state.storage.sql.exec(`SELECT * FROM ${table}`).toArray()).toEqual([]);
    expect(
      state.storage.sql.exec("SELECT value FROM world_meta WHERE key='staging-build-reset'").one(),
    ).toEqual({ value: 'keep-marker' });
    expect(
      state.storage.sql.exec("SELECT * FROM world_meta WHERE key IN ('wildfire','tick')").toArray(),
    ).toEqual([]);
  });
  await runInDurableObject(other, (_instance, state) =>
    expect(
      state.storage.sql.exec("SELECT value FROM world_meta WHERE key='neighbor-marker'").one(),
    ).toEqual({ value: 'keep' }),
  );
});
it('expires proof, invalidates it on a new connection, refuses occupied worlds, and ignores stale pre-reset socket callbacks', async () => {
  const id = 'admin-reset-connections',
    stub = stubFor(id);
  let prepared = await stub.prepareAdminReset(id, ACTOR, ORIGIN);
  if (!prepared.ok) throw new Error(prepared.error);
  const expired = prepared.value;
  await runInDurableObject(stub, (_instance, state) => {
    const row = state.storage.sql
      .exec<{ value: string }>("SELECT value FROM world_admin_control WHERE key='pending-reset'")
      .one();
    const proof = JSON.parse(row.value);
    proof.expiresAt = Date.now() - 1;
    state.storage.sql.exec(
      "UPDATE world_admin_control SET value=? WHERE key='pending-reset'",
      JSON.stringify(proof),
    );
  });
  expect(
    (await stub.resetForAdmin(id, ACTOR, ORIGIN, expired.token, expired.confirmation)).ok,
  ).toBe(false);
  prepared = await stub.prepareAdminReset(id, ACTOR, ORIGIN);
  if (!prepared.ok) throw new Error(prepared.error);
  const oldProof = prepared.value;
  const client = await TestClient.connect(id, 'admin-connection-owner');
  await waitFor('welcome', () => client.received.some((m) => m.type === 'welcome'));
  const attachment = await runInDurableObject(stub, (_instance, state) =>
    state.getWebSockets()[0]!.deserializeAttachment(),
  );
  expect((await stub.prepareAdminReset(id, ACTOR, ORIGIN)).ok).toBe(false);
  expect(
    (await stub.resetForAdmin(id, ACTOR, ORIGIN, oldProof.token, oldProof.confirmation)).ok,
  ).toBe(false);
  client.close();
  await sleep(300);
  await expect.poll(async () => (await stub.inspectForAdmin(id)).canReset).toBe(true);
  expect(
    (await stub.resetForAdmin(id, ACTOR, ORIGIN, oldProof.token, oldProof.confirmation)).ok,
  ).toBe(false);
  prepared = await stub.prepareAdminReset(id, ACTOR, ORIGIN);
  if (!prepared.ok) throw new Error(prepared.error);
  expect(
    (await stub.resetForAdmin(id, ACTOR, ORIGIN, prepared.value.token, prepared.value.confirmation))
      .ok,
  ).toBe(true);
  await runInDurableObject(stub, (instance, state) => {
    const oldSocket = {
      deserializeAttachment: () => attachment,
      close: () => {},
    } as unknown as WebSocket;
    instance.webSocketMessage(oldSocket, new Uint8Array([1]).buffer);
    instance.webSocketClose(oldSocket, 1000, 'late close');
    expect(instance.status().players).toBe(0);
    expect(state.storage.sql.exec('SELECT * FROM players').toArray()).toEqual([]);
  });
});
it('does not expose reset commands through the public game-server HTTP routes', async () => {
  const id = 'admin-reset-http',
    stub = stubFor(id);
  const response = await stub.fetch(
    new Request('https://world/reset-players?confirm=clear-everyone'),
  );
  expect(response.status).toBe(426);
  const rpcPath = await stub.fetch(
    new Request('https://world/resetForAdmin', { method: 'POST', body: '{}' }),
  );
  expect(rpcPath.status).toBe(426);
  await runInDurableObject(stub, (instance) =>
    expect(() => instance.inspectForAdmin('different-world')).toThrow('World identity mismatch'),
  );
});
