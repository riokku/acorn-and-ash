import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  HOME_WAKE_SPOT,
  buildableKindIndex,
  itemIndex,
  type ChestStateMessage,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';

const lastChest = (client: TestClient): ChestStateMessage | undefined =>
  client.received
    .filter((message): message is ChestStateMessage => message.type === 'chest')
    .at(-1);

it('saves both sides of a chest transfer immediately, survives an empty world, and keeps contents private', async () => {
  const worldId = `chest-${Date.now()}`;
  const owner = await TestClient.connect(worldId, 'chest-owner');
  await waitFor('owner welcome', () =>
    owner.received.some((message) => message.type === 'welcome'),
  );
  const id = owner.welcome().netId;
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance, state) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    sim.restoreBuiltProps([
      {
        id: 7,
        kind: 'cabin',
        x: 0,
        z: -20,
        yaw: 0,
        lit: false,
        ownerKey: 'chest-owner',
        litUntilMs: null,
      },
    ]);
    state.storage.sql.exec(
      'INSERT INTO built_props (id,kind_index,x,z,yaw,built_at_ms,owner_key) VALUES (?,?,?,?,?,?,?)',
      7,
      buildableKindIndex('cabin'),
      0,
      -20,
      0,
      Date.now(),
      'chest-owner',
    );
    sim.placePlayer(id, { x: HOME_WAKE_SPOT.x, y: 0, z: HOME_WAKE_SPOT.z }, HOME_WAKE_SPOT.yaw, 7);
    Object.assign(sim.inventoryOf(id), { log: 12 });
  });
  owner.chest({ action: 'deposit', item: 'log', amount: 12 });
  await waitFor('deposit acknowledgement', () => lastChest(owner)?.moved === 12);
  expect(lastChest(owner)?.slots[0]).toEqual({ item: 'log', count: 10 });
  expect(lastChest(owner)?.slots[1]).toEqual({ item: 'log', count: 2 });
  await runInDurableObject(stub, (_instance, state) => {
    const chest = state.storage.sql
      .exec<{ slots: string }>('SELECT slots FROM home_chests WHERE home_id=7')
      .one();
    expect(JSON.parse(chest.slots)[0]).toEqual({ item: 'log', count: 10 });
    const pack = state.storage.sql
      .exec(
        'SELECT * FROM player_items WHERE player_key=? AND item_index=?',
        'chest-owner',
        itemIndex('log'),
      )
      .toArray();
    expect(pack).toHaveLength(0);
  });
  const visitor = await TestClient.connect(worldId, 'chest-visitor');
  await waitFor('visitor welcome', () =>
    visitor.received.some((message) => message.type === 'welcome'),
  );
  const visitorId = visitor.welcome().netId;
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    sim.placePlayer(
      visitorId,
      { x: HOME_WAKE_SPOT.x, y: 0, z: HOME_WAKE_SPOT.z },
      HOME_WAKE_SPOT.yaw,
      7,
    );
  });
  visitor.chest({ action: 'withdraw', slot: 0, amount: 10 });
  await waitFor('private refusal', () => lastChest(visitor)?.reason === 'private');
  expect(lastChest(visitor)?.slots.every((slot) => slot === null)).toBe(true);
  expect(visitor.received.filter((message) => message.type === 'chest')).toHaveLength(1);
  visitor.close();
  owner.close();
  await sleep(300);

  const returned = await TestClient.connect(worldId, 'chest-owner');
  await waitFor('return welcome', () =>
    returned.received.some((message) => message.type === 'welcome'),
  );
  returned.chest({ action: 'open' });
  await waitFor('saved chest', () => lastChest(returned)?.slots[0]?.count === 10);
  returned.chest({ action: 'withdraw', slot: 0, amount: 3 });
  await waitFor('withdraw acknowledgement', () => lastChest(returned)?.moved === 3);
  expect(lastChest(returned)?.slots[0]).toEqual({ item: 'log', count: 7 });
  expect(returned.inventory()).toContainEqual({ item: 'log', count: 3 });
  returned.close();
});
