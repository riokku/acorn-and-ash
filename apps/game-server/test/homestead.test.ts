import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { buildableKindIndex, type WorldSimulation } from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
it('saves outdoor pantry transfers and garden planting atomically, then restores both on return', async () => {
  const worldId = `homestead-${Date.now()}`,
    key = 'homestead-owner';
  const owner = await TestClient.connect(worldId, key);
  await waitFor('owner welcome', () => owner.received.some((m) => m.type === 'welcome'));
  const id = owner.welcome().netId,
    stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance, state) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    const pieces = [
      { id: 7, kind: 'tent' as const, x: -2, z: -4.2 },
      { id: 8, kind: 'trailPantry' as const, x: 0, z: 0 },
      { id: 9, kind: 'kitchenGarden' as const, x: 3, z: 0 },
    ];
    sim.restoreBuiltProps(
      pieces.map((p) => ({
        ...p,
        yaw: 0,
        lit: false,
        ownerKey: 'homestead-owner',
        litUntilMs: null,
      })),
    );
    for (const p of pieces)
      state.storage.sql.exec(
        'INSERT INTO built_props (id,kind_index,x,z,yaw,built_at_ms,owner_key,locked) VALUES (?,?,?,?,?,?,?,?)',
        p.id,
        buildableKindIndex(p.kind),
        p.x,
        p.z,
        0,
        Date.now(),
        'homestead-owner',
        0,
      );
    sim.placePlayer(id, { x: 0, y: 0, z: 1.5 }, 0);
    Object.assign(sim.inventoryOf(id), { mushroom: 4, berry: 1 });
  });
  try {
    owner.chest({ action: 'deposit', item: 'mushroom', amount: 4 });
    await waitFor('pantry stored', () =>
      owner.received.some((m) => m.type === 'chest' && m.homeId === 8 && m.moved === 4),
    );
    await waitFor('stocked yard broadcast', () =>
      owner.received.some(
        (m) =>
          m.type === 'homesteadAppearance' && m.projects.some((p) => p.id === 8 && p.stocked === 1),
      ),
    );
    await runInDurableObject(stub, (instance, state) => {
      const slots = JSON.parse(
        state.storage.sql
          .exec<{ slots: string }>('SELECT slots FROM home_chests WHERE home_id=8')
          .one().slots,
      );
      expect(slots[0]).toEqual({ item: 'mushroom', count: 4 });
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      expect(sim.inventoryOf(id).mushroom ?? 0).toBe(0);
      sim.placePlayer(id, { x: 3, y: 0, z: 1.5 }, 0);
    });
    owner.garden({ action: 'plant', plot: 0, crop: 'berry' });
    await waitFor('planted garden', () =>
      owner.received.some(
        (m) => m.type === 'garden' && m.homeId === 9 && m.plots[0]?.crop === 'berry',
      ),
    );
    await runInDurableObject(stub, (_instance, state) => {
      const plots = JSON.parse(
        state.storage.sql
          .exec<{ plots: string }>('SELECT plots FROM home_gardens WHERE home_id=9')
          .one().plots,
      );
      expect(plots[0].crop).toBe('berry');
      expect(plots[0].growTicks).toBeGreaterThan(0);
    });
  } finally {
    owner.close();
  }
  await sleep(300);
  const returned = await TestClient.connect(worldId, key);
  try {
    await waitFor('return welcome', () => returned.received.some((m) => m.type === 'welcome'));
    const netId = returned.welcome().netId;
    await runInDurableObject(stub, (instance) => {
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      expect(sim.chestSlots(8)[0]).toEqual({ item: 'mushroom', count: 4 });
      expect(sim.savedGardens().find((g) => g.homeId === 9)?.plots[0]?.crop).toBe('berry');
      sim.placePlayer(netId, { x: 0, y: 0, z: 1.5 }, 0);
    });
    returned.chest({ action: 'withdraw', slot: 0, amount: 4 });
    await waitFor('pantry recovered', () =>
      returned.received.some((m) => m.type === 'chest' && m.homeId === 8 && m.moved === 4),
    );
    expect(returned.inventory().find((row) => row.item === 'mushroom')?.count).toBe(4);
  } finally {
    returned.close();
  }
}, 30000);
