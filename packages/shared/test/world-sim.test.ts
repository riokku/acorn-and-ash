import { afterEach, describe, expect, it } from 'vitest';

import {
  ANIMAL_RESPAWN_SECONDS,
  CLEARING_TREE_LINE_INNER,
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  HUNGER_MAX,
  INTEREST_RADIUS,
  MAX_QUEUED_INPUTS_PER_PLAYER,
  MAX_TREE_GENERATION,
  PLAYER_RADIUS,
  SPAWN_POSITION,
  SWING_COOLDOWN_TICKS,
  TICK_HZ,
  TICK_MILLISECONDS,
} from '../src/constants';
import { COLLISION_SKIN_WIDTH } from '../src/collision/capsule';
import { ANIMAL_KINDS } from '../src/data/animals';
import { BUILDABLE_KINDS, type BuildableKindId } from '../src/data/buildables';
import { ITEM_KINDS } from '../src/data/items';
import { PROP_KINDS, choppingRuleFor } from '../src/data/props';
import { ANIMAL_DENS } from '../src/world/animals';
import { regrowDueAtMs } from '../src/sim/regrowth';
import { addItem, countOf } from '../src/sim/inventory';
import { PlayerButton, createInput } from '../src/sim/player';
import { AXE_PICKUP_ID, AXE_STUMP, FLOWER_PATCHES, STICK_PATCHES } from '../src/world/clearing';
import {
  inputsToConsume,
  WorldSimulation,
  SnapshotFlag,
  type PersistedPlayer,
} from '../src/sim/world-sim';

/** Every world a test builds, so they can be handed back when it finishes. */
const built: WorldSimulation[] = [];

/**
 * A clock the tests drive by hand.
 *
 * Real time only matters to regrowth, and a test that wants to watch an hour
 * pass should not have to wait for one.
 */
let clockMs = 1_700_000_000_000;
const tickClock = (): number => (clockMs += TICK_MILLISECONDS);

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
    sim.step(tickClock());
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
    for (let i = 0; i < 40; i++) sim.step(tickClock());

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
    sim.step(tickClock());
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

    // Both are within earshot of some of the hand-placed wildlife too; this
    // is about the players, so wildlife is filtered back out.
    const playerIdsSeenBy = (netId: number): number[] =>
      sim
        .snapshotFor(netId)
        .filter((entity) => (entity.flags & SnapshotFlag.Animal) === 0)
        .map((entity) => entity.netId)
        .sort((a, b) => a - b);
    expect(playerIdsSeenBy(1)).toEqual([1, 2]);
    expect(playerIdsSeenBy(2)).toEqual([1, 2]);
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
      sim.step(tickClock());
      highest = Math.max(highest, sim.readPlayer(1)?.position.y ?? 0);
    }
    expect(highest).toBeLessThan(1.5);
  });

  it('leaves out players who are too far away to care about', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.addPlayer(2);
    sim.placePlayer(2, { x: INTEREST_RADIUS + 50, y: 0, z: 0 }, 0);

    const playerIdsSeenBy = (netId: number): number[] =>
      sim
        .snapshotFor(netId)
        .filter((entity) => (entity.flags & SnapshotFlag.Animal) === 0)
        .map((entity) => entity.netId);
    expect(playerIdsSeenBy(1)).toEqual([1]);
    // A player always sees themselves, however far out they are.
    expect(playerIdsSeenBy(2)).toEqual([2]);
  });

  it('gives the same result twice from the same inputs', () => {
    const run = (): unknown => {
      const sim = createWorld(777);
      sim.addPlayer(1);
      sim.addPlayer(2);
      for (let i = 1; i <= 100; i++) {
        sim.queueInput(1, createInput(i, Math.sin(i * 0.2), 1, i * 0.03));
        sim.queueInput(2, createInput(i, 1, Math.cos(i * 0.11), -i * 0.02));
        sim.step(tickClock());
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

describe('picking the axe up', () => {
  /** Put a player next to the stump and hold the interact button for one tick. */
  function reachForTheAxe(sim: WorldSimulation, netId: number, seq = 1): void {
    sim.placePlayer(netId, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    sim.queueInput(netId, createInput(seq, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
  }

  it('does nothing while the player is somewhere else', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    drive(sim, 1, 0, 0, 1, 1, PlayerButton.Interact);
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(0);
    expect(sim.takenPickupIds()).toEqual([]);
  });

  it('does nothing while the player stands there without asking', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    expect(sim.reachablePickup(1)?.id).toBe(AXE_PICKUP_ID);

    drive(sim, 1, 0, 0, 5);
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(0);
  });

  it('hands over the axe to a player who reaches for it', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    reachForTheAxe(sim, 1);

    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
    expect(sim.takenPickupIds()).toEqual([AXE_PICKUP_ID]);
    expect(sim.drainPickupEvents()).toEqual([{ netId: 1, pickupId: AXE_PICKUP_ID, item: 'axe' }]);
  });

  it('reports each pickup exactly once', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    reachForTheAxe(sim, 1);
    expect(sim.drainPickupEvents()).toHaveLength(1);
    // Draining twice must not replay it.
    expect(sim.drainPickupEvents()).toEqual([]);
  });

  it('gives it to one player, not to both', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.addPlayer(2);
    sim.placePlayer(1, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    sim.placePlayer(2, { x: AXE_STUMP.x - 1, y: 0, z: AXE_STUMP.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    const held = countOf(sim.inventoryOf(1), 'axe') + countOf(sim.inventoryOf(2), 'axe');
    expect(held).toBe(1);
    expect(sim.takenPickupIds()).toEqual([AXE_PICKUP_ID]);
    expect(sim.drainPickupEvents()).toHaveLength(1);
  });

  it('will not hand out the same axe twice, however long you hold the button', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    for (let i = 1; i <= 30; i++) {
      sim.queueInput(1, createInput(i, 0, 0, 0, PlayerButton.Interact));
      sim.step(tickClock());
    }
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
    expect(sim.drainPickupEvents()).toHaveLength(1);
    expect(sim.reachablePickup(1)).toBeNull();
  });

  it('keeps the axe when the player logs out and comes back', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    reachForTheAxe(sim, 1);

    const saved = sim.persistablePlayers()[0];
    expect(saved?.items).toEqual([{ item: 'axe', count: 1 }]);
    sim.removePlayer(1);

    const later = createWorld();
    later.restoreTakenPickups(sim.takenPickupIds());
    if (saved === undefined) throw new Error('nothing was saved');
    later.addPlayer(9, saved);

    expect(countOf(later.inventoryOf(9), 'axe')).toBe(1);
    // And it is not sitting in the stump waiting to be found a second time.
    later.placePlayer(9, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    expect(later.reachablePickup(9)).toBeNull();
  });

  it('starts a brand new player with nothing', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    expect(sim.inventoryOf(1)).toEqual({});
    expect(sim.persistablePlayers()[0]?.items).toEqual([]);
  });
});

describe('hunger', () => {
  function createHungryWorld(hungerEmptyAfterSeconds: number): WorldSimulation {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, hungerEmptyAfterSeconds });
    built.push(sim);
    return sim;
  }

  function withFish(netId: number, hunger: number, count = 2): PersistedPlayer {
    return {
      netId,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'perch', count }],
      hunger,
    };
  }

  it('starts a new player full', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    expect(sim.hungerOf(1)).toBe(HUNGER_MAX);
  });

  it('drains while the world ticks, at the pace it is given', () => {
    const sim = createHungryWorld(10);
    sim.addPlayer(1);
    drive(sim, 1, 0, 0, TICK_HZ * 5);
    expect(sim.hungerOf(1)).toBeCloseTo(50, 0);
  });

  it('never drains below zero', () => {
    const sim = createHungryWorld(1);
    sim.addPlayer(1);
    drive(sim, 1, 0, 0, TICK_HZ * 5);
    expect(sim.hungerOf(1)).toBe(0);
  });

  it('does nothing when there is nothing to eat', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(sim.drainHungerEvents()).toEqual([]);
  });

  it('eats a fish when the player asks and it would help', () => {
    const sim = createWorld();
    sim.addPlayer(1, withFish(1, 50));
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(1);
    expect(sim.hungerOf(1)).toBe(90);
    expect(sim.drainHungerEvents()).toEqual([{ netId: 1, hunger: 90, ate: 'perch' }]);
  });

  it('reports each meal exactly once', () => {
    const sim = createWorld();
    sim.addPlayer(1, withFish(1, 50));
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(sim.drainHungerEvents()).toHaveLength(1);
    expect(sim.drainHungerEvents()).toEqual([]);
  });

  it('picking something up still wins over eating', () => {
    const sim = createWorld();
    sim.addPlayer(1, withFish(1, 50));
    sim.placePlayer(1, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(2);
  });

  it('keeps hunger across logging out and coming back', () => {
    const sim = createHungryWorld(10);
    sim.addPlayer(1);
    drive(sim, 1, 0, 0, TICK_HZ * 3);
    const before = sim.hungerOf(1);

    const saved = sim.persistablePlayers()[0];
    if (saved === undefined) throw new Error('nothing was saved');
    sim.removePlayer(1);

    const later = createWorld();
    later.addPlayer(9, saved);
    expect(later.hungerOf(9)).toBe(before);
  });
});

