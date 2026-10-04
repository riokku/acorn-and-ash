import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { createInput, PlayerButton, itemIndex, type WorldSimulation } from '@acorn/shared';
import { TestClient, waitFor, sleep } from './helpers';
it('saves partial recovery and the remaining cache together, with private markers after reconnect', async () => {
  const worldId = `recovery-${Date.now()}`,
    owner = await TestClient.connect(worldId, 'recovery-owner');
  await waitFor('welcome', () => owner.received.some((message) => message.type === 'welcome'));
  const id = owner.welcome().netId,
    stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance, state) => {
    const world = instance as unknown as {
      simulation: WorldSimulation;
      announceBuriedCaches(sim: WorldSimulation): void;
    };
    const sim = world.simulation;
    sim.restoreBuriedCaches([
      {
        id: 70000,
        ownerPlayerKey: 'recovery-owner',
        x: 0,
        z: 10,
        items: [{ item: 'log', count: 4 }],
      },
    ]);
    sim.placePlayer(id, { x: 0, y: 0, z: 10 }, 0);
    Object.assign(sim.inventoryOf(id), { log: 58 });
    sim.queueInput(id, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(Date.now());
    world.announceBuriedCaches(sim);
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          'SELECT count FROM player_items WHERE player_key=? AND item_index=?',
          'recovery-owner',
          itemIndex('log'),
        )
        .one().count,
    ).toBe(60);
    expect(
      state.storage.sql
        .exec<{ count: number }>('SELECT count FROM buried_cache_items WHERE cache_id=70000')
        .one().count,
    ).toBe(2);
  });
  await waitFor('partial notice', () =>
    owner.received.some((message) => message.type === 'cache' && message.event.kind === 'partial'),
  );
  const visitor = await TestClient.connect(worldId, 'recovery-visitor');
  await waitFor('private markers', () =>
    visitor.received.some((message) => message.type === 'recoveryMarkers'),
  );
  expect(
    visitor.received
      .filter((message) => message.type === 'recoveryMarkers')
      .every((message) => message.type === 'recoveryMarkers' && message.caches.length === 0),
  ).toBe(true);
  visitor.close();
  owner.close();
  await sleep(300);
  const returned = await TestClient.connect(worldId, 'recovery-owner');
  await waitFor('saved marker', () =>
    returned.received.some(
      (message) =>
        message.type === 'recoveryMarkers' && message.caches.some((cache) => cache.id === 70000),
    ),
  );
  expect(returned.inventory()).toContainEqual({ item: 'log', count: 60 });
  returned.close();
});
