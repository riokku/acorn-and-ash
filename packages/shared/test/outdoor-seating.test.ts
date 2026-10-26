import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  createFlatTerrain,
  benchSeats,
  outdoorSeatInReach,
  ActionKind,
  createActionState,
  RiseFrom,
  createInput,
  PlayerButton,
  unpackActionByte,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((sim) => sim.dispose()));
const bench = { id: 70, kind: 'cedarBench' as const, x: 8, z: 8, yaw: 0 };
function setup() {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    terrain: createFlatTerrain(3),
    withProps: false,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  sims.push(sim);
  sim.restoreBuiltProps([{ ...bench, ownerKey: 'owner', lit: false, litUntilMs: null }]);
  for (let id = 1; id <= 3; id++) sim.addPlayer(id, undefined, id === 1 ? 'owner' : `guest-${id}`);
  const seats = benchSeats(bench, () => 3);
  for (let id = 1; id <= 3; id++) sim.placePlayer(id, { ...seats[(id - 1) % 2]!.stand, y: 3 }, 0);
  return { sim, seats };
}
function press(sim: WorldSimulation, id: number, seq = 1, buttons = PlayerButton.Interact) {
  sim.queueInput(id, createInput(seq, 0, 0, 0, buttons));
  sim.step(sim.tick * 50);
}
function action(sim: WorldSimulation, id: number) {
  return unpackActionByte(
    sim.snapshotFor(id).find((pose) => pose.netId === id)!.action,
    createActionState(),
  );
}
it('rotates both seats and rejects underground or out-of-reach use', () => {
  const placed = { ...bench, yaw: Math.PI / 2 };
  const seats = benchSeats(placed, () => 5);
  expect(seats[0]!.stand.x).toBeCloseTo(bench.x - 0.82);
  expect(seats[0]!.rest.y).toBeCloseTo(5.18);
  expect(outdoorSeatInReach([placed], { ...seats[0]!.stand, y: 5 }, () => 5)?.slot).toBe(0);
  expect(outdoorSeatInReach([placed], { ...seats[0]!.stand, y: 0 }, () => 5)).toBeNull();
  expect(outdoorSeatInReach([placed], { x: 50, y: 5, z: 50 }, () => 5)).toBeNull();
});
it('lets two players sit at terrain height, refuses a third, and protects occupied furniture', () => {
  const { sim } = setup();
  press(sim, 1);
  press(sim, 2);
  expect(action(sim, 1).kind).toBe(ActionKind.Sit);
  expect(action(sim, 2).kind).toBe(ActionKind.Sit);
  expect(sim.snapshotFor(1).find((pose) => pose.netId === 1)?.y).toBeCloseTo(3);
  press(sim, 3);
  expect(action(sim, 3).kind).not.toBe(ActionKind.Sit);
  sim.placePlayer(1, { x: 6, y: 3, z: 6 }, 0);
  const request = { ...bench, action: 'moveOutdoor' as const, x: 9, z: 8 };
  expect(sim.requestDecoration(1, request).reason).toBe('occupied');
  expect(sim.requestDecoration(3, { ...request, action: 'reclaimOutdoor' }).reason).toBe('private');
});
it('keeps occupied seats reserved while rising and releases them after disconnect', () => {
  const { sim, seats } = setup();
  press(sim, 1);
  press(sim, 2);
  for (let seq = 2; seq <= 26; seq++) press(sim, 1, seq, 0);
  press(sim, 1, 27);
  expect(action(sim, 1)).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Chair });
  press(sim, 3);
  expect(action(sim, 3).kind).not.toBe(ActionKind.Sit);
  sim.removePlayer(1);
  sim.placePlayer(3, { ...seats[0]!.stand, y: 3 }, 0);
  press(sim, 3, 2, 0);
  press(sim, 3, 3);
  expect(action(sim, 3).kind).toBe(ActionKind.Sit);
});
it('allows furniture outdoors through normal paid building and keeps rugs indoors', () => {
  const { sim } = setup();
  sim.restoreBuiltProps([
    { ...bench, ownerKey: 'owner', lit: false, litUntilMs: null },
    { id: 71, kind: 'tent', x: 0, z: -7, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.placePlayer(1, { x: 0, y: 3, z: 0 }, 0);
  Object.assign(sim.inventoryOf(1), { log: 20, stick: 10 });
  sim.requestBuild(1, { kind: 'timberTable', x: 4, z: -3, yaw: 0 });
  sim.step(sim.tick * 50);
  expect(sim.drainBuildReplies()[0]?.reason).toBeNull();
  expect(sim.inventoryOf(1).log).toBe(14);
  sim.requestBuild(1, { kind: 'wovenRug', x: 3, z: 0, yaw: 0 });
  sim.step(sim.tick * 50);
  expect(sim.drainBuildReplies()[0]?.reason).toBe('indoors');
});

it('does not toggle a nearby fire when sitting and lets held raw food cook first', () => {
  const { sim, seats } = setup();
  sim.restoreBuiltProps([
    { ...bench, ownerKey: 'owner', lit: false, litUntilMs: null },
    {
      id: 71,
      kind: 'campfire',
      x: 8,
      z: 5.5,
      yaw: 0,
      ownerKey: 'owner',
      lit: false,
      litUntilMs: null,
    },
  ]);
  sim.inventoryOf(1).log = 2;
  expect(sim.requestFire(1, { propId: 71, action: 'addLog' })).toBe(true);
  press(sim, 1);
  expect(action(sim, 1).kind).toBe(ActionKind.Sit);
  expect(sim.fireIsLit(71)).toBe(true);
  sim.placePlayer(1, { ...seats[0]!.stand, y: 3 }, 0);
  sim.inventoryOf(1).meat = 1;
  sim.useItem(1, 'meat');
  press(sim, 1, 2, 0);
  press(sim, 1, 3);
  expect(sim.inventoryOf(1).roastedMeat).toBe(1);
  expect(action(sim, 1).kind).not.toBe(ActionKind.Sit);
  expect(sim.fireIsLit(71)).toBe(true);
});
