import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { type WorldSimulation } from '@acorn/shared';
import { TestClient, waitFor, sleep } from './helpers';

it('atomically saves personal blueprint rewards and streaks, protects pickup and restores ownership on reconnect', async () => {
  const worldId = `encounters-${Date.now()}`;
  const owner = await TestClient.connect(worldId, 'encounter-owner');
  const helper = await TestClient.connect(worldId, 'encounter-helper');
  await waitFor(
    'both welcome',
    () =>
      owner.received.some((m) => m.type === 'welcome') &&
      helper.received.some((m) => m.type === 'welcome'),
  );
  await waitFor(
    'first live tick',
    () => owner.snapshots().length > 0 && helper.snapshots().length > 0,
  );
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  const ownerId = owner.welcome().netId,
    helperId = helper.welcome().netId;
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    // Begin at the final missed roll so the real kill must pay each participant.
    const runtimes = (sim as unknown as { players: Map<number, { blueprintMisses: number }> })
      .players;
    runtimes.get(ownerId)!.blueprintMisses = 5;
    runtimes.get(helperId)!.blueprintMisses = 5;
    sim.placePlayer(ownerId, { x: 0, y: 0, z: 0 }, 0);
    sim.placePlayer(helperId, { x: 0.3, y: 0, z: 0 }, 0);
    const raid = sim.startRaid(ownerId, ['warrior'])!;
    const raider = sim.raids.raidersOf(raid)[0]!;
    sim.raids.placeRaider(raider, { x: 0, y: 0, z: -1.4 }, Math.PI);
    expect(sim.raids.blowLands(helperId, { x: 0.3, y: 0, z: 0 }, 0, { kind: 'strike' }, 0)).toBe(
      true,
    );
    expect(sim.raids.blowLands(ownerId, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0)).toBe(true);
    expect(sim.raidersList().find((r) => r.id === raider)?.hitsLeft).toBe(0);
    expect(sim.droppedPilesList(ownerId).map((p) => p.item)).toEqual(['teepeeBlueprint']);
    expect(sim.droppedPilesList(helperId).map((p) => p.item)).toEqual(['teepeeBlueprint']);
  });
  await waitFor(
    'personal rewards',
    () =>
      owner.droppedPiles().some((p) => p.item === 'teepeeBlueprint') &&
      helper.droppedPiles().some((p) => p.item === 'teepeeBlueprint'),
  );
  const own = owner.droppedPiles().find((p) => p.item === 'teepeeBlueprint')!;
  const other = helper.droppedPiles().find((p) => p.item === 'teepeeBlueprint')!;
  expect(own.id).not.toBe(other.id);
  expect(owner.droppedPiles().some((p) => p.id === other.id)).toBe(false);
  await runInDurableObject(stub, (_instance, state) => {
    const progress = state.storage.sql
      .exec<{ misses: number }>('SELECT misses FROM player_blueprint_progress')
      .toArray();
    expect(progress).toHaveLength(2);
    expect(progress.every((row) => row.misses === 0)).toBe(true);
    expect(
      state.storage.sql
        .exec<{ owner_key: string }>(
          'SELECT owner_key FROM dropped_piles WHERE owner_key IS NOT NULL',
        )
        .toArray()
        .map((row) => row.owner_key)
        .sort(),
    ).toEqual(['encounter-helper', 'encounter-owner']);
  });
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    sim.placePlayer(ownerId, { x: other.x, y: 0, z: other.z }, 0);
  });
  owner.loot({ kind: 'pile', id: other.id });
  owner.walk(0, 0, 0, 2);
  await waitFor('forged pickup processed', () => owner.snapshots().length > 3);
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    expect(sim.inventoryOf(ownerId).teepeeBlueprint ?? 0).toBe(0);
    expect(sim.persistedPile(other.id)?.ownerKey).toBe('encounter-helper');
  });
  owner.close();
  helper.close();
  await sleep(300);
  await runInDurableObject(stub, (instance) => {
    expect((instance as unknown as { simulation: WorldSimulation | null }).simulation).toBeNull();
  });
  const returning = await TestClient.connect(worldId, 'encounter-owner');
  await waitFor('reward restored', () => returning.droppedPiles().some((p) => p.id === own.id));
  expect(returning.droppedPiles().some((p) => p.id === other.id)).toBe(false);
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    expect(sim.blueprintMissesOf(returning.welcome().netId)).toBe(0);
  });
  returning.close();
});
