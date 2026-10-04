import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  encodeExpeditionRequest,
  emptyExpedition,
  EXPEDITIONS,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
const latest = (client: TestClient) =>
  client.received.filter((m) => m.type === 'expedition').at(-1);
it('keeps accepted outings private, saves claims atomically and restores them after reconnect', async () => {
  const worldId = `expedition-${Date.now()}`,
    owner = await TestClient.connect(worldId, 'trail-owner'),
    visitor = await TestClient.connect(worldId, 'trail-visitor');
  await waitFor('owner state', () => latest(owner) !== undefined);
  await waitFor('visitor state', () => latest(visitor) !== undefined);
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId)),
    id = owner.welcome().netId;
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    sim.restoreBuiltProps([
      {
        id: 7,
        kind: 'tent',
        x: 0,
        z: -5,
        yaw: 0,
        lit: false,
        litUntilMs: null,
        ownerKey: 'trail-owner',
      },
    ]);
    sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0, 7);
    sim.placePlayer(visitor.welcome().netId, { x: 0, y: 0, z: 0 }, 0, 7);
  });
  visitor.sendRaw(encodeExpeditionRequest({ action: 'accept', index: 0 }));
  await waitFor('visitor refused', () => latest(visitor)?.notice === 'away');
  owner.sendRaw(encodeExpeditionRequest({ action: 'accept', index: 0 }));
  await waitFor(
    'accepted',
    () => latest(owner)?.active !== null && latest(owner)?.notice === 'accepted',
  );
  await runInDurableObject(stub, (instance, state) => {
    const saved = JSON.parse(
      state.storage.sql
        .exec<{ state: string }>(
          'SELECT state FROM player_expeditions WHERE player_key=?',
          'trail-owner',
        )
        .one().state,
    );
    expect(saved.active).toBe(latest(owner)?.active);
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    const player = sim.persistablePlayers().find((p) => p.netId === id)!;
    sim.removePlayer(id);
    sim.addPlayer(
      id,
      {
        ...player,
        expedition: {
          ...emptyExpedition(),
          active: 0,
          completed: 2,
          cycle: 2,
          progress: EXPEDITIONS[0]!.objectives.map((g) => g.goal),
        },
      },
      'trail-owner',
    );
    sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0, 7);
  });
  owner.sendRaw(encodeExpeditionRequest({ action: 'claim' }));
  await waitFor('claim', () => latest(owner)?.completed === 3);
  owner.sendRaw(encodeExpeditionRequest({ action: 'claim' }));
  await waitFor('duplicate refused', () => latest(owner)?.notice === 'unfinished');
  await runInDurableObject(stub, (_instance, state) => {
    const saved = JSON.parse(
      state.storage.sql
        .exec<{ state: string }>(
          'SELECT state FROM player_expeditions WHERE player_key=?',
          'trail-owner',
        )
        .one().state,
    );
    expect(saved).toMatchObject({ active: null, completed: 3, cycle: 3, cosmetics: 1 });
    const items = state.storage.sql
      .exec<{ count: number }>('SELECT count FROM player_items WHERE player_key=?', 'trail-owner')
      .toArray();
    expect(items.map((row) => row.count).sort()).toEqual([4, 6]);
  });
  expect(
    visitor.received
      .filter((m) => m.type === 'expedition')
      .every((m) => m.active === null && m.completed === 0),
  ).toBe(true);
  owner.close();
  await sleep(250);
  const returned = await TestClient.connect(worldId, 'trail-owner');
  await waitFor('restored reward', () => latest(returned)?.completed === 3);
  expect(latest(returned)?.cosmetics).toBe(1);
  expect(returned.inventory()).toEqual(
    expect.arrayContaining([
      { item: 'log', count: 6 },
      { item: 'stick', count: 4 },
    ]),
  );
  returned.close();
  visitor.close();
  await sleep(250);
});
