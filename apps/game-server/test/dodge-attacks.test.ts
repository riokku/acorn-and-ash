import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  ActionKind,
  PlayerButton,
  createInput,
  unpackActionByte,
  createActionState,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, waitFor } from './helpers';
it('authorizes both dodge hops and publishes their airborne state to nearby players', async () => {
  const worldId = `dodge-${Date.now()}`,
    owner = await TestClient.connect(worldId, 'dodge-owner'),
    observer = await TestClient.connect(worldId, 'dodge-observer');
  await waitFor(
    'welcome',
    () =>
      owner.received.some((message) => message.type === 'welcome') &&
      observer.received.some((message) => message.type === 'welcome'),
  );
  const id = owner.welcome().netId,
    stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    Object.assign(sim.inventoryOf(id), { axe: 1 });
    sim.useItem(id, 'axe');
    let seq = 1;
    for (const [button, kind] of [
      [PlayerButton.Swing, ActionKind.DodgeLight],
      [PlayerButton.Charge, ActionKind.DodgeHeavy],
    ] as const) {
      for (let i = 0; i < 30; i++) {
        sim.queueInput(id, createInput(seq++, 0, 0, 0, 0));
        sim.step(Date.now());
      }
      sim.placePlayer(id, { x: 0, y: 0, z: 10 }, 0);
      sim.queueInput(id, createInput(seq++, 0, 0, 0, 0));
      sim.step(Date.now());
      sim.queueInput(id, createInput(seq++, 0, 0, 0, PlayerButton.Dodge));
      sim.step(Date.now());
      sim.queueInput(id, createInput(seq++, 0, 0, 0, button));
      sim.step(Date.now());
      for (let i = 0; i < 3; i++) {
        sim.queueInput(id, createInput(seq++, 0, 0, 0, 0));
        sim.step(Date.now());
      }
      const pose = sim.snapshotFor(id).find((entity) => entity.netId === id)!;
      expect(unpackActionByte(pose.action, createActionState()).kind).toBe(kind);
      expect(pose.y).toBeGreaterThan(0.5);
      const before = pose.y;
      sim.step(Date.now());
      expect(sim.snapshotFor(id).find((entity) => entity.netId === id)!.y).toBe(before);
    }
  });
  await waitFor('observer airborne combo', () =>
    observer.received.some(
      (message) =>
        message.type === 'snapshot' &&
        message.entities.some(
          (entity) =>
            entity.netId === id &&
            (entity.action & 0x1f) === ActionKind.DodgeHeavy &&
            entity.y > 0.5,
        ),
    ),
  );
  owner.close();
  observer.close();
});