describe('gathering sticks', () => {
  const spot = STICK_PATCHES[0];
  if (spot === undefined) throw new Error('no stick patch to test against');

  it('gathers one when a patch is in reach', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
  });

  it('does nothing far from every patch', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(0);
  });

  it('is never used up: two players can draw from the same patch at once', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.addPlayer(2);
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.placePlayer(2, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
    expect(countOf(sim.inventoryOf(2), 'stick')).toBe(1);
  });

  it('will not gather faster than the cooldown allows', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);

    // Hold the button down for one cooldown's worth of ticks, the same as a
    // held axe only lands one swing.
    for (let i = 1; i <= SWING_COOLDOWN_TICKS; i++) {
      sim.queueInput(1, createInput(i, 0, 0, 0, PlayerButton.Interact));
      sim.step(tickClock());
    }
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
  });

  it('wins over eating, the same as a pickup does', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'perch', count: 1 }],
      hunger: 50,
    });
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(1);
    expect(sim.hungerOf(1)).toBe(50);
  });

  it('falls through to eating once the stick pile is full', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'stick', count: ITEM_KINDS.stick.maxCarry },
        { item: 'perch', count: 1 },
      ],
      hunger: 50,
    });
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(0);
    expect(sim.hungerOf(1)).toBeGreaterThan(50);
  });
});

describe('gathering flowers', () => {
  const spot = FLOWER_PATCHES[0];
  if (spot === undefined) throw new Error('no flower patch to test against');

  it('gathers a flower, not a stick, at a flower patch', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'flower')).toBe(1);
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(0);
  });
});

describe('crafting', () => {
  const withSticks = (netId: number, count = 3): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [{ item: 'stick', count }],
    hunger: HUNGER_MAX,
  });

  it('makes an axe out of sticks', () => {
    const sim = createWorld();
    sim.addPlayer(1, withSticks(1, 3));
    expect(sim.craftItem(1, 'axe')).toBe(true);
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(0);
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
  });

  it('does nothing without enough materials, and spends nothing either', () => {
    const sim = createWorld();
    sim.addPlayer(1, withSticks(1, 2));
    expect(sim.craftItem(1, 'axe')).toBe(false);
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(2);
  });

  it('refuses a craft the pack has no room for', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'axe', count: 1 },
        { item: 'stick', count: 3 },
      ],
      hunger: HUNGER_MAX,
    });
    expect(sim.craftItem(1, 'axe')).toBe(false);
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(3);
  });

  it('takes effect immediately, without waiting for a tick to run', () => {
    const sim = createWorld();
    sim.addPlayer(1, withSticks(1, 3));
    sim.craftItem(1, 'axe');
    // No sim.step() call at all: unlike chopping or picking things up,
    // crafting is not tied to the fixed-step simulation.
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
  });

  it('reports each craft exactly once', () => {
    const sim = createWorld();
    sim.addPlayer(1, withSticks(1, 3));
    sim.craftItem(1, 'axe');
    expect(sim.drainCraftEvents()).toEqual([{ netId: 1, item: 'axe' }]);
    expect(sim.drainCraftEvents()).toEqual([]);
  });

  it('does nothing for a player who is not in the world', () => {
    const sim = createWorld();
    expect(sim.craftItem(99, 'axe')).toBe(false);
    expect(sim.drainCraftEvents()).toEqual([]);
  });
});

