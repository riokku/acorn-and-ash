import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_WORLD_SEED,
  INTEREST_RADIUS,
  MAX_QUEUED_INPUTS_PER_PLAYER,
  PLAYER_RADIUS,
  TICK_HZ,
} from '../src/constants';
import { COLLISION_SKIN_WIDTH } from '../src/collision/capsule';
import { PlayerButton, createInput } from '../src/sim/player';
import { inputsToConsume, WorldSimulation, SnapshotFlag } from '../src/sim/world-sim';

/** Every world a test builds, so they can be handed back when it finishes. */
const built: WorldSimulation[] = [];

afterEach(() => {
  for (const sim of built.splice(0)) sim.dispose();
});

function createWorld(seed = DEFAULT_WORLD_SEED): WorldSimulation {
  const sim = new WorldSimulation({ seed });
  built.push(sim);
  return sim;
}

/** Hold a direction for a number of ticks, feeding one input per tick. */
function drive(
  sim: WorldSimulation,
  netId: number,
  moveX: number,
  moveZ: number,
  ticks: number,
  startSeq = 1,
  buttons = 0,
): number {
  let seq = startSeq;
  for (let i = 0; i < ticks; i++) {
    sim.queueInput(netId, createInput(seq++, moveX, moveZ, 0, buttons));
    sim.step();
  }
  return seq;
}

