import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  createInput,
  PlayerButton,
  itemIndex,
  type BuriedCache,
  type WorldSimulation,
} from '@acorn/shared';
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

it.each([0, 8])(
  'permanently replaces the old stash on death with %i carried logs',
  async (logs) => {
    const worldId = `latest-death-${logs}-${Date.now()}`;
    const owner = await TestClient.connect(worldId, 'latest-owner');
    await waitFor('welcome', () => owner.received.some((message) => message.type === 'welcome'));
    const netId = owner.welcome().netId;
    const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
    await runInDurableObject(stub, (instance, state) => {
      const world = instance as unknown as {
        simulation: WorldSimulation;
        writeBuriedCache(cache: BuriedCache): void;
        announceBuriedCaches(sim: WorldSimulation): void;
      };
      const sim = world.simulation;
      const caches: BuriedCache[] = [
        { id: 41, ownerPlayerKey: 'latest-owner', x: 0, z: 10, items: [{ item: 'log', count: 3 }] },
        { id: 42, ownerPlayerKey: 'visitor', x: 5, z: 10, items: [{ item: 'log', count: 2 }] },
      ];
      sim.restoreBuriedCaches(caches);
      for (const cache of caches) world.writeBuriedCache(cache);
      Object.assign(sim.inventoryOf(netId), { log: logs });
      (
        sim as unknown as {
          raiderStrikesPlayer(id: number, damage: number, tick: number): void;
        }
      ).raiderStrikesPlayer(netId, 1000, sim.tick);
      world.announceBuriedCaches(sim);
      const sql = state.storage.sql;
      expect(sql.exec('SELECT id FROM buried_caches WHERE id=41').toArray()).toEqual([]);
      expect(sql.exec('SELECT * FROM buried_cache_items WHERE cache_id=41').toArray()).toEqual([]);
      expect(sql.exec('SELECT id FROM buried_caches WHERE id=42').toArray()).toHaveLength(1);
      expect(sql.exec('SELECT count FROM buried_cache_items WHERE cache_id=42').one()).toEqual({
        count: 2,
      });
      expect(
        sql.exec('SELECT id FROM buried_caches WHERE owner_key=?', 'latest-owner').toArray(),
      ).toHaveLength(logs === 0 ? 0 : 1);
      expect(
        sql
          .exec(
            'SELECT count FROM player_items WHERE player_key=? AND item_index=?',
            'latest-owner',
            itemIndex('log'),
          )
          .toArray(),
      ).toEqual(logs === 0 ? [] : [{ count: 4 }]);
    });
    await waitFor('updated private marker', () =>
      owner.received.some(
        (message) =>
          message.type === 'recoveryMarkers' &&
          (logs === 0
            ? message.caches.length === 0
            : message.caches.some((cache) => cache.id === 43)),
      ),
    );
    expect(owner.cacheNews().some((event) => event.kind === 'dugUp')).toBe(false);
    owner.close();
    await waitFor('owner close', () => owner.closedWith !== null);
    await sleep(300);
    const returned = await TestClient.connect(worldId, 'latest-owner');
    await waitFor('restored caches', () =>
      returned.received.some((message) => message.type === 'recoveryMarkers'),
    );
    expect(
      returned
        .openingBuriedCaches()
        .map((cache) => cache.id)
        .sort(),
    ).toEqual(logs === 0 ? [42] : [42, 43]);
    returned.close();
  },
);

it('permanently deletes older saved caches and their contents when an existing world wakes', async () => {
  const worldId = `legacy-recovery-${Date.now()}`;
  const client = await TestClient.connect(worldId, 'legacy-owner');
  await waitFor('welcome', () => client.received.some((message) => message.type === 'welcome'));
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  client.close();
  await waitFor('closed', () => client.closedWith !== null);
  await sleep(300);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    // Deliberately insert the newer cache first, with equal timestamps.
    for (const [id, owner] of [
      [42, 'legacy-owner'],
      [41, 'legacy-owner'],
      [5, 'visitor'],
    ] as const) {
      sql.exec(
        'INSERT INTO buried_caches(id,owner_key,x,z,buried_at_ms) VALUES (?,?,0,10,1000)',
        id,
        owner,
      );
      sql.exec(
        'INSERT INTO buried_cache_items(cache_id,item_index,count) VALUES (?,?,3)',
        id,
        itemIndex('log'),
      );
    }
  });
  for (let wake = 0; wake < 2; wake++) {
    const returned = await TestClient.connect(worldId, 'legacy-owner');
    await waitFor('opening caches', () =>
      returned.received.some((message) => message.type === 'buriedCaches'),
    );
    expect(
      returned
        .openingBuriedCaches()
        .map((cache) => cache.id)
        .sort(),
    ).toEqual([42, 5]);
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      expect(sql.exec('SELECT id FROM buried_caches ORDER BY id').toArray()).toEqual([
        { id: 5 },
        { id: 42 },
      ]);
      expect(
        sql.exec('SELECT DISTINCT cache_id FROM buried_cache_items ORDER BY cache_id').toArray(),
      ).toEqual([{ cache_id: 5 }, { cache_id: 42 }]);
    });
    returned.close();
    await waitFor('closed', () => returned.closedWith !== null);
    await sleep(300);
  }
});