describe('chopping a tree down', () => {
  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [{ item: 'axe', count: 1 }],
    hunger: HUNGER_MAX,
  });

  /** The first tree of this kind in the clearing. */
  function findTree(sim: WorldSimulation, kind: 'oak' | 'birch' | 'pine') {
    const tree = sim.clearing.props.find((prop) => prop.kind === kind);
    if (tree === undefined) throw new Error(`no ${kind} in the clearing`);
    return tree;
  }

  /** Stand a metre clear of the trunk, looking straight at it. */
  function standAt(
    sim: WorldSimulation,
    netId: number,
    tree: { x: number; z: number; kind: string; scale: number },
  ): void {
    const radius = PROP_KINDS[tree.kind as keyof typeof PROP_KINDS].colliderRadius * tree.scale;
    sim.placePlayer(netId, { x: tree.x, y: 0, z: tree.z + radius + 1 }, 0);
  }

  /** Swing until the tree is down, or give up. Returns how many swings landed. */
  function swingUntilFelled(sim: WorldSimulation, netId: number, treeId: number): number {
    let landed = 0;
    let seq = 1;
    for (let tick = 0; tick < 200; tick++) {
      sim.queueInput(netId, createInput(seq++, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
      landed += sim.drainChopEvents().length;
      if (sim.felledTreeIds().includes(treeId)) return landed;
    }
    throw new Error('the tree never came down');
  }

  it('does nothing at all without an axe', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    for (let i = 1; i <= 40; i++) {
      sim.queueInput(1, createInput(i, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
    }

    expect(sim.felledTreeIds()).toEqual([]);
    expect(sim.drainChopEvents()).toEqual([]);
    expect(sim.swingsLeftOn(tree.id)).toBe(choppingRuleFor(PROP_KINDS.oak)?.swingsToFell);
  });

  it('takes the number of swings the tree is worth', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    const expected = choppingRuleFor(PROP_KINDS.oak)?.swingsToFell ?? 0;
    expect(swingUntilFelled(sim, 1, tree.id)).toBe(expected);
  });

  it('counts down as you go, so you can see it coming', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'birch');
    standAt(sim, 1, tree);
    const total = choppingRuleFor(PROP_KINDS.birch)?.swingsToFell ?? 0;

    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Swing));
    sim.step(tickClock());

    expect(sim.drainChopEvents()).toEqual([
      { netId: 1, treeId: tree.id, swingsLeft: total - 1, logsGained: 0 },
    ]);
    expect(sim.swingsLeftOn(tree.id)).toBe(total - 1);
  });

  it('will not chop faster than the axe swings', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    // Hold the button down for one cooldown's worth of ticks.
    let landed = 0;
    for (let i = 1; i <= SWING_COOLDOWN_TICKS; i++) {
      sim.queueInput(1, createInput(i, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
      landed += sim.drainChopEvents().length;
    }
    expect(landed).toBe(1);
  });

  it("puts the logs in the chopper's pack", () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);
    swingUntilFelled(sim, 1, tree.id);

    expect(countOf(sim.inventoryOf(1), 'log')).toBe(choppingRuleFor(PROP_KINDS.oak)?.logs);
  });

  it('leaves the tree down and out of the way', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    const index = sim.clearing.indexById.get(tree.id);
    if (index === undefined) throw new Error('tree has no collider');
    const before = sim.collision.colliders[index];
    standAt(sim, 1, tree);
    swingUntilFelled(sim, 1, tree.id);

    const after = sim.collision.colliders[index];
    expect(sim.felledTreeIds()).toEqual([tree.id]);
    expect(sim.swingsLeftOn(tree.id)).toBeNull();
    // You can walk where the trunk was: only the stump is left to bump into.
    if (before?.shape !== 'cylinder' || after?.shape !== 'cylinder') {
      throw new Error('expected cylinders');
    }
    expect(after.radius).toBeLessThan(before.radius);
    expect(after.height).toBeLessThan(before.height);
  });

  it('cannot be chopped twice', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'birch');
    standAt(sim, 1, tree);
    swingUntilFelled(sim, 1, tree.id);
    const logsAfterFirst = countOf(sim.inventoryOf(1), 'log');

    for (let i = 500; i < 560; i++) {
      sim.queueInput(1, createInput(i, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
    }
    expect(sim.drainChopEvents()).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(logsAfterFirst);
    expect(sim.treeInReachOf({ x: tree.x, y: 0, z: tree.z + 1.5 }, 0)).toBeNull();
  });

  it('still fells a tree when the pack is full, and says no logs were gained', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      ...withAxe(1),
      items: [
        { item: 'axe', count: 1 },
        { item: 'log', count: 10 },
      ],
    });
    const tree = findTree(sim, 'birch');
    standAt(sim, 1, tree);

    let lastEvent: { swingsLeft: number; logsGained: number } | undefined;
    let seq = 1;
    for (let tick = 0; tick < 200; tick++) {
      sim.queueInput(1, createInput(seq++, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
      for (const event of sim.drainChopEvents()) lastEvent = event;
      if (sim.felledTreeIds().includes(tree.id)) break;
    }

    expect(sim.felledTreeIds()).toEqual([tree.id]);
    expect(lastEvent?.swingsLeft).toBe(0);
    expect(lastEvent?.logsGained).toBe(0);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(10);
  });

  it('remembers half-chopped trees and felled ones across a restart', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const felled = findTree(sim, 'birch');
    standAt(sim, 1, felled);
    swingUntilFelled(sim, 1, felled.id);

    const halfDone = findTree(sim, 'oak');
    standAt(sim, 1, halfDone);
    sim.queueInput(1, createInput(900, 0, 0, 0, PlayerButton.Swing));
    sim.step(tickClock());
    const swingsLeft = sim.swingsLeftOn(halfDone.id);

    const saved = sim.persistableTrees();
    const later = createWorld();
    later.restoreTrees(saved);

    expect(later.felledTreeIds()).toEqual([felled.id]);
    expect(later.swingsLeftOn(halfDone.id)).toBe(swingsLeft);
    // And the stump is still standing in for the trunk after the restart.
    const index = later.clearing.indexById.get(felled.id);
    const collider = index === undefined ? undefined : later.collision.colliders[index];
    if (collider?.shape !== 'cylinder') throw new Error('expected a cylinder');
    expect(collider.height).toBeLessThan(1);
  });

  it('reports each swing exactly once', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'birch');
    standAt(sim, 1, tree);

    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Swing));
    sim.step(tickClock());
    expect(sim.drainChopEvents()).toHaveLength(1);
    expect(sim.drainChopEvents()).toEqual([]);
  });
});

