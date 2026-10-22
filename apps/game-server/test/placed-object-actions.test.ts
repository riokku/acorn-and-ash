import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { encodeDecorationRequest, type WorldSimulation, type BuiltProp } from '@acorn/shared';
import { TestClient, waitFor } from './helpers';

it('persists an outdoor move and saves removal with its material refund', async () => {
  const worldId = `placed-actions-${Date.now()}`;
  const owner = await TestClient.connect(worldId, 'object-owner');
  await waitFor('welcome', () => owner.received.some((m) => m.type === 'welcome'));
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  const netId = owner.welcome().netId;
  await runInDurableObject(stub, (instance) => {
    const world = instance as unknown as {
      simulation: WorldSimulation;
      writeBuiltProp(prop: BuiltProp, owner: string): void;
    };
    world.simulation.restoreBuiltProps([
      {
        id: 7,
        kind: 'cabin',
        x: -2,
        z: -4.2,
        yaw: 0,
        ownerKey: 'object-owner',
        lit: false,
        litUntilMs: null,
      },
      {
        id: 8,
        kind: 'lantern',
        x: 1,
        z: 0,
        yaw: 0,
        ownerKey: 'object-owner',
        lit: false,
        litUntilMs: null,
      },
    ]);
    for (const prop of world.simulation.builtPropsList())
      world.writeBuiltProp(prop, 'object-owner');
    world.simulation.placePlayer(netId, { x: 3, y: 0, z: 0 }, 0);
  });
  const request = { id: 8, kind: 'lantern' as const, x: 1.2, z: 0.5, yaw: 0 };
  owner.sendRaw(encodeDecorationRequest({ ...request, action: 'moveOutdoor' }));
  await waitFor('move reply', () =>
    owner.received.some((m) => m.type === 'decorationReply' && m.action === 'moveOutdoor'),
  );
  expect(
    owner.received.find((m) => m.type === 'decorationReply' && m.action === 'moveOutdoor'),
  ).toMatchObject({ reason: null });
  await runInDurableObject(stub, (_instance, state) => {
    const rows = state.storage.sql
      .exec<{ x: number; z: number }>('SELECT x,z FROM built_props WHERE id=8')
      .toArray();
    expect(rows[0]?.x).toBeCloseTo(1.2);
    expect(rows[0]?.z).toBeCloseTo(0.5);
  });
  owner.sendRaw(encodeDecorationRequest({ ...request, action: 'reclaimOutdoor' }));
  await waitFor('remove reply', () =>
    owner.received.some((m) => m.type === 'decorationReply' && m.action === 'reclaimOutdoor'),
  );
  expect(
    owner.received.find((m) => m.type === 'decorationReply' && m.action === 'reclaimOutdoor'),
  ).toMatchObject({ reason: null });
  await runInDurableObject(stub, (instance, state) => {
    expect(state.storage.sql.exec('SELECT * FROM built_props WHERE id=8').toArray()).toEqual([]);
    expect(
      state.storage.sql
        .exec('SELECT * FROM player_items WHERE player_key=?', 'object-owner')
        .toArray().length,
    ).toBeGreaterThan(0);
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    expect(sim.builtPropsList().some((p) => p.id === 8)).toBe(false);
  });
  owner.close();
});
