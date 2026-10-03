import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { PlayerButton, itemIndex, type WorldSimulation } from '@acorn/shared';
import { TestClient, waitFor, sleep } from './helpers';

it('saves personal discovery rewards, recipe knowledge and inventory together and restores them after world sleep', async () => {
  const worldId = `discoveries-${Date.now()}`;
  const one = await TestClient.connect(worldId, 'discovery-one');
  const two = await TestClient.connect(worldId, 'discovery-two');
  await waitFor('both live', () => one.snapshots().length > 0 && two.snapshots().length > 0);
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    const site = sim.discoverySites.find((s) => s.kind === 'grove')!;
    sim.placePlayer(one.welcome().netId, { x: site.x, y: 0, z: site.z }, 0);
  });
  one.walk(0, 0, 0, 2, PlayerButton.Interact);
  await waitFor('personal discovery reward', () =>
    one.received.some((m) => m.type === 'discoveries' && m.claimed === 4),
  );
  expect(two.received.some((m) => m.type === 'discoveries' && m.found !== 0)).toBe(false);
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec<{ found: number; claimed: number }>(
          'SELECT found, claimed FROM player_discoveries WHERE player_key=?',
          'discovery-one',
        )
        .one(),
    ).toMatchObject({ found: 4, claimed: 4 });
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          'SELECT count FROM player_items WHERE player_key=? AND item_index=?',
          'discovery-one',
          itemIndex('mushroom'),
        )
        .one().count,
    ).toBe(6);
  });
  one.walk(0, 0, 0, 1);
  one.walk(0, 0, 0, 1, PlayerButton.Interact);
  await sleep(150);
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    expect(sim.inventoryOf(one.welcome().netId).mushroom).toBe(6);
  });
  one.close();
  two.close();
  await sleep(300);
  await runInDurableObject(stub, (instance) => {
    expect((instance as unknown as { simulation: WorldSimulation | null }).simulation).toBeNull();
  });
  const returning = await TestClient.connect(worldId, 'discovery-one');
  await waitFor('saved discovery state', () =>
    returning.received.some((m) => m.type === 'discoveries' && m.claimed === 4),
  );
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    expect(sim.inventoryOf(returning.welcome().netId).mushroom).toBe(6);
    expect(sim.discoveryStateOf(returning.welcome().netId)).toMatchObject({ found: 4, claimed: 4 });
  });
  returning.close();
}, 30_000);