describe('trees growing back', () => {
  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [{ item: 'axe', count: 1 }],
    hunger: HUNGER_MAX,
  });

  function findTree(sim: WorldSimulation, kind: 'oak' | 'birch' | 'pine') {
    const tree = sim.clearing.props.find((prop) => prop.kind === kind);
    if (tree === undefined) throw new Error(`no ${kind} in the clearing`);
    return tree;
  }

  /** Chop a tree down and report when it is due back. */
  function fell(sim: WorldSimulation, netId: number, kind: 'oak' | 'birch' | 'pine') {
    const tree = findTree(sim, kind);
    const radius = PROP_KINDS[tree.kind].colliderRadius * tree.scale;
    sim.placePlayer(netId, { x: tree.x, y: 0, z: tree.z + radius + 1 }, 0);

    let seq = 1;
    let felledAt = 0;
    for (let tick = 0; tick < 200; tick++) {
      sim.queueInput(netId, createInput(seq++, 0, 0, 0, PlayerButton.Swing));
      felledAt = tickClock();
      sim.step(felledAt);
      if (sim.isFelled(tree.id)) break;
    }
    if (!sim.isFelled(tree.id)) throw new Error('the tree never came down');
    return { tree, dueAt: regrowDueAtMs(sim.seed, tree.id, 0, felledAt) };
  }

  it('leaves the stump alone until its time is up', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const { tree, dueAt } = fell(sim, 1, 'birch');

    expect(sim.regrowTrees(dueAt - 60_000)).toEqual([]);
    expect(sim.isFelled(tree.id)).toBe(true);
  });

  it('brings the tree back once it is due', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const { tree, dueAt } = fell(sim, 1, 'birch');
    // Stand well clear so the spot is free.
    sim.placePlayer(1, { x: 0, y: 0, z: 25 }, 0);

    expect(sim.regrowTrees(dueAt)).toEqual([{ treeId: tree.id, generation: 1 }]);
    expect(sim.isFelled(tree.id)).toBe(false);
    expect(sim.generationOf(tree.id)).toBe(1);
  });

  it('reports each return exactly once', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const { dueAt } = fell(sim, 1, 'birch');
    sim.placePlayer(1, { x: 0, y: 0, z: 25 }, 0);

    expect(sim.regrowTrees(dueAt)).toHaveLength(1);
    expect(sim.regrowTrees(dueAt + 60_000)).toEqual([]);
  });

  it('will not grow through somebody standing on the spot', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const { tree, dueAt } = fell(sim, 1, 'birch');
    sim.placePlayer(1, { x: tree.x, y: 0, z: tree.z }, 0);

    // Long overdue, but occupied.
    expect(sim.regrowTrees(dueAt + 10 * 60_000)).toEqual([]);
    expect(sim.isFelled(tree.id)).toBe(true);

    // It comes back the moment they wander off.
    sim.placePlayer(1, { x: 0, y: 0, z: 25 }, 0);
    expect(sim.regrowTrees(dueAt + 10 * 60_000)).toHaveLength(1);
    expect(sim.isFelled(tree.id)).toBe(false);
  });

  it('comes back as a tree you can bump into and chop again', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const { tree, dueAt } = fell(sim, 1, 'birch');
    const index = sim.clearing.indexById.get(tree.id);
    if (index === undefined) throw new Error('tree has no collider');

    const asStump = sim.collision.colliders[index];
    sim.placePlayer(1, { x: 0, y: 0, z: 25 }, 0);
    sim.regrowTrees(dueAt);
    const asTree = sim.collision.colliders[index];

    if (asStump?.shape !== 'cylinder' || asTree?.shape !== 'cylinder') {
      throw new Error('expected cylinders');
    }
    expect(asTree.height).toBeGreaterThan(asStump.height);
    expect(sim.swingsLeftOn(tree.id)).toBe(choppingRuleFor(PROP_KINDS.birch)?.swingsToFell);

    // And reach finds it again, at whatever size it came back.
    const inFront = { x: tree.x, y: 0, z: tree.z + asTree.radius + 1 };
    expect(sim.treeInReachOf(inFront, 0)?.prop.id).toBe(tree.id);
  });

  it('comes back a different size from the one that was cut', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const { tree, dueAt } = fell(sim, 1, 'birch');
    const index = sim.clearing.indexById.get(tree.id);
    if (index === undefined) throw new Error('tree has no collider');

    sim.placePlayer(1, { x: 0, y: 0, z: 25 }, 0);
    sim.regrowTrees(dueAt);

    const grown = sim.collision.colliders[index];
    if (grown?.shape !== 'cylinder') throw new Error('expected a cylinder');
    const originalRadius = PROP_KINDS.birch.colliderRadius * tree.scale;
    expect(grown.radius).not.toBeCloseTo(originalRadius, 6);
  });

  it('counts the wait through a world that was asleep', () => {
    // The whole point: a world with nobody in it does not tick, so a tree
    // felled before bed has to be back by morning.
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const { tree, dueAt } = fell(sim, 1, 'birch');
    const saved = sim.persistableTrees();
    expect(saved.find((entry) => entry.treeId === tree.id)?.felledAtMs).toBeGreaterThan(0);

    const later = createWorld();
    later.restoreTrees(saved);
    expect(later.isFelled(tree.id)).toBe(true);

    // Nobody is in this world at all, and the due time has long passed.
    expect(later.regrowTrees(dueAt + 60 * 60_000)).toEqual([{ treeId: tree.id, generation: 1 }]);
  });

  it('remembers how many times a spot has grown back', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const { tree, dueAt } = fell(sim, 1, 'birch');
    sim.placePlayer(1, { x: 0, y: 0, z: 25 }, 0);
    sim.regrowTrees(dueAt);

    const saved = sim.persistableTrees().find((entry) => entry.treeId === tree.id);
    expect(saved?.generation).toBe(1);
    expect(saved?.felled).toBe(false);

    const later = createWorld();
    later.restoreTrees(sim.persistableTrees());
    expect(later.generationOf(tree.id)).toBe(1);
    // And it is the same tree as the one that grew, not the seeded one.
    const index = later.clearing.indexById.get(tree.id);
    const restored = index === undefined ? undefined : later.collision.colliders[index];
    const inThisWorld = index === undefined ? undefined : sim.collision.colliders[index];
    expect(restored).toEqual(inThisWorld);
  });

  it('stops counting at the cap instead of growing a tree nobody else can draw', () => {
    // The count is what both ends work the size out from, and it travels in one
    // byte. A spot chopped past that goes on growing trees; it simply stops
    // counting, so the server and every browser stay of one mind about it.
    const sim = createWorld();
    const tree = findTree(sim, 'birch');
    const felledAtMs = 1_700_000_000_000;
    sim.restoreTrees([
      {
        treeId: tree.id,
        swingsTaken: 0,
        felled: true,
        felledAtMs,
        generation: MAX_TREE_GENERATION,
      },
    ]);

    const dueAt = regrowDueAtMs(sim.seed, tree.id, MAX_TREE_GENERATION, felledAtMs);
    expect(sim.regrowTrees(dueAt)).toEqual([{ treeId: tree.id, generation: MAX_TREE_GENERATION }]);
    expect(sim.isFelled(tree.id)).toBe(false);
    expect(sim.generationOf(tree.id)).toBe(MAX_TREE_GENERATION);
  });

  it('leaves untouched trees out of storage entirely', () => {
    const sim = createWorld();
    expect(sim.persistableTrees()).toEqual([]);
    expect(sim.changedTrees()).toEqual([]);
  });
});

