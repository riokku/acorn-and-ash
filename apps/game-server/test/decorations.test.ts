import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { encodeDecorationRequest, type WorldSimulation, type HomeDecoration } from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
it('saves private placement, movement and material reclamation with the backpack', async () => {
  const worldId = `decor-${Date.now()}`,
    owner = await TestClient.connect(worldId, 'decor-owner');
  await waitFor('welcome', () => owner.received.some((message) => message.type === 'welcome'));
  const visitor = await TestClient.connect(worldId, 'decor-visitor');
  await waitFor('visitor welcome', () =>
    visitor.received.some((message) => message.type === 'welcome'),
  );
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId)),
    id = owner.welcome().netId;
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    sim.restoreBuiltProps([
      {
        id: 7,
        kind: 'cabin',
        x: 0,
        z: -5,
        yaw: 0,
        ownerKey: 'decor-owner',
        lit: false,
        litUntilMs: null,
      },
    ]);
    sim.placePlayer(id, { x: 0, y: 0, z: 2 }, 0, 7);
    sim.placePlayer(visitor.welcome().netId, { x: 0, y: 0, z: 2 }, 0, 7);
    Object.assign(sim.inventoryOf(id), { log: 4, stick: 2 });
  });
  const place = {
    action: 'place' as const,
    kind: 'cedarBench' as const,
    id: 0,
    x: -0.5,
    z: -0.125,
    yaw: 0,
  };
  visitor.sendRaw(encodeDecorationRequest(place));
  await waitFor('private refusal', () =>
    visitor.received.some(
      (message) => message.type === 'decoration' && message.reason === 'private',
    ),
  );
  owner.sendRaw(encodeDecorationRequest(place));
  await waitFor('placement', () =>
    owner.received.some((message) => message.type === 'decoration' && message.pieces.length === 1),
  );
  let piece: HomeDecoration | undefined;
  await runInDurableObject(stub, (_instance, state) => {
    const rows = state.storage.sql
      .exec<{ value: string }>("SELECT value FROM world_meta WHERE key='home-decorations'")
      .toArray();
    piece = (JSON.parse(rows[0]!.value) as HomeDecoration[])[0];
    expect(piece?.kind).toBe('cedarBench');
    expect(
      state.storage.sql
        .exec('SELECT * FROM player_items WHERE player_key=?', 'decor-owner')
        .toArray(),
    ).toEqual([]);
  });
  owner.sendRaw(encodeDecorationRequest({ ...piece!, action: 'move', x: 0, z: -1.1, yaw: 1 }));
  await waitFor('movement', () =>
    owner.received.some((message) => message.type === 'decoration' && message.pieces[0]?.yaw === 1),
  );
  owner.sendRaw(encodeDecorationRequest({ ...piece!, action: 'reclaim' }));
  await waitFor('reclaimed', () =>
    owner.received.some(
      (message) =>
        message.type === 'decoration' && message.pieces.length === 0 && message.reason === null,
    ),
  );
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec<{ value: string }>("SELECT value FROM world_meta WHERE key='home-decorations'")
        .one().value,
    ).toBe('[]');
    expect(
      state.storage.sql
        .exec('SELECT * FROM player_items WHERE player_key=?', 'decor-owner')
        .toArray(),
    ).toHaveLength(2);
  });
  owner.close();
  visitor.close();
  await sleep(250);
});
