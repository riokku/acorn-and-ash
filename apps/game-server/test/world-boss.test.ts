import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  CROWNBREAKER_HOLD,
  HOLLOW_KING_SITE,
  itemIndex,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, waitFor, sleep } from './helpers';

it('saves a defeated king’s real-time rest and personal relic before hibernating', async () => {
  const worldId = `king-save-${Date.now()}`;
  const player = await TestClient.connect(worldId, 'king-owner');
  await waitFor('live world', () => player.snapshots().length > 0);
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  const netId = player.welcome().netId;
  const deadline = await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    const hold = CROWNBREAKER_HOLD;
    sim.placePlayer(
      netId,
      { x: hold.x, y: sim.collision.terrain.heightAt(hold.x, hold.z - 19), z: hold.z - 19 },
      Math.PI,
    );
    // Ambient encounters are disabled in the Workers test environment.
    sim.raids.startRaid(0, ['hollowKing'], false, HOLLOW_KING_SITE);
    for (let i = 0; i < 80; i++) sim.step(Date.now());
    const king = sim.raidersList().find((r) => r.kind === 'hollowKing')!;
    expect(king).toBeDefined();
    const at = sim.raids.positionOf(king.id)!;
    sim.raids.blowLands(
      netId,
      { x: at.x, y: at.y, z: at.z - 1.5 },
      Math.PI,
      { kind: 'strike' },
      0,
      200_000,
    );
    expect(sim.raidersList().find((r) => r.id === king.id)?.hitsLeft).toBe(0);
    return sim.worldBossRestUntilMs();
  });
  expect(deadline).toBeGreaterThan(Date.now() + 1_790_000);
  await waitFor('personal relic delivered', () =>
    player.droppedPiles().some((p) => p.item === 'firstBellRelic'),
  );
  await runInDurableObject(stub, (_instance, state) => {
    const saved = state.storage.sql
      .exec<{ value: string }>("SELECT value FROM world_meta WHERE key = 'worldBossRestUntilMs'")
      .toArray();
    expect(Number(saved[0]?.value)).toBe(deadline);
    expect(
      state.storage.sql
        .exec<{ item_index: number }>(
          'SELECT item_index FROM dropped_piles WHERE item_index = ? AND owner_key IS NOT NULL',
          itemIndex('firstBellRelic'),
        )
        .toArray(),
    ).toHaveLength(1);
  });
  player.close();
  await sleep(300);
  await runInDurableObject(stub, (instance) =>
    expect((instance as unknown as { simulation: WorldSimulation | null }).simulation).toBeNull(),
  );
  const returning = await TestClient.connect(worldId, 'king-owner');
  await waitFor('personal relic restored', () =>
    returning.droppedPiles().some((p) => p.item === 'firstBellRelic'),
  );
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    expect(sim.worldBossRestUntilMs()).toBe(deadline);
    expect(sim.raidersList().some((r) => r.kind === 'hollowKing')).toBe(false);
  });
  returning.close();
});
