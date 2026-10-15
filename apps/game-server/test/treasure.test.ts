import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  createInput,
  PlayerButton,
  itemIndex,
  type BuriedTreasure,
  type WorldSimulation,
  type ServerMessage,
} from '@acorn/shared';
import { TestClient, waitFor } from './helpers';

function spots(client: TestClient) {
  return client.received
    .filter(
      (message): message is Extract<ServerMessage, { type: 'treasure' }> =>
        message.type === 'treasure',
    )
    .at(-1)?.spots;
}

it('persists treasure and inventory together, sharing mounds but keeping recovery markers private', async () => {
  const worldId = `treasure-${Date.now()}`;
  const owner = await TestClient.connect(worldId, 'treasure-digger');
  await waitFor('treasure positions', () => spots(owner) !== undefined);
  expect(spots(owner)).toHaveLength(24);
  const visitor = await TestClient.connect(worldId, 'treasure-visitor');
  await waitFor('visitor treasure positions', () => spots(visitor) !== undefined);
  expect(spots(visitor)).toEqual(spots(owner));
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  const id = owner.welcome().netId;
  await runInDurableObject(stub, (instance, state) => {
    const world = instance as unknown as {
      simulation: WorldSimulation;
      announceTreasure(sim: WorldSimulation): void;
    };
    const sim = world.simulation;
    sim.initializeTreasures([{ id: 1, x: 0, z: 10, items: [{ item: 'log', count: 4 }] }]);
    const inventory = sim.inventoryOf(id);
    for (const key of Object.keys(inventory)) delete inventory[key as keyof typeof inventory];
    Object.assign(inventory, { shovel: 1, log: 18, axe: 1, rod: 1, torch: 1 });
    sim.useItem(id, 'shovel');
    sim.placePlayer(id, { x: 0, y: 0, z: 10 }, 0);
    sim.queueInput(id, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(Date.now());
    world.announceTreasure(sim);
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          'SELECT count FROM player_items WHERE player_key=? AND item_index=?',
          'treasure-digger',
          itemIndex('log'),
        )
        .one().count,
    ).toBe(20);
    const remaining = JSON.parse(
      state.storage.sql
        .exec<{ value: string }>('SELECT value FROM world_meta WHERE key=?', 'buried-treasure-v1')
        .one().value,
    ) as BuriedTreasure[];
    expect(remaining[0]?.items).toEqual([{ item: 'log', count: 2 }]);
  });
  await waitFor('partial treasure notice', () =>
    owner.cacheNews().some((event) => event.kind === 'treasurePartial'),
  );
  await waitFor('shared remaining mound', () => spots(visitor)?.length === 1);
  expect(visitor.cacheNews()).toEqual([]);
  expect(
    visitor.received
      .filter((message) => message.type === 'recoveryMarkers')
      .every((message) => message.type === 'recoveryMarkers' && message.caches.length === 0),
  ).toBe(true);
  owner.close();
  visitor.close();
  await waitFor(
    'all clients disconnected',
    () => owner.closedWith !== null && visitor.closedWith !== null,
  );
  // Discard the in-memory simulation to exercise the same SQLite restore path as a sleeping world.
  await runInDurableObject(stub, (instance) => {
    const world = instance as unknown as { simulation: WorldSimulation | null };
    world.simulation?.dispose();
    world.simulation = null;
  });
  const returned = await TestClient.connect(worldId, 'treasure-digger');
  await waitFor('restored treasure', () => spots(returned) !== undefined);
  expect(spots(returned)).toEqual([{ id: 1, x: 0, z: 10 }]);
  expect(returned.inventory()).toContainEqual({ item: 'log', count: 20 });
  await runInDurableObject(stub, (instance, state) => {
    const world = instance as unknown as {
      simulation: WorldSimulation;
      announceTreasure(sim: WorldSimulation): void;
    };
    const sim = world.simulation;
    const returningId = returned.welcome().netId;
    delete sim.inventoryOf(returningId).axe;
    sim.useItem(returningId, 'shovel');
    expect(sim.equippedItemOf(returningId)).toBe('shovel');
    sim.placePlayer(returned.welcome().netId, { x: 0, y: 0, z: 10 }, 0);
    sim.queueInput(returned.welcome().netId, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(Date.now());
    expect(sim.treasureSpots()).toEqual([]);
    world.announceTreasure(sim);
    expect(
      JSON.parse(
        state.storage.sql
          .exec<{ value: string }>('SELECT value FROM world_meta WHERE key=?', 'buried-treasure-v1')
          .one().value,
      ),
    ).toEqual([]);
  });
  await waitFor('empty treasure world', () => spots(returned)?.length === 0);
  returned.close();
});
