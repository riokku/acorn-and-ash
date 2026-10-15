import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  encodeFireRequest,
  itemIndex,
  logStorageSpot,
  type BuiltProp,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';

it('persists fuel and wood transfers with their inventory debit and sends them to a returning player', async () => {
  const worldId = `fuel-${Date.now()}`,
    owner = await TestClient.connect(worldId, 'wood-owner');
  await waitFor('welcome', () => owner.received.some((m) => m.type === 'welcome'));
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId)),
    netId = owner.welcome().netId;
  try {
    await runInDurableObject(stub, (instance) => {
      const world = instance as unknown as {
        simulation: WorldSimulation;
        writeBuiltProp(prop: BuiltProp, key: string): void;
        save(sim: WorldSimulation): void;
      };
      const sim = world.simulation;
      const props: BuiltProp[] = [
        { id: 700, kind: 'campfire', x: -12, z: 0, yaw: 0, lit: false },
        { id: 701, kind: 'cabin', x: 0, z: -8, yaw: 0, lit: false },
      ];
      sim.restoreBuiltProps(props.map((p) => ({ ...p, ownerKey: 'wood-owner', litUntilMs: null })));
      props.forEach((p) => world.writeBuiltProp(p, 'wood-owner'));
      sim.inventoryOf(netId).log = 7;
      sim.placePlayer(netId, { x: -12, y: 0, z: 1.4 }, 0);
      world.save(sim);
    });
    owner.sendRaw(encodeFireRequest({ propId: 700, action: 'addLog' }));
    await waitFor('fuel broadcast', () =>
      owner.received.some(
        (m) => m.type === 'fireFuel' && m.fires.some((f) => f.propId === 700 && f.lit),
      ),
    );
    await runInDurableObject(stub, (_instance, state) => {
      expect(
        state.storage.sql
          .exec<{ fuel_ms: number }>('SELECT fuel_ms FROM built_props WHERE id=700')
          .one().fuel_ms,
      ).toBe(600_000);
      expect(
        state.storage.sql
          .exec<{ count: number }>(
            'SELECT count FROM player_items WHERE player_key=? AND item_index=?',
            'wood-owner',
            itemIndex('log'),
          )
          .one().count,
      ).toBe(6);
    });
    owner.sendRaw(encodeFireRequest({ propId: 700, action: 'toggle' }));
    await waitFor('paused fuel', () =>
      owner.received.some(
        (m) =>
          m.type === 'fireFuel' &&
          m.fires.some((f) => f.propId === 700 && !f.lit && f.remainingMs > 0),
      ),
    );
    await runInDurableObject(stub, (instance) => {
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      const spot = logStorageSpot(sim.builtPropsList().find((p) => p.id === 701)!);
      sim.placePlayer(netId, { x: spot.x - 1.2, y: 0, z: spot.z }, 0);
    });
    owner.sendRaw(encodeFireRequest({ propId: 701, action: 'storeLogs', amount: 50 }));
    await waitFor('stored logs', () =>
      owner.received.some(
        (m) => m.type === 'fireFuel' && m.fires.some((f) => f.propId === 701 && f.storedLogs === 6),
      ),
    );
    await runInDurableObject(stub, (_instance, state) => {
      expect(
        state.storage.sql
          .exec<{ stored_logs: number }>('SELECT stored_logs FROM built_props WHERE id=701')
          .one().stored_logs,
      ).toBe(6);
      expect(
        state.storage.sql
          .exec(
            'SELECT count FROM player_items WHERE player_key=? AND item_index=?',
            'wood-owner',
            itemIndex('log'),
          )
          .toArray(),
      ).toEqual([]);
    });
    owner.close();
    await sleep(250);
    const returned = await TestClient.connect(worldId, 'wood-owner');
    try {
      await waitFor('restored fuel and logs', () =>
        returned.received.some(
          (m) =>
            m.type === 'fireFuel' &&
            m.fires.some((f) => f.propId === 701 && f.storedLogs === 6) &&
            m.fires.some((f) => f.propId === 700 && !f.lit && f.remainingMs > 590_000),
        ),
      );
    } finally {
      returned.close();
    }
  } finally {
    owner.close();
  }
});
