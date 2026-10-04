import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { type WorldSimulation, itemIndex } from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
it('saves contributor keepsakes with victory flags, keeps rewards private and never repeats first trophies', async () => {
  const worldId = `sentinel-${Date.now()}`,
    owner = await TestClient.connect(worldId, 'sentinel-owner'),
    visitor = await TestClient.connect(worldId, 'sentinel-visitor');
  await waitFor(
    'welcome',
    () =>
      owner.received.some((m) => m.type === 'welcome') &&
      visitor.received.some((m) => m.type === 'welcome'),
  );
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId)),
    id = owner.welcome().netId;
  const win = async () =>
    runInDurableObject(stub, (instance) => {
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0);
      sim.placePlayer(visitor.welcome().netId, { x: 3, y: 0, z: 0 }, 0);
      sim.step(Date.now());
      const raid = sim.startRaid(id, ['sentinel'])!,
        boss = sim.raids.raidersOf(raid)[0]!;
      for (let blow = 0; blow < 6; blow++) {
        sim.raids.placeRaider(boss, { x: 0, y: 0, z: -1.3 }, Math.PI);
        sim.raids.blowLands(id, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0);
      }
      expect(sim.sentinelVictoriesOf(id)).toBeGreaterThan(0);
    });
  await win();
  await waitFor('protected trophy', () =>
    owner.droppedPiles().some((p) => p.item === 'sentinelTrophy'),
  );
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec<{ victories: number }>(
          'SELECT victories FROM player_sentinel WHERE player_key=?',
          'sentinel-owner',
        )
        .one().victories,
    ).toBe(1);
    expect(
      state.storage.sql
        .exec(
          'SELECT * FROM dropped_piles WHERE owner_key=? AND item_index=?',
          'sentinel-owner',
          itemIndex('sentinelTrophy'),
        )
        .toArray(),
    ).toHaveLength(1);
  });
  expect(visitor.droppedPiles().filter((p) => p.item === 'sentinelTrophy')).toHaveLength(0);
  owner.close();
  await sleep(250);
  const returned = await TestClient.connect(worldId, 'sentinel-owner');
  await waitFor('reconnect', () => returned.received.some((m) => m.type === 'welcome'));
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation,
      id = returned.welcome().netId;
    expect(sim.sentinelVictoriesOf(id)).toBe(1);
    sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0);
    sim.step(Date.now());
    const raid = sim.startRaid(id, ['sentinel'])!,
      boss = sim.raids.raidersOf(raid)[0]!;
    for (let blow = 0; blow < 6; blow++) {
      sim.raids.placeRaider(boss, { x: 0, y: 0, z: -1.3 }, Math.PI);
      sim.raids.blowLands(id, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0);
    }
    expect(sim.raids.raidersList().find((r) => r.id === boss)?.hitsLeft).toBe(0);
    expect(sim.sentinelVictoriesOf(id)).toBe(2);
    expect(sim.droppedPilesList(id).filter((p) => p.item === 'log')).toHaveLength(2);
  });
  await waitFor(
    'repeat materials',
    () => returned.droppedPiles().filter((p) => p.item === 'log').length === 2,
  );
  expect(returned.droppedPiles().filter((p) => p.item === 'sentinelTrophy')).toHaveLength(1);
  returned.close();
  visitor.close();
  await sleep(250);
});