describe('wildlife', () => {
  /** An animal entity out of a snapshot, or throws: every test here expects one. */
  function animalEntity(sim: WorldSimulation, viewerNetId: number, animalId: number) {
    const found = sim
      .snapshotFor(viewerNetId)
      .find((entity) => entity.netId === animalId && (entity.flags & SnapshotFlag.Animal) !== 0);
    if (found === undefined) throw new Error(`Animal ${animalId} was not in the snapshot`);
    return found;
  }

  it('spawns one animal per den, flagged as wildlife and nowhere else', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const entities = sim.snapshotFor(1);
    const animals = entities.filter((entity) => (entity.flags & SnapshotFlag.Animal) !== 0);
    expect(animals.map((entity) => entity.netId).sort()).toEqual(
      ANIMAL_DENS.map((den) => den.id).sort(),
    );
    // The one player in this snapshot is not mistaken for wildlife.
    expect(entities.filter((entity) => (entity.flags & SnapshotFlag.Animal) === 0)).toHaveLength(1);
  });

  it('starts sitting right at its den', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const den = ANIMAL_DENS[0];
    if (den === undefined) throw new Error('no den to test against');
    const entity = animalEntity(sim, 1, den.id);
    expect(entity.x).toBeCloseTo(den.x, 5);
    expect(entity.z).toBeCloseTo(den.z, 5);
  });

  it('ambles about without ever wandering past its leash', () => {
    const sim = createWorld();
    // Left at the default spawn point, which every den is well clear of, so
    // nothing here ever startles.
    sim.addPlayer(1);
    const den = ANIMAL_DENS[0];
    if (den === undefined) throw new Error('no den to test against');
    const leash = ANIMAL_KINDS.rabbit.leashRadius;

    let moved = false;
    for (let i = 0; i < 600; i++) {
      sim.step(tickClock());
      const entity = animalEntity(sim, 1, den.id);
      const distanceFromDen = Math.hypot(entity.x - den.x, entity.z - den.z);
      expect(distanceFromDen).toBeLessThanOrEqual(leash + 0.2);
      if (distanceFromDen > 0.5) moved = true;
    }
    // Not just sitting still the whole time - it actually went somewhere.
    expect(moved).toBe(true);
  });

  it('bolts once a player gets close, and puts distance between them', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const den = ANIMAL_DENS[0];
    if (den === undefined) throw new Error('no den to test against');
    // Well inside the alert radius.
    sim.placePlayer(1, { x: den.x, y: 0, z: den.z + 1 }, 0);

    const distanceToPlayer = (): number => {
      const entity = animalEntity(sim, 1, den.id);
      return Math.hypot(entity.x - den.x, entity.z - (den.z + 1));
    };

    const before = distanceToPlayer();
    for (let i = 0; i < 40; i++) sim.step(tickClock());
    expect(distanceToPlayer()).toBeGreaterThan(before);
  });

  it('only tells a player about wildlife within the interest radius', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    // Nowhere near any of the hand-placed dens.
    sim.placePlayer(1, { x: 140, y: 0, z: 140 }, 0);
    const animals = sim
      .snapshotFor(1)
      .filter((entity) => (entity.flags & SnapshotFlag.Animal) !== 0);
    expect(animals).toEqual([]);
  });
});

describe('catching wildlife', () => {
  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [{ item: 'axe', count: 1 }],
    hunger: HUNGER_MAX,
  });

  const den = ANIMAL_DENS.find((entry) => entry.id === 1002);
  if (den === undefined) throw new Error('den 1002 is gone from the data table');

  // Standing north of the den, at greater z. Yaw 0 looks down -Z, so this
  // faces the den; the same convention `treeInReach`'s own tests use.
  const facingDen = { x: den.x, y: 0, z: den.z + 1.5 };
  const FACE_DEN = 0;
  const FACE_AWAY = Math.PI;

  /** Stand a couple of metres from the den, facing straight at it. */
  function standByDen(sim: WorldSimulation, netId: number): void {
    sim.placePlayer(netId, facingDen, FACE_DEN);
  }

  it('finds the animal sitting at its den', () => {
    const sim = createWorld();
    expect(sim.animalInReachOf(facingDen, FACE_DEN)).toEqual({ id: den.id, kind: 'rabbit' });
  });

  it('finds nothing facing away from the den', () => {
    const sim = createWorld();
    expect(sim.animalInReachOf(facingDen, FACE_AWAY)).toBeNull();
  });

  it('finds nothing too far from the den to reach', () => {
    const sim = createWorld();
    expect(sim.animalInReachOf({ x: den.x, y: 0, z: den.z + 20 }, FACE_DEN)).toBeNull();
  });

  it('catches the animal with a swing of the axe, and pays out its item', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    standByDen(sim, 1);

    sim.queueInput(1, createInput(1, 0, 0, FACE_DEN, PlayerButton.Swing));
    sim.step(tickClock());

    expect(sim.drainCatchEvents()).toEqual([{ netId: 1, item: 'meat', added: 1 }]);
    expect(countOf(sim.inventoryOf(1), 'meat')).toBe(1);
  });

  it('never lets a tree hide behind a rabbit: a swing near a den has no tree to prefer', () => {
    // Wildlife dens sit well past the clearing's own tree line, and only
    // clearing trees are ever chopping targets (see decision 0015): the
    // wilderness is scenery only. So a swing here can only ever be at most
    // one thing, and this is that there is nothing else it could be.
    const sim = createWorld();
    expect(sim.treeInReachOf(facingDen, FACE_DEN)).toBeNull();
  });

  it('refuses to catch anything without an axe', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    standByDen(sim, 1);

    sim.queueInput(1, createInput(1, 0, 0, FACE_DEN, PlayerButton.Swing));
    sim.step(tickClock());

    expect(sim.drainCatchEvents()).toEqual([]);
  });

  it('still counts as caught when the pack has no room for the meat', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      ...withAxe(1),
      items: [
        { item: 'axe', count: 1 },
        { item: 'meat', count: ITEM_KINDS.meat.maxCarry },
      ],
    });
    standByDen(sim, 1);

    sim.queueInput(1, createInput(1, 0, 0, FACE_DEN, PlayerButton.Swing));
    sim.step(tickClock());

    expect(sim.drainCatchEvents()).toEqual([{ netId: 1, item: 'meat', added: 0 }]);
    expect(countOf(sim.inventoryOf(1), 'meat')).toBe(ITEM_KINDS.meat.maxCarry);
  });

  it('vanishes from every snapshot the moment it is caught', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    standByDen(sim, 1);

    sim.queueInput(1, createInput(1, 0, 0, FACE_DEN, PlayerButton.Swing));
    sim.step(tickClock());

    const stillThere = sim
      .snapshotFor(1)
      .some((entity) => entity.netId === den.id && (entity.flags & SnapshotFlag.Animal) !== 0);
    expect(stillThere).toBe(false);
  });

  it('is back at its den, catchable again, once the respawn wait is up', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    standByDen(sim, 1);

    let seq = 1;
    sim.queueInput(1, createInput(seq++, 0, 0, FACE_DEN, PlayerButton.Swing));
    const caughtAt = tickClock();
    sim.step(caughtAt);
    expect(sim.drainCatchEvents()).toHaveLength(1);

    // Short of the wait: still gone. Also clears the axe's own swing cooldown
    // from the first catch, well before the animal is due back - a rabbit
    // fresh from its den gets one wander tick's start on running off again,
    // so nothing here can afford to dawdle once it reappears.
    for (let i = 0; i < SWING_COOLDOWN_TICKS; i++) {
      sim.queueInput(1, createInput(seq++, 0, 0, FACE_DEN, 0));
      sim.step(tickClock());
    }
    expect(
      sim
        .snapshotFor(1)
        .some((entity) => entity.netId === den.id && (entity.flags & SnapshotFlag.Animal) !== 0),
    ).toBe(false);

    // Push real time past the respawn wait in one jump, the same way regrowth
    // catches up after a gap: nothing here depends on having ticked through it.
    sim.queueInput(1, createInput(seq++, 0, 0, FACE_DEN, 0));
    sim.step(caughtAt + ANIMAL_RESPAWN_SECONDS * 1000 + TICK_MILLISECONDS);

    const backAgain = sim
      .snapshotFor(1)
      .find((entity) => entity.netId === den.id && (entity.flags & SnapshotFlag.Animal) !== 0);
    expect(backAgain).toBeDefined();
    expect(backAgain?.x).toBeCloseTo(den.x, 3);
    expect(backAgain?.z).toBeCloseTo(den.z, 3);

    // Worth a swing on the very next tick, before it has had any chance to
    // wander off the spot it just reappeared on.
    sim.queueInput(1, createInput(seq, 0, 0, FACE_DEN, PlayerButton.Swing));
    sim.step(tickClock());
    expect(sim.drainCatchEvents()).toEqual([{ netId: 1, item: 'meat', added: 1 }]);
  });
});

