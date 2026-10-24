import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  PlayerButton,
  createInput,
  ActionKind,
  beginAction,
  canBufferLoot,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function setup() {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
  });
  worlds.push(sim);
  sim.addPlayer(1, { netId: 1, x: 0, y: 0, z: 0, facingYaw: 0, hunger: 20, items: [] });
  const axe = sim.clearing.pickups.find((p) => p.item === 'axe')!;
  sim.placePlayer(1, { ...axe, y: sim.collision.terrain.heightAt(axe.x, axe.z) }, 0);
  let seq = 0;
  return {
    sim,
    axe,
    step: (buttons = 0) => {
      sim.queueInput(1, createInput(++seq, 0, 0, 0, buttons));
      sim.step(seq * 50);
    },
  };
}
it('remembers a clicked pickup through the end of a brief action, collecting it once', () => {
  const { sim, axe, step } = setup();
  const action = sim.actionOf(1)!;
  beginAction(action, ActionKind.Flinch);
  action.age = 10;
  sim.requestLoot(1, { kind: 'pickup', id: axe.id });
  step();
  expect(sim.inventoryOf(1).axe).toBeUndefined();
  step();
  expect(sim.inventoryOf(1).axe).toBe(1);
  step();
  expect(sim.drainPickupEvents()).toHaveLength(1);
});
it.each(['expire', 'outOfReach', 'reconnect'] as const)(
  'never performs a stale or unreachable clicked pickup: %s',
  (reason) => {
    const { sim, axe, step } = setup();
    const action = sim.actionOf(1)!;
    beginAction(action, ActionKind.Flinch);
    action.age = reason === 'expire' ? 0 : 10;
    sim.requestLoot(1, { kind: 'pickup', id: axe.id });
    if (reason === 'outOfReach') sim.placePlayer(1, { x: 20, y: 0, z: 20 }, 0);
    if (reason === 'reconnect') sim.handOver(1);
    for (let tick = 0; tick < 16; tick++) step();
    expect(sim.inventoryOf(1).axe).toBeUndefined();
  },
);
it('holding E to gather never eats the held food after the patch is emptied', () => {
  const { sim, step } = setup();
  Object.assign(sim.inventoryOf(1), { perch: 3 });
  sim.useItem(1, 'perch');
  const patch = sim.gatherPatchesList().find((p) => p.item === 'stick')!;
  sim.placePlayer(1, { ...patch, y: sim.collision.terrain.heightAt(patch.x, patch.z) }, 0);
  for (let tick = 0; tick < 100; tick++) step(PlayerButton.Interact);
  expect(sim.inventoryOf(1).stick).toBeGreaterThan(0);
  expect(sim.inventoryOf(1).perch).toBe(3);
});

it('buffers only the tail of finite actions, never a charge, knockout or rest', () => {
  expect(canBufferLoot({ kind: ActionKind.Flinch, step: 0, age: 10 })).toBe(true);
  expect(canBufferLoot({ kind: ActionKind.Flinch, step: 0, age: 0 })).toBe(false);
  expect(canBufferLoot({ kind: ActionKind.Swing, step: 1, age: 6 }, false)).toBe(true);
  expect(canBufferLoot({ kind: ActionKind.Swing, step: 1, age: 6 }, true)).toBe(false);
  for (const kind of [ActionKind.Charge, ActionKind.KnockedOut, ActionKind.Sit])
    expect(canBufferLoot({ kind, step: 0, age: 255 })).toBe(false);
});
