import { expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  POND,
  PlayerButton,
  createInput,
  fishOnTheLine,
  TICK_MILLISECONDS,
  type ItemId,
} from '../src';
function goldenCast(items: { item: ItemId; count: number }[] = [{ item: 'rod', count: 1 }]) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, hungerEmptyAfterSeconds: Infinity });
  const pool = POND[0]!,
    pos = { x: pool.x - pool.radius - 0.5, y: 0, z: pool.z },
    yaw = -Math.PI / 2;
  sim.addPlayer(
    1,
    { netId: 1, ...pos, facingYaw: yaw, items, hunger: 100, equippedItem: 'rod' },
    'angler',
  );
  sim.placePlayer(1, pos, yaw);
  let seq = 0,
    clock = 1700000000000;
  const tick = (clicked = false, sawBite = false) => {
    sim.queueInput(
      1,
      createInput(
        ++seq,
        0,
        0,
        yaw,
        (clicked ? PlayerButton.Fish : 0) | (sawBite ? PlayerButton.SawBite : 0),
      ),
    );
    sim.step((clock += TICK_MILLISECONDS));
  };
  tick(true);
  tick();
  const cast = sim.castOf(1)!;
  expect(cast).not.toBeNull();
  while (!cast.biting) tick();
  while (fishOnTheLine(sim.seed, cast.castNumber, sim.tick + 1) !== 'goldenCarp') tick();
  sim.drainFishingEvents();
  tick(true, true);
  expect(sim.drainReelChanges()).toEqual([{ netId: 1, state: { age: 0, hits: 0, misses: 0 } }]);
  return { sim, tick };
}
it('lands rare fish only after two steady pulls; saves records and clears pending reel updates', () => {
  const { sim, tick } = goldenCast();
  try {
    tick();
    for (let i = 0; i < 11; i++) tick();
    tick(true);
    expect(sim.drainReelChanges()[0]?.state.hits).toBe(1);
    tick();
    for (let i = 0; i < 38; i++) tick();
    tick(true);
    expect(sim.drainFishingEvents()).toEqual([
      { kind: 'caught', netId: 1, item: 'goldenCarp', added: 1 },
    ]);
    expect(sim.drainReelChanges()).toEqual([]);
    expect(sim.fishRecordsOf(1).counts).toEqual([0, 0, 1]);
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(2, saved, 'angler');
    expect(sim.fishRecordsOf(2)).toEqual(saved.fishRecords);
  } finally {
    sim.dispose();
  }
});
it('records a rare catch released from a full pack without losing inventory', () => {
  const { sim, tick } = goldenCast([
    { item: 'rod', count: 1 },
    { item: 'perch', count: 30 },
    { item: 'trout', count: 20 },
  ]);
  try {
    const pack = { ...sim.inventoryOf(1) };
    tick();
    for (let i = 0; i < 11; i++) tick();
    tick(true);
    tick();
    for (let i = 0; i < 38; i++) tick();
    tick(true);
    expect(sim.drainFishingEvents()).toEqual([
      { kind: 'caught', netId: 1, item: 'goldenCarp', added: 0 },
    ]);
    expect(sim.inventoryOf(1)).toEqual(pack);
    expect(sim.fishRecordsOf(1).counts[2]).toBe(1);
  } finally {
    sim.dispose();
  }
});
it('walking away ends a rare challenge without granting a record', () => {
  const { sim, tick } = goldenCast();
  try {
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    tick();
    expect(sim.drainFishingEvents()).toEqual([{ kind: 'walkedAway', netId: 1 }]);
    expect(sim.drainReelChanges()).toEqual([]);
    expect(sim.fishRecordsOf(1).counts).toEqual([0, 0, 0]);
  } finally {
    sim.dispose();
  }
});

it('lets fresh slow-browser responses keep the line alive but gives up on a genuinely quiet browser', () => {
  const { sim, tick } = goldenCast();
  try {
    tick();
    for (let i = 0; i < 350; i++) sim.step(1700000000000 + i * 50);
    tick();
    for (let i = 0; i < 100; i++) sim.step(1700000100000 + i * 50);
    expect(sim.castOf(1)).not.toBeNull();
    for (let i = 0; i < 301; i++) sim.step(1700000200000 + i * 50);
    expect(sim.castOf(1)).toBeNull();
    expect(sim.drainFishingEvents()).toEqual([{ kind: 'tooLate', netId: 1 }]);
    expect(sim.fishRecordsOf(1).counts).toEqual([0, 0, 0]);
  } finally {
    sim.dispose();
  }
});