describe('threats', () => {
  const raccoonDen = ANIMAL_DENS.find((entry) => entry.id === 1005);
  if (raccoonDen === undefined)
    throw new Error('the masked raccoon den is gone from the data table');
  const threat = ANIMAL_KINDS.maskedRaccoon.threat;
  if (threat === undefined) throw new Error('the masked raccoon has lost its threat behaviour');
  // Right at attack range: close enough that it never has to chase to reach it.
  const closeToDen = { x: raccoonDen.x, y: 0, z: raccoonDen.z + threat.attackRadius - 0.1 };

  /** An animal entity out of a snapshot, or throws: every test here expects one. */
  function animalEntity(sim: WorldSimulation, viewerNetId: number, animalId: number) {
    const found = sim
      .snapshotFor(viewerNetId)
      .find((entity) => entity.netId === animalId && (entity.flags & SnapshotFlag.Animal) !== 0);
    if (found === undefined) throw new Error(`Animal ${animalId} was not in the snapshot`);
    return found;
  }

  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [{ item: 'axe', count: 1 }],
    hunger: HUNGER_MAX,
  });

  it('is marked as a threat, unlike a rabbit', () => {
    expect(ANIMAL_KINDS.maskedRaccoon.threat).toBeDefined();
    expect('threat' in ANIMAL_KINDS.rabbit).toBe(false);
  });

  it('closes the distance once a player is near, instead of fleeing', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    // Inside the alert radius, but outside attack range.
    sim.placePlayer(1, { x: raccoonDen.x, y: 0, z: raccoonDen.z + 5 }, 0);

    const gap = (): number => {
      const entity = animalEntity(sim, 1, raccoonDen.id);
      return Math.hypot(entity.x - raccoonDen.x, entity.z - (raccoonDen.z + 5));
    };
    const before = gap();
    for (let i = 0; i < 10; i++) sim.step(tickClock());
    expect(gap()).toBeLessThan(before);
  });

  it('freezes dead still to wind up once close enough to attack', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, closeToDen, 0);

    sim.step(tickClock());
    const first = animalEntity(sim, 1, raccoonDen.id);
    sim.step(tickClock());
    const second = animalEntity(sim, 1, raccoonDen.id);
    expect(second.x).toBeCloseTo(first.x, 5);
    expect(second.z).toBeCloseTo(first.z, 5);
    expect(second.vx).toBe(0);
    expect(second.vz).toBe(0);
  });

  it('lands a hit if you stay close through the wind-up', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, closeToDen, 0);

    // Comfortably past one wind-up (twelve ticks), short of the cooldown
    // after it (thirty more) - exactly one hit should have landed.
    for (let i = 0; i < 20; i++) sim.step(tickClock());
    expect(sim.healthOf(1)).toBe(HEALTH_MAX - threat.damage);
  });

  it('misses if you back out of range before the wind-up finishes', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, closeToDen, 0);

    sim.step(tickClock()); // starts the wind-up
    sim.placePlayer(1, { x: raccoonDen.x, y: 0, z: raccoonDen.z + 20 }, 0);
    for (let i = 0; i < 20; i++) sim.step(tickClock());
    expect(sim.healthOf(1)).toBe(HEALTH_MAX);
  });

  it('will not attack again until the cooldown passes, even standing right there', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, closeToDen, 0);

    for (let i = 0; i < 20; i++) sim.step(tickClock());
    expect(sim.healthOf(1)).toBe(HEALTH_MAX - threat.damage);

    // Forty ticks in total is still short of the cooldown ending at forty-two.
    for (let i = 0; i < 20; i++) sim.step(tickClock());
    expect(sim.healthOf(1)).toBe(HEALTH_MAX - threat.damage);
  });

  it('winds up again once the cooldown passes, if you are still close', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, closeToDen, 0);

    // Just past two full wind-up-then-cooldown cycles (forty-two ticks
    // each), short of a third wind-up resolving.
    for (let i = 0; i < 90; i++) sim.step(tickClock());
    expect(sim.healthOf(1)).toBe(HEALTH_MAX - threat.damage * 2);
  });

  it('takes several swings to fight off, one ThreatHit short each time', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    sim.placePlayer(1, closeToDen, 0);

    let seq = 1;
    for (let hit = 1; hit < threat.hitsToDefeat; hit++) {
      sim.queueInput(1, createInput(seq++, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
      expect(sim.drainThreatHitEvents()).toEqual([
        { animalId: raccoonDen.id, hitsLeft: threat.hitsToDefeat - hit },
      ]);
      expect(sim.drainCatchEvents()).toEqual([]);
      for (let i = 0; i < SWING_COOLDOWN_TICKS; i++) {
        sim.queueInput(1, createInput(seq++, 0, 0, 0, 0));
        sim.step(tickClock());
      }
    }

    sim.queueInput(1, createInput(seq, 0, 0, 0, PlayerButton.Swing));
    sim.step(tickClock());
    expect(sim.drainCatchEvents()).toEqual([{ netId: 1, item: null, added: 0 }]);
  });

  it('reports full hits again once a defeated one comes back', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    sim.placePlayer(1, closeToDen, 0);

    let seq = 1;
    let defeatedAt = 0;
    for (let hit = 1; hit <= threat.hitsToDefeat; hit++) {
      sim.queueInput(1, createInput(seq++, 0, 0, 0, PlayerButton.Swing));
      defeatedAt = tickClock();
      sim.step(defeatedAt);
      sim.drainThreatHitEvents();
      sim.drainCatchEvents();
      for (let i = 0; i < SWING_COOLDOWN_TICKS; i++) {
        sim.queueInput(1, createInput(seq++, 0, 0, 0, 0));
        sim.step(tickClock());
      }
    }

    sim.queueInput(1, createInput(seq, 0, 0, 0, 0));
    sim.step(defeatedAt + ANIMAL_RESPAWN_SECONDS * 1000 + TICK_MILLISECONDS);
    expect(sim.drainThreatHitEvents()).toEqual([
      { animalId: raccoonDen.id, hitsLeft: threat.hitsToDefeat },
    ]);
  });

  describe('a knockout', () => {
    it('teleports you away and heals fully once health empties', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, closeToDen, 0);

      // Four full wind-up-then-cooldown cycles: enough to empty a hundred
      // health at twenty-five a hit, with room to spare before a fifth starts.
      for (let i = 0; i < 4 * 42; i++) sim.step(tickClock());

      expect(sim.healthOf(1)).toBe(HEALTH_MAX);
      const position = sim.snapshotFor(1).find((entity) => entity.netId === 1);
      expect(position).toBeDefined();
      if (position === undefined) return;
      const gapFromDen = Math.hypot(position.x - raccoonDen.x, position.z - raccoonDen.z);
      expect(gapFromDen).toBeGreaterThan(20);
    });

    it('wakes you at your own cabin instead, if you have one', () => {
      const sim = createWorld();
      sim.addPlayer(
        1,
        {
          netId: 1,
          x: 0,
          y: 0,
          z: 0,
          facingYaw: 0,
          items: [{ item: 'log', count: 10 }],
          hunger: HUNGER_MAX,
        },
        'chris',
      );
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
      sim.requestBuild(1, 'cabin');
      sim.queueInput(1, createInput(1, 0, 0, 0, 0));
      sim.step(tickClock());
      const home = sim.drainBuildEvents()[0]?.prop;
      expect(home).toBeDefined();
      if (home === undefined) return;

      sim.placePlayer(1, closeToDen, 0);
      for (let i = 0; i < 4 * 42; i++) sim.step(tickClock());

      const position = sim.snapshotFor(1).find((entity) => entity.netId === 1);
      expect(position).toBeDefined();
      if (position === undefined) return;
      const gapFromHome = Math.hypot(position.x - home.x, position.z - home.z);
      expect(gapFromHome).toBeGreaterThan(BUILDABLE_KINDS.cabin.footprintRadius);
      expect(gapFromHome).toBeLessThan(BUILDABLE_KINDS.cabin.footprintRadius + 3);
    });

    it("a player's health survives a save and restore, the same as hunger does", () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, closeToDen, 0);
      for (let i = 0; i < 20; i++) sim.step(tickClock());
      expect(sim.healthOf(1)).toBe(HEALTH_MAX - threat.damage);

      const saved = sim.persistablePlayers().find((player) => player.netId === 1);
      expect(saved).toBeDefined();
      if (saved === undefined) return;
      expect(saved.health).toBe(HEALTH_MAX - threat.damage);

      const restored = createWorld();
      restored.addPlayer(2, { ...saved, netId: 2 });
      expect(restored.healthOf(2)).toBe(HEALTH_MAX - threat.damage);
    });
  });
});