describe('the world simulation', () => {
  it('starts with the clearing built and nobody in it', () => {
    const sim = createWorld();
    expect(sim.playerCount).toBe(0);
    expect(sim.clearing.props.length).toBeGreaterThan(100);
    expect(sim.tick).toBe(0);
  });

  it('adds and removes players', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.addPlayer(2);
    expect(sim.playerCount).toBe(2);
    expect(sim.hasPlayer(1)).toBe(true);

    expect(sim.removePlayer(1)).toBe(true);
    expect(sim.removePlayer(1)).toBe(false);
    expect(sim.playerCount).toBe(1);
    expect(sim.hasPlayer(1)).toBe(false);
  });

  it('does not spawn two players on the same spot', () => {
    const sim = createWorld();
    for (let i = 1; i <= 8; i++) sim.addPlayer(i);

    const positions = sim.playerIds().map((id) => sim.readPlayer(id)?.position);
    for (let a = 0; a < positions.length; a++) {
      for (let b = a + 1; b < positions.length; b++) {
        const first = positions[a];
        const second = positions[b];
        if (!first || !second) throw new Error('missing player');
        expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThan(
          PLAYER_RADIUS * 2,
        );
      }
    }
  });

  it('moves a player when it is given inputs', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const before = sim.readPlayer(1)?.position;
    drive(sim, 1, 0, 1, TICK_HZ);
    const after = sim.readPlayer(1)?.position;

    if (!before || !after) throw new Error('missing player');
    expect(after.z).toBeLessThan(before.z - 1);
    expect(sim.tick).toBe(TICK_HZ);
  });

  it('acknowledges the newest input it has simulated', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    expect(sim.lastProcessedSeq(1)).toBe(0);
    drive(sim, 1, 0, 1, 5);
    expect(sim.lastProcessedSeq(1)).toBe(5);
  });

  it('keeps a player still when their inputs stop arriving', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    drive(sim, 1, 0, 1, 20);
    for (let i = 0; i < 40; i++) sim.step();

    const motion = sim.readPlayer(1);
    if (!motion) throw new Error('missing player');
    expect(Math.hypot(motion.velocity.x, motion.velocity.z)).toBeCloseTo(0, 5);
  });

  it('ignores an input the server has already simulated', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    drive(sim, 1, 0, 1, 10);
    const afterTen = sim.readPlayer(1)?.position.z;

    // A replayed old packet must not move the player again.
    sim.queueInput(1, createInput(3, 0, 1, 0));
    sim.step();
    expect(sim.lastProcessedSeq(1)).toBe(10);
    const afterReplay = sim.readPlayer(1)?.position.z;
    if (afterTen === undefined || afterReplay === undefined) throw new Error('missing player');
    // It coasted a little, but nowhere near another tick of walking.
    expect(Math.abs(afterReplay - afterTen)).toBeLessThan(0.3);
  });

  it('throws away the oldest inputs when a client floods it', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    for (let seq = 1; seq <= MAX_QUEUED_INPUTS_PER_PLAYER + 25; seq++) {
      sim.queueInput(1, createInput(seq, 0, 1, 0));
    }
    expect(sim.droppedInputs(1)).toBe(25);
  });

  it('never lets a flooding client run away with the tick budget', () => {
    expect(inputsToConsume(0)).toBe(0);
    expect(inputsToConsume(1)).toBe(1);
    expect(inputsToConsume(4)).toBe(1);
    expect(inputsToConsume(40)).toBe(3);
  });

  it('cannot be walked through a tree', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    // Walk hard into the tree line for fifteen seconds.
    drive(sim, 1, 0, 1, TICK_HZ * 15);

    const motion = sim.readPlayer(1);
    if (!motion) throw new Error('missing player');
    for (const collider of sim.clearing.colliders) {
      const gap = Math.hypot(motion.position.x - collider.x, motion.position.z - collider.z);
      const radius = collider.shape === 'cylinder' ? collider.radius : 0;
      expect(gap).toBeGreaterThanOrEqual(radius + PLAYER_RADIUS - COLLISION_SKIN_WIDTH);
    }
  });

  it('shows two players each other', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.addPlayer(2);
    drive(sim, 1, 0, 1, 20);

    const seenByOne = sim.snapshotFor(1);
    const seenByTwo = sim.snapshotFor(2);
    expect(seenByOne.map((entity) => entity.netId).sort()).toEqual([1, 2]);
    expect(seenByTwo.map((entity) => entity.netId).sort()).toEqual([1, 2]);
  });

  it('marks a walking player as moving', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    drive(sim, 1, 0, 1, 10);
    const [entity] = sim.snapshotFor(1);
    expect(entity?.flags).toBe(SnapshotFlag.Moving);
  });

  it('marks a sprinting player as sprinting, and a walking one not', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    drive(sim, 1, 0, 1, 10, 1, PlayerButton.Sprint);
    const [sprinting] = sim.snapshotFor(1);
    expect(sprinting && sprinting.flags & SnapshotFlag.Sprinting).toBeTruthy();

    const walker = createWorld();
    walker.addPlayer(1);
    drive(walker, 1, 0, 1, 40);
    const [walking] = walker.snapshotFor(1);
    expect(walking && walking.flags & SnapshotFlag.Sprinting).toBeFalsy();
  });

  it('lifts a jumping player off the ground and marks them airborne', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    drive(sim, 1, 0, 0, 1, 1, PlayerButton.Jump);

    const [entity] = sim.snapshotFor(1);
    expect(entity && entity.flags & SnapshotFlag.Airborne).toBeTruthy();
    expect(sim.readPlayer(1)?.position.y).toBeGreaterThan(0);

    // And they come back down on their own, without the client being asked.
    drive(sim, 1, 0, 0, 40, 2);
    expect(sim.readPlayer(1)?.position.y).toBe(0);
    expect(sim.readPlayer(1)?.grounded).toBe(true);
  });

  it('refuses to let a client fly by holding jump', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    let highest = 0;
    for (let i = 0; i < 200; i++) {
      sim.queueInput(1, createInput(i + 1, 0, 1, 0, PlayerButton.Jump | PlayerButton.Sprint));
      sim.step();
      highest = Math.max(highest, sim.readPlayer(1)?.position.y ?? 0);
    }
    expect(highest).toBeLessThan(1.5);
  });

  it('leaves out players who are too far away to care about', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.addPlayer(2);
    sim.placePlayer(2, { x: INTEREST_RADIUS + 50, y: 0, z: 0 }, 0);

    expect(sim.snapshotFor(1).map((entity) => entity.netId)).toEqual([1]);
    // A player always sees themselves, however far out they are.
    expect(sim.snapshotFor(2).map((entity) => entity.netId)).toEqual([2]);
  });

  it('gives the same result twice from the same inputs', () => {
    const run = (): unknown => {
      const sim = createWorld(777);
      sim.addPlayer(1);
      sim.addPlayer(2);
      for (let i = 1; i <= 100; i++) {
        sim.queueInput(1, createInput(i, Math.sin(i * 0.2), 1, i * 0.03));
        sim.queueInput(2, createInput(i, 1, Math.cos(i * 0.11), -i * 0.02));
        sim.step();
      }
      return [sim.readPlayer(1), sim.readPlayer(2)];
    };
    expect(run()).toEqual(run());
  });

  it('can save a player and put them back where they were', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    drive(sim, 1, 1, 1, 30);
    const saved = sim.persistablePlayers();
    expect(saved).toHaveLength(1);

    const reloaded = createWorld();
    const record = saved[0];
    if (!record) throw new Error('missing save');
    reloaded.addPlayer(record.netId, record);

    const before = sim.readPlayer(1);
    const after = reloaded.readPlayer(1);
    if (!before || !after) throw new Error('missing player');
    expect(after.position.x).toBeCloseTo(before.position.x, 6);
    expect(after.position.z).toBeCloseTo(before.position.z, 6);
    expect(after.facingYaw).toBeCloseTo(before.facingYaw, 6);
  });
});
