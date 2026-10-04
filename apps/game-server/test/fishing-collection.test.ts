import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  type WorldSimulation,
  POND,
  PlayerButton,
  createInput,
  fishOnTheLine,
} from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
it('saves landed and released fish privately with inventory and restores the character collection', async () => {
  const worldId = `fish-records-${Date.now()}`,
    angler = await TestClient.connect(worldId, 'record-angler'),
    visitor = await TestClient.connect(worldId, 'record-visitor');
  await waitFor(
    'welcomes',
    () =>
      angler.received.some((m) => m.type === 'welcome') &&
      visitor.received.some((m) => m.type === 'welcome'),
  );
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId)),
    id = angler.welcome().netId;
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation,
      pool = POND[0]!,
      pos = { x: pool.x - pool.radius - 0.5, y: 0, z: pool.z },
      yaw = -Math.PI / 2;
    const saved = sim.persistablePlayers().find((p) => p.netId === id)!;
    sim.removePlayer(id);
    sim.addPlayer(
      id,
      {
        ...saved,
        items: [
          { item: 'rod', count: 1 },
          { item: 'perch', count: 30 },
          { item: 'trout', count: 20 },
        ],
        equippedItem: 'rod',
      },
      'record-angler',
    );
    sim.placePlayer(id, pos, yaw);
    let seq = sim.lastProcessedSeq(id);
    const tick = (clicked = false, saw = false) => {
      sim.queueInput(
        id,
        createInput(
          ++seq,
          0,
          0,
          yaw,
          (clicked ? PlayerButton.Fish : 0) | (saw ? PlayerButton.SawBite : 0),
        ),
      );
      sim.step(Date.now());
    };
    tick(true);
    tick();
    const cast = sim.castOf(id)!;
    while (!cast.biting) tick();
    while (fishOnTheLine(sim.seed, cast.castNumber, sim.tick + 1) !== 'goldenCarp') tick();
    tick(true, true);
    tick();
    for (let i = 0; i < 11; i++) tick();
    tick(true);
    tick();
    for (let i = 0; i < 38; i++) tick();
    tick(true);
    expect(sim.fishRecordsOf(id).counts).toEqual([0, 0, 1]);
    expect(sim.inventoryOf(id).goldenCarp).toBeUndefined();
  });
  await waitFor('private collection', () =>
    angler.received.some((m) => m.type === 'fishRecords' && m.counts[2] === 1),
  );
  expect(
    visitor.received
      .filter((m) => m.type === 'fishRecords')
      .every((m) => m.type === 'fishRecords' && m.counts.every((n) => n === 0)),
  ).toBe(true);
  await runInDurableObject(stub, (_instance, state) => {
    const row = state.storage.sql
      .exec<{ state: string }>(
        'SELECT state FROM player_fishing_collection WHERE player_key=?',
        'record-angler',
      )
      .one();
    expect(JSON.parse(row.state).counts).toEqual([0, 0, 1]);
  });
  angler.close();
  await sleep(250);
  const returned = await TestClient.connect(worldId, 'record-angler');
  await waitFor('saved collection', () =>
    returned.received.some((m) => m.type === 'fishRecords' && m.counts[2] === 1),
  );
  returned.close();
  visitor.close();
  await sleep(250);
});