describe('building', () => {
  const withLogs = (netId: number, count = 4): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [{ item: 'log', count }],
    hunger: HUNGER_MAX,
  });
  const FACE_OUT = 0;

  /** Idle ticks, so the shared cooldown from a previous swing or build clears. */
  function waitOutCooldown(sim: WorldSimulation, netId: number, seq: number): number {
    for (let i = 0; i < SWING_COOLDOWN_TICKS; i++) {
      sim.queueInput(netId, createInput(seq++, 0, 0, FACE_OUT, 0));
      sim.step(tickClock());
    }
    return seq;
  }

  /** Ask to build, aimed FACE_OUT unless told otherwise, and let one tick settle it. */
  function requestAndStep(
    sim: WorldSimulation,
    netId: number,
    kind: BuildableKindId,
    seq: number,
    yaw = FACE_OUT,
  ): void {
    sim.requestBuild(netId, kind);
    sim.queueInput(netId, createInput(seq, 0, 0, yaw, 0));
    sim.step(tickClock());
  }

  it('places a campfire in front of you, and spends the logs', () => {
    const sim = createWorld();
    sim.addPlayer(1, withLogs(1));
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);

    const events = sim.drainBuildEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.netId).toBe(1);
    expect(events[0]?.prop.kind).toBe('campfire');
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    expect(sim.builtPropsList()).toEqual([events[0]?.prop]);
  });

  it('refuses without enough logs, and spends nothing', () => {
    const sim = createWorld();
    sim.addPlayer(1, withLogs(1, 3));
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);

    expect(sim.drainBuildEvents()).toEqual([]);
    expect(sim.builtPropsList()).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(3);
  });

  it('refuses a spot out past the tree line', () => {
    const sim = createWorld();
    sim.addPlayer(1, withLogs(1));
    sim.placePlayer(1, { x: 0, y: 0, z: -(CLEARING_TREE_LINE_INNER - 1) }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);

    expect(sim.drainBuildEvents()).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(4);
  });

  it('will not stack a second campfire on top of the first', () => {
    const sim = createWorld();
    sim.addPlayer(1, withLogs(1, 8));
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);
    expect(sim.drainBuildEvents()).toHaveLength(1);

    const seq = waitOutCooldown(sim, 1, 2);
    requestAndStep(sim, 1, 'campfire', seq);

    // Blocked by the campfire already sitting there, so the second attempt
    // never happened and never spent the logs it would have needed.
    expect(sim.drainBuildEvents()).toEqual([]);
    expect(sim.builtPropsList()).toHaveLength(1);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(4);
  });

  it('a second request before the cooldown clears does nothing', () => {
    const sim = createWorld();
    sim.addPlayer(1, withLogs(1, 12));
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);
    expect(sim.drainBuildEvents()).toHaveLength(1);

    // Asked again straight away, still on the same cooldown a swing or a cast
    // would share: nothing happens yet, whatever else might have blocked it.
    requestAndStep(sim, 1, 'campfire', 2);
    expect(sim.drainBuildEvents()).toEqual([]);
  });

  it('restores what was built after the world wakes from storage', () => {
    const sim = createWorld();
    sim.addPlayer(1, withLogs(1));
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
    requestAndStep(sim, 1, 'campfire', 1);
    const built = sim.builtPropsList();
    expect(built).toHaveLength(1);

    const restored = createWorld();
    restored.restoreBuiltProps(built.map((prop) => ({ ...prop, ownerKey: null })));
    expect(restored.builtPropsList()).toEqual(built);

    // A fresh build in the restored world gets its own id, never one already
    // taken by something restored from storage.
    restored.addPlayer(2, withLogs(2));
    restored.placePlayer(2, { x: 15, y: 0, z: 0 }, FACE_OUT);
    requestAndStep(restored, 2, 'campfire', 1);
    const ids = restored.builtPropsList().map((prop) => prop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe('a home to come back to', () => {
    const withTenLogs = (netId: number): PersistedPlayer => ({
      netId,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'log', count: 10 }],
      hunger: HUNGER_MAX,
    });

    it('costs ten logs and is marked as a home', () => {
      expect(BUILDABLE_KINDS.cabin.costs).toEqual([{ item: 'log', amount: 10 }]);
      expect(BUILDABLE_KINDS.cabin.isHome).toBe(true);
      expect(BUILDABLE_KINDS.campfire.isHome).toBe(false);
    });

    it('refuses a second cabin for somebody who already has one', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'cabin', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      // Far enough away that footprint overlap is not what blocks this one -
      // already owning a home is.
      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'cabin', seq);
      expect(sim.drainBuildEvents()).toEqual([]);
    });

    it('lets a different player build their own cabin', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'cabin', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      sim.addPlayer(2, withTenLogs(2), 'someone-else');
      sim.placePlayer(2, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 2, 'cabin', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);
    });

    it('a guest with no persistent key can still build one, just not one that is remembered as theirs', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1));
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'cabin', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      // Ten logs is also the most a pack can ever hold, so a second cabin
      // needs a fresh ten gathered in between - topped up directly here,
      // the same as a trip back to the woods would in a real session.
      addItem(sim.inventoryOf(1), 'log', 10);
      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'cabin', seq);
      // Nothing to say this guest already has one, so a second is allowed.
      expect(sim.drainBuildEvents()).toHaveLength(1);
    });

    it('starts its owner just outside their own front door next time', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'cabin', 1);
      const home = sim.drainBuildEvents()[0]?.prop;
      expect(home).toBeDefined();

      const back = createWorld();
      back.restoreBuiltProps(sim.builtPropsList().map((prop) => ({ ...prop, ownerKey: 'chris' })));
      back.addPlayer(9, undefined, 'chris');
      const position = back.snapshotFor(9).find((entity) => entity.netId === 9);
      expect(position).toBeDefined();
      if (home === undefined || position === undefined) return;
      const gap = Math.hypot(position.x - home.x, position.z - home.z);
      expect(gap).toBeGreaterThan(BUILDABLE_KINDS.cabin.footprintRadius);
      expect(gap).toBeLessThan(BUILDABLE_KINDS.cabin.footprintRadius + 3);
    });

    it('somebody with no cabin yet still spawns exactly as before', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'cabin', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      const fresh = createWorld();
      fresh.restoreBuiltProps(sim.builtPropsList().map((prop) => ({ ...prop, ownerKey: 'chris' })));
      // A different key: this player owns nothing here, home or otherwise.
      fresh.addPlayer(2, undefined, 'somebody-else');
      const position = fresh.snapshotFor(2).find((entity) => entity.netId === 2);
      expect(position?.x).toBe(SPAWN_POSITION.x);
      expect(position?.z).toBe(SPAWN_POSITION.z);
    });
  });

  describe('personal decorations', () => {
    const withFlowers = (netId: number, count = 6): PersistedPlayer => ({
      netId,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'flower', count }],
      hunger: HUNGER_MAX,
    });

    it('costs flowers and is capped per player, but is not a home', () => {
      expect(BUILDABLE_KINDS.flowerBed.costs).toEqual([{ item: 'flower', amount: 6 }]);
      expect(BUILDABLE_KINDS.flowerBed.capPerPlayer).toBe(true);
      expect(BUILDABLE_KINDS.flowerBed.isHome).toBe(false);
      expect(BUILDABLE_KINDS.lantern.costs).toEqual([{ item: 'flower', amount: 4 }]);
      expect(BUILDABLE_KINDS.lantern.capPerPlayer).toBe(true);
      expect(BUILDABLE_KINDS.lantern.isHome).toBe(false);
    });

    it('refuses a second flower bed for somebody who already has one', () => {
      const sim = createWorld();
      sim.addPlayer(1, withFlowers(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      // Topped back up, so it is the cap refusing this - not a lack of flowers.
      addItem(sim.inventoryOf(1), 'flower', 6);
      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', seq);
      expect(sim.drainBuildEvents()).toEqual([]);
    });

    it('owning a flower bed does not stop the same player building a lantern too', () => {
      const sim = createWorld();
      sim.addPlayer(1, withFlowers(1, 10), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      // A different kind, so the flower bed's own cap has nothing to say
      // about it - the four flowers left over are exactly a lantern's cost.
      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'lantern', seq);
      expect(sim.drainBuildEvents()).toHaveLength(1);
    });

    it('owning a cabin does not stop the same player decorating too', () => {
      const sim = createWorld();
      sim.addPlayer(
        1,
        {
          netId: 1,
          x: 0,
          y: 0,
          z: 0,
          facingYaw: 0,
          items: [
            { item: 'log', count: 10 },
            { item: 'flower', count: 6 },
          ],
          hunger: HUNGER_MAX,
        },
        'chris',
      );
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'cabin', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', seq);
      expect(sim.drainBuildEvents()).toHaveLength(1);
    });

    it('a guest with no persistent key is never capped', () => {
      const sim = createWorld();
      sim.addPlayer(1, withFlowers(1));
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      addItem(sim.inventoryOf(1), 'flower', 6);
      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', seq);
      expect(sim.drainBuildEvents()).toHaveLength(1);
    });
  });
});
