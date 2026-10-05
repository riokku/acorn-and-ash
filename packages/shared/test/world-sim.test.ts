import { afterEach, describe, expect, it } from 'vitest';

import {
  ANIMAL_RESPAWN_SECONDS,
  BUILD_REACH,
  BUILD_REACH_SLACK,
  CHARGE_WALK_SHARE,
  CLEARING_TREE_LINE_INNER,
  DEFAULT_WORLD_SEED,
  DODGE_DISTANCE,
  DROPPED_PILE_SECONDS,
  GATHER_PATCH_MAX_COUNT,
  GATHER_PATCH_MIN_COUNT,
  HEALTH_MAX,
  HUNGER_MAX,
  INTEREST_RADIUS,
  MAX_PLAYERS_PER_WORLD,
  MAX_DROPPED_PILES,
  MAX_QUEUED_INPUTS_PER_PLAYER,
  MAX_TREE_GENERATION,
  PATCH_CLEARANCE,
  PATCH_REGROW_MIN_SECONDS,
  PATCH_SPACING,
  PATCH_SPAWN_CLEARANCE,
  PLAYER_RADIUS,
  PLAYER_WALK_SPEED,
  PREDATOR_CATCH_RADIUS,
  SPAWN_POSITION,
  SWING_COOLDOWN_TICKS,
  TICK_HZ,
  TICK_MILLISECONDS,
  TICK_SECONDS,
  WILDERNESS_PROP_FIRST_ID,
} from '../src/constants';
import { COLLISION_SKIN_WIDTH } from '../src/collision/capsule';
import { ANIMAL_KINDS } from '../src/data/animals';
import { BUILDABLE_KINDS, type BuildableKindId } from '../src/data/buildables';
import { ITEM_KINDS, type ItemId } from '../src/data/items';
import { PROP_KINDS, choppingRuleFor } from '../src/data/props';
import { ANIMAL_DENS } from '../src/world/animals';
import { DAY_LENGTH_MS } from '../src/sim/day-night';
import { regrowDueAtMs, treeAtGeneration } from '../src/sim/regrowth';
import { TREE_BREAK_SECONDS } from '../src/sim/tree-fall';
import { patchRegrowDelayMs } from '../src/sim/gathering';
import { overlapsWater } from '../src/world/water';
import { addItem, countOf, roomFor } from '../src/sim/inventory';
import { PlayerButton, createInput, type PlayerInput } from '../src/sim/player';
import {
  AXE_PICKUP_ID,
  AXE_STUMP,
  BAG_PICKUP_ID,
  BAG_SPOT,
  FLOWER_PATCHES,
  POND,
  STICK_PATCHES,
} from '../src/world/clearing';
import {
  inputsToConsume,
  WorldSimulation,
  SnapshotFlag,
  type BuiltProp,
  type BuriedCache,
  type PersistedPlayer,
  OUTDOORS,
} from '../src/sim/world-sim';
import {
  HOME_BED,
  HOME_CHAIR,
  HOME_ENTRY,
  HOME_WAKE_SPOT,
  cabinDoorstep,
  cabinDoorway,
} from '../src/world/home';
import {
  ActionKind,
  Gesture,
  RiseFrom,
  createActionState,
  unpackActionByte,
} from '../src/sim/actions';
import {
  CHARGE_TICKS,
  DODGE,
  KNOCKED_OUT_TICKS,
  LIGHT_COMBO,
  RISE,
  SETTLE,
  STRIKE,
} from '../src/data/moves';

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

/**
 * How far in front of the player these tests put a piece: its own edge a
 * couple of steps away, clear of the player (see decision 0052) - where a
 * campfire always landed before pieces followed the mouse, within
 * `BUILD_REACH` even for a cabin, and past `PICKUP_REACH`.
 */
function inFront(kind: BuildableKindId): number {
  return BUILDABLE_KINDS[kind].footprintRadius + 2;
}

describe('the world simulation', () => {
  it('moves at walking pace while a swift attack remains active', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: -10,
      y: 0,
      z: 4,
      facingYaw: 0,
      hunger: HUNGER_MAX,
      equippedItem: 'axe',
      items: [{ item: 'axe', count: 1 }],
    });
    for (let seq = 1; seq <= 5; seq++) {
      sim.queueInput(1, createInput(seq, 0, 1, 0, seq === 1 ? PlayerButton.Swing : 0));
      sim.step(tickClock());
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.Swing);
    }
    const self = sim.snapshotFor(1).find((entity) => entity.netId === 1)!;
    expect(self.z).toBeLessThan(3);
  });

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

  it('hands a player over to a new connection right where they stand', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    drive(sim, 1, 0, 1, 30);
    // Still in the queue when the old connection went: never simulated.
    sim.queueInput(1, createInput(31, 1, 0, 0));
    const before = sim.readPlayer(1)?.position;

    sim.handOver(1);
    expect(sim.lastProcessedSeq(1)).toBe(0);
    for (let i = 0; i < 20; i++) sim.step(tickClock());
    const settled = sim.readPlayer(1)?.position;
    if (before === undefined || settled === undefined) throw new Error('missing player');
    // Coasted to a stop where it was, without taking the old step sideways.
    expect(Math.abs(settled.x - before.x)).toBeLessThan(0.05);

    // And the new connection is listened to from its first input, counting from one.
    drive(sim, 1, 0, 1, TICK_HZ);
    const walked = sim.readPlayer(1)?.position;
    if (walked === undefined) throw new Error('missing player');
    expect(walked.z).toBeLessThan(settled.z - 1);
    expect(sim.lastProcessedSeq(1)).toBe(TICK_HZ);
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

  it('keeps the interest radius correct with a full, 50-player world at varying distances', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);

    const playerIdsSeenBy = (netId: number): number[] =>
      sim
        .snapshotFor(netId)
        .filter((entity) => (entity.flags & SnapshotFlag.Animal) === 0)
        .map((entity) => entity.netId);

    // Fill the rest of the world up to capacity, alternating players placed
    // well inside the radius and well outside it, at a spread of angles and
    // distances rather than one fixed offset - this is what "at real scale"
    // is meant to rule out: a cutoff that only happens to work for a couple
    // of hand-placed points.
    const nearIds: number[] = [];
    const farIds: number[] = [];
    for (let i = 0, netId = 2; netId <= MAX_PLAYERS_PER_WORLD; i++, netId++) {
      const isNear = i % 2 === 0;
      const distance = isNear ? 5 + ((i * 3) % 90) : INTEREST_RADIUS + 5 + ((i * 17) % 400);
      const angle = i * 0.9;
      sim.addPlayer(netId);
      sim.placePlayer(
        netId,
        { x: Math.cos(angle) * distance, y: 0, z: Math.sin(angle) * distance },
        0,
      );
      (isNear ? nearIds : farIds).push(netId);
    }
    expect(1 + nearIds.length + farIds.length).toBe(MAX_PLAYERS_PER_WORLD);

    const byId = (a: number, b: number): number => a - b;
    const expectedForViewer = [1, ...nearIds].sort(byId);
    expect(playerIdsSeenBy(1).sort(byId)).toEqual(expectedForViewer);

    // The cutoff works both ways: someone far from the viewer doesn't see the
    // viewer either, even once the world is full and busy.
    const [aFarPlayer] = farIds;
    if (aFarPlayer === undefined) throw new Error('expected at least one far player');
    const seenByFarPlayer = playerIdsSeenBy(aFarPlayer);
    expect(seenByFarPlayer).toContain(aFarPlayer);
    expect(seenByFarPlayer).not.toContain(1);
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

/**
 * Press dodge once, then let go and feed plain inputs until the roll is
 * over - a roll carries on by itself once it starts, and only inputs move
 * it along. Returns the next sequence number.
 */
function dodge(
  sim: WorldSimulation,
  netId: number,
  seq: number,
  moveX = 0,
  moveZ = 0,
  aimYaw = 0,
): number {
  sim.queueInput(netId, createInput(seq++, moveX, moveZ, 0, PlayerButton.Dodge, aimYaw));
  sim.step(tickClock());
  for (let i = 1; i < DODGE.end; i++) {
    sim.queueInput(netId, createInput(seq++, 0, 0, 0, 0, aimYaw));
    sim.step(tickClock());
  }
  return seq;
}

/**
 * Click once - press, then let go - and keep feeding inputs until the
 * swing it starts has landed: a blow lands partway into the swing, not on
 * the click (see decision 0056). Returns the next sequence number.
 */
function swingOnce(
  sim: WorldSimulation,
  netId: number,
  seq: number,
  aimYaw = 0,
  cameraYaw = aimYaw,
): number {
  sim.queueInput(netId, createInput(seq++, 0, 0, cameraYaw, PlayerButton.Swing, aimYaw));
  sim.step(tickClock());
  for (let i = 0; i < LIGHT_COMBO[0].impact; i++) {
    sim.queueInput(netId, createInput(seq++, 0, 0, cameraYaw, 0, aimYaw));
    sim.step(tickClock());
  }
  return seq;
}

describe('dodging', () => {
  it('rolls straight back when nothing is held', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const before = sim.readPlayer(1)?.position;
    if (before === undefined) throw new Error('missing player');

    // Facing yaw 0 looks down -Z, same as everywhere else - backward is +Z.
    dodge(sim, 1, 1);

    const after = sim.readPlayer(1)?.position;
    if (after === undefined) throw new Error('missing player');
    expect(after.z - before.z).toBeGreaterThan(DODGE_DISTANCE * 0.9);
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.5);
  });

  it('carries you over the roll, rather than all at once', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const before = sim.readPlayer(1)?.position;
    if (before === undefined) throw new Error('missing player');

    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Dodge));
    sim.step(tickClock());
    const firstTick = sim.readPlayer(1)?.position;
    if (firstTick === undefined) throw new Error('missing player');
    expect(firstTick.z - before.z).toBeCloseTo(DODGE_DISTANCE / DODGE.travel, 1);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Dodge);
  });

  it('rolls in whatever direction is held, instead of straight back', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const before = sim.readPlayer(1)?.position;
    if (before === undefined) throw new Error('missing player');

    dodge(sim, 1, 1, 1, 0);

    const after = sim.readPlayer(1)?.position;
    if (after === undefined) throw new Error('missing player');
    expect(after.x - before.x).toBeGreaterThan(DODGE_DISTANCE * 0.9);
    expect(Math.abs(after.z - before.z)).toBeLessThan(0.5);
  });

  it('rolls back from where the character aims, not from where the camera looks', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const before = sim.readPlayer(1)?.position;
    if (before === undefined) throw new Error('missing player');

    // The camera looks down -Z; the character was clicked round to face -X,
    // so rolling back from it is towards +X.
    dodge(sim, 1, 1, 0, 0, Math.PI / 2);

    const after = sim.readPlayer(1)?.position;
    if (after === undefined) throw new Error('missing player');
    expect(after.x - before.x).toBeGreaterThan(DODGE_DISTANCE * 0.9);
    expect(Math.abs(after.z - before.z)).toBeLessThan(0.5);
  });

  it('reads a held direction from the camera, the same as walking, wherever the character aims', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const before = sim.readPlayer(1)?.position;
    if (before === undefined) throw new Error('missing player');

    // D held, camera looking down -Z: to the camera's right is +X, even
    // with the character aiming the opposite way round.
    dodge(sim, 1, 1, 1, 0, Math.PI);

    const after = sim.readPlayer(1)?.position;
    if (after === undefined) throw new Error('missing player');
    expect(after.x - before.x).toBeGreaterThan(DODGE_DISTANCE * 0.9);
  });

  it('cannot be used again until it has recharged', () => {
    const sim = createWorld();
    sim.addPlayer(1);

    const seq = dodge(sim, 1, 1);
    const afterFirst = sim.readPlayer(1)?.position;
    if (afterFirst === undefined) throw new Error('missing player');

    // Straight after the first roll, comfortably inside the cooldown.
    dodge(sim, 1, seq);
    const afterSecond = sim.readPlayer(1)?.position;
    if (afterSecond === undefined) throw new Error('missing player');
    expect(afterSecond.z - afterFirst.z).toBeLessThan(0.5);
  });

  it('is ready again once the cooldown passes', () => {
    const sim = createWorld();
    sim.addPlayer(1);

    let seq = dodge(sim, 1, 1);
    const afterFirst = sim.readPlayer(1)?.position;
    if (afterFirst === undefined) throw new Error('missing player');

    seq = drive(sim, 1, 0, 0, DODGE.cooldown - DODGE.end, seq);

    dodge(sim, 1, seq);
    const afterSecond = sim.readPlayer(1)?.position;
    if (afterSecond === undefined) throw new Error('missing player');
    expect(afterSecond.z - afterFirst.z).toBeGreaterThan(DODGE_DISTANCE * 0.9);
  });
});

describe('finding the bag', () => {
  /** Put a player next to it and hold the interact button for one tick. */
  function reachForTheBag(sim: WorldSimulation, netId: number, seq = 1): void {
    sim.placePlayer(netId, { x: BAG_SPOT.x + 1, y: 0, z: BAG_SPOT.z }, 0);
    sim.queueInput(netId, createInput(seq, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
  }

  it('hands over the bag to a player who reaches for it', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    reachForTheBag(sim, 1);

    expect(countOf(sim.inventoryOf(1), 'bag')).toBe(1);
    expect(sim.takenPickupIds()).toEqual([BAG_PICKUP_ID]);
    expect(sim.drainPickupEvents()).toEqual([{ netId: 1, pickupId: BAG_PICKUP_ID, item: 'bag' }]);
  });

  it('is the one thing a brand new player can pick up before anything else opens up', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    expect(sim.inventoryOf(1)).toEqual({});

    reachForTheBag(sim, 1);
    expect(countOf(sim.inventoryOf(1), 'bag')).toBe(1);

    // And now the axe - found the same way - goes in the pack too.
    sim.placePlayer(1, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    sim.queueInput(1, createInput(2, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
  });
});

describe('picking the axe up', () => {
  /** A player who has already found their bag, and has its ten slots to fill. */
  function withBag(netId: number): PersistedPlayer {
    return {
      netId,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'bag', count: 1 }],
      hunger: HUNGER_MAX,
    };
  }

  /** Put a player next to the stump and hold the interact button for one tick. */
  function reachForTheAxe(sim: WorldSimulation, netId: number, seq = 1): void {
    sim.placePlayer(netId, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    sim.queueInput(netId, createInput(seq, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
  }

  it('does nothing while the player is somewhere else', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
    drive(sim, 1, 0, 0, 1, 1, PlayerButton.Interact);
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(0);
    expect(sim.takenPickupIds()).toEqual([]);
  });

  it('does nothing while the player stands there without asking', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
    sim.placePlayer(1, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    expect(sim.reachablePickup(1)?.id).toBe(AXE_PICKUP_ID);

    drive(sim, 1, 0, 0, 5);
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(0);
  });

  it('hands over the axe with no bag at all, into one of the six slots everybody has', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    reachForTheAxe(sim, 1);

    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
    expect(sim.takenPickupIds()).toEqual([AXE_PICKUP_ID]);
  });

  it('leaves the axe where it is for a player whose every slot is taken', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      ...withBag(1),
      // No bag after all: six slots, every one a full stack of sticks.
      items: [{ item: 'stick', count: ITEM_KINDS.stick.stackSize * 6 }],
    });
    reachForTheAxe(sim, 1);

    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(0);
    expect(sim.takenPickupIds()).toEqual([]);
  });

  it('explains why a tool stays on the ground when the pack is full', () => {
    const sim = createWorld();
    sim.addPlayer(1, { ...withBag(1), items: [{ item: 'stick', count: 60 }] });
    reachForTheAxe(sim, 1);
    expect(sim.drainPickupRefusals()).toEqual([{ netId: 1, item: 'axe', reason: 'full' }]);
  });

  it('hands over the axe to a player who reaches for it', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
    reachForTheAxe(sim, 1);

    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
    expect(sim.takenPickupIds()).toEqual([AXE_PICKUP_ID]);
    expect(sim.drainPickupEvents()).toEqual([{ netId: 1, pickupId: AXE_PICKUP_ID, item: 'axe' }]);
  });

  it('reports each pickup exactly once', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
    reachForTheAxe(sim, 1);
    expect(sim.drainPickupEvents()).toHaveLength(1);
    // Draining twice must not replay it.
    expect(sim.drainPickupEvents()).toEqual([]);
  });

  it('gives it to one player, not to both', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
    sim.addPlayer(2, withBag(2));
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
    sim.addPlayer(1, withBag(1));
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
    sim.addPlayer(1, withBag(1));
    reachForTheAxe(sim, 1);

    const saved = sim.persistablePlayers()[0];
    expect(saved?.items).toEqual([
      { item: 'axe', count: 1 },
      { item: 'bag', count: 1 },
    ]);
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
      items: [
        { item: 'bag', count: 1 },
        { item: 'perch', count },
      ],
      hunger,
      // Eating through the interact fallback needs the fish active, the same
      // as a swing needs the axe active - see `isActiveItem` in world-sim.ts.
      equippedItem: 'perch',
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

  it('does nothing carrying a fish that is not the active item', () => {
    const sim = createWorld();
    // The axe is active, not the fish, so the interact fallback has nothing
    // it is allowed to eat even though the pack has food in it.
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
        { item: 'perch', count: 2 },
      ],
      hunger: 50,
      equippedItem: 'axe',
    });
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(2);
    expect(sim.hungerOf(1)).toBe(50);
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

describe('equipping', () => {
  function withItems(
    netId: number,
    items: Array<{ item: ItemId; count: number }>,
    equippedItem: ItemId | null = null,
    hunger = HUNGER_MAX,
  ): PersistedPlayer {
    return { netId, x: 0, y: 0, z: 0, facingYaw: 0, items, hunger, equippedItem };
  }

  it('equips a tool without eating anything or spending it', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(1, [
        { item: 'bag', count: 1 },
        { item: 'rod', count: 1 },
        { item: 'axe', count: 1 },
      ]),
    );
    // The axe is the default; switching to the rod is a genuine change.
    expect(sim.useItem(1, 'rod')).toBe(true);

    expect(sim.equippedItemOf(1)).toBe('rod');
    expect(countOf(sim.inventoryOf(1), 'rod')).toBe(1);
    expect(sim.hungerOf(1)).toBe(HUNGER_MAX);
  });

  it('still eats food the same as before, and equips it too', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(
        1,
        [
          { item: 'bag', count: 1 },
          { item: 'perch', count: 2 },
        ],
        null,
        50,
      ),
    );
    expect(sim.useItem(1, 'perch')).toBe(true);

    expect(sim.equippedItemOf(1)).toBe('perch');
    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(1);
    expect(sim.hungerOf(1)).toBe(90);
  });

  it('refuses to equip an item the pack does not actually hold', () => {
    const sim = createWorld();
    sim.addPlayer(1, withItems(1, [{ item: 'bag', count: 1 }]));
    expect(sim.useItem(1, 'rod')).toBe(false);
    expect(sim.equippedItemOf(1)).toBeNull();
  });

  it('refuses to equip a material - not marked equippable, however many you hold', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(1, [
        { item: 'bag', count: 1 },
        { item: 'log', count: 10 },
        { item: 'stick', count: 6 },
      ]),
    );
    expect(sim.useItem(1, 'log')).toBe(false);
    expect(sim.equippedItemOf(1)).toBeNull();
  });

  it('defaults to the axe on a fresh connect when nothing was saved', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(1, [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
      ]),
    );
    expect(sim.equippedItemOf(1)).toBe('axe');
  });

  it('prefers the axe over the rod as the default when both are held', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(1, [
        { item: 'bag', count: 1 },
        { item: 'rod', count: 1 },
        { item: 'axe', count: 1 },
      ]),
    );
    expect(sim.equippedItemOf(1)).toBe('axe');
  });

  it('never defaults to a food item, even if that is all a save has', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(1, [
        { item: 'bag', count: 1 },
        { item: 'perch', count: 3 },
      ]),
    );
    expect(sim.equippedItemOf(1)).toBeNull();
  });

  it("honors a save's own choice over the default, if still held", () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(
        1,
        [
          { item: 'bag', count: 1 },
          { item: 'rod', count: 1 },
          { item: 'axe', count: 1 },
        ],
        'rod',
      ),
    );
    expect(sim.equippedItemOf(1)).toBe('rod');
  });

  it('falls back to the default when a saved choice is no longer held', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(
        1,
        [
          { item: 'bag', count: 1 },
          { item: 'axe', count: 1 },
        ],
        'rod',
      ),
    );
    expect(sim.equippedItemOf(1)).toBe('axe');
  });

  it('empties out once the equipped food is eaten to nothing, with nothing extra to notice', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(
        1,
        [
          { item: 'bag', count: 1 },
          { item: 'perch', count: 1 },
        ],
        null,
        50,
      ),
    );
    sim.useItem(1, 'perch');
    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(0);
    expect(sim.equippedItemOf(1)).toBeNull();
  });

  it('lists what every connected player has equipped', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(1, [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
      ]),
    );
    sim.addPlayer(2, withItems(2, [{ item: 'bag', count: 1 }]));
    expect(sim.equippedList()).toEqual(
      expect.arrayContaining([
        { netId: 1, item: 'axe' },
        { netId: 2, item: null },
      ]),
    );
  });

  it('reports an equip change exactly once, even pressed repeatedly', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(1, [
        { item: 'bag', count: 1 },
        { item: 'rod', count: 1 },
        { item: 'axe', count: 1 },
      ]),
    );
    // Starts equipped with the default axe already, so switching to the rod
    // is the one genuine change - pressing it again after must not add a
    // second entry for the same player.
    sim.useItem(1, 'rod');
    sim.useItem(1, 'rod');
    expect(sim.drainEquipEvents()).toEqual([1]);
    expect(sim.drainEquipEvents()).toEqual([]);
  });

  it('keeps the equipped choice across logging out and coming back', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      withItems(1, [
        { item: 'bag', count: 1 },
        { item: 'rod', count: 1 },
        { item: 'axe', count: 1 },
      ]),
    );
    sim.useItem(1, 'rod');
    const saved = sim.persistablePlayers()[0];
    if (saved === undefined) throw new Error('nothing was saved');
    sim.removePlayer(1);

    const later = createWorld();
    later.addPlayer(9, saved);
    expect(later.equippedItemOf(9)).toBe('rod');
  });
});

describe('gathering sticks', () => {
  const spot = STICK_PATCHES[0];
  if (spot === undefined) throw new Error('no stick patch to test against');

  /** A player who has already found their bag, and has its ten slots to fill. */
  function withBag(netId: number): PersistedPlayer {
    return {
      netId,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'bag', count: 1 }],
      hunger: HUNGER_MAX,
    };
  }

  it('gathers one when a patch is in reach', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
  });

  it('gathers with no bag at all, into one of the six slots everybody has', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
  });

  it('does nothing far from every patch', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(0);
  });

  it('shares one patch between everybody: two players at once take two from it', () => {
    const sim = createWorld();
    const before = patchNamed(sim, 1).remaining;
    sim.addPlayer(1, withBag(1));
    sim.addPlayer(2, withBag(2));
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.placePlayer(2, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
    expect(countOf(sim.inventoryOf(2), 'stick')).toBe(1);
    expect(patchNamed(sim, 1).remaining).toBe(before - 2);
  });

  it('starts every patch with somewhere from two to six', () => {
    const sim = createWorld();
    for (const patch of sim.gatherPatchesList()) {
      expect(patch.remaining).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
      expect(patch.remaining).toBeLessThanOrEqual(GATHER_PATCH_MAX_COUNT);
    }
  });

  it('runs out: takes one each time, then nothing once it is picked clean', () => {
    const sim = createWorld();
    const held = patchNamed(sim, 1).remaining;
    sim.addPlayer(1, withBag(1));
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);

    holdInteract(sim, 1, (held + 2) * SWING_COOLDOWN_TICKS);

    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(held);
    expect(patchNamed(sim, 1).remaining).toBe(0);
  });

  it('gives the last one to only one of two players reaching for it at once', () => {
    const sim = createWorld();
    sim.restorePatches([{ ...savedPatch(sim, 1), remaining: 1 }]);
    sim.addPlayer(1, withBag(1));
    sim.addPlayer(2, withBag(2));
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.placePlayer(2, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    const total = countOf(sim.inventoryOf(1), 'stick') + countOf(sim.inventoryOf(2), 'stick');
    expect(total).toBe(1);
    expect(patchNamed(sim, 1).remaining).toBe(0);
  });

  it('says which patch changed, so it can be saved and sent', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.drainPatchChanges();
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(sim.drainPatchChanges()).toEqual([1]);
    expect(sim.drainPatchChanges()).toEqual([]);
  });

  it('will not gather faster than the cooldown allows', () => {
    const sim = createWorld();
    sim.addPlayer(1, withBag(1));
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
      items: [
        { item: 'bag', count: 1 },
        { item: 'perch', count: 1 },
      ],
      hunger: 50,
    });
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(1);
    expect(sim.hungerOf(1)).toBe(50);
  });

  it('reports a full pack without eating equipped food instead of gathering', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        // The perch and nine full stacks of sticks fill all ten of the bag's slots.
        { item: 'bag', count: 1 },
        { item: 'stick', count: ITEM_KINDS.stick.stackSize * 9 },
        { item: 'perch', count: 1 },
      ],
      hunger: 50,
      equippedItem: 'perch',
    });
    sim.placePlayer(1, { x: spot.x, y: 0, z: spot.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(1);
    expect(sim.drainPickupRefusals()).toEqual([{ netId: 1, item: 'stick', reason: 'full' }]);
    expect(sim.hungerOf(1)).toBe(50);
  });
});

/** One patch as the world would tell a browser about it. */
function patchNamed(sim: WorldSimulation, id: number) {
  const patch = sim.gatherPatchesList().find((candidate) => candidate.id === id);
  if (patch === undefined) throw new Error(`no patch ${id}`);
  return patch;
}

/** One patch as the world would save it. */
function savedPatch(sim: WorldSimulation, id: number) {
  const saved = sim.persistedPatch(id);
  if (saved === null) throw new Error(`no patch ${id}`);
  return saved;
}

/** Hold the interact button down for this many ticks. */
function holdInteract(sim: WorldSimulation, netId: number, ticks: number): void {
  for (let i = 1; i <= ticks; i++) {
    sim.queueInput(netId, createInput(i, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
  }
}

describe('a picked-clean patch growing back', () => {
  /** A world whose first stick patch was picked clean just now. */
  function withEmptyPatch(generation = 0) {
    const sim = createWorld();
    const emptiedAtMs = tickClock();
    sim.restorePatches([{ ...savedPatch(sim, 1), remaining: 0, generation, emptiedAtMs }]);
    sim.drainPatchChanges();
    const dueAt = emptiedAtMs + patchRegrowDelayMs(DEFAULT_WORLD_SEED, 1, generation);
    return { sim, dueAt };
  }

  it('waits out a few minutes before coming back', () => {
    const { sim, dueAt } = withEmptyPatch();
    expect(dueAt - clockMs).toBeGreaterThanOrEqual(PATCH_REGROW_MIN_SECONDS * 1000);

    sim.regrowPatches(dueAt - 1);
    expect(patchNamed(sim, 1).remaining).toBe(0);
    expect(sim.drainPatchChanges()).toEqual([]);
  });

  it('comes back somewhere else, with a fresh two to six', () => {
    const { sim, dueAt } = withEmptyPatch();
    const before = patchNamed(sim, 1);

    sim.regrowPatches(dueAt);

    const after = patchNamed(sim, 1);
    expect(after.remaining).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
    expect(after.remaining).toBeLessThanOrEqual(GATHER_PATCH_MAX_COUNT);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.5);
    expect(savedPatch(sim, 1).generation).toBe(1);
    expect(sim.drainPatchChanges()).toEqual([1]);
  });

  it('comes back at once on waking, if it was due while nobody was here', () => {
    const { sim, dueAt } = withEmptyPatch();
    sim.regrowPatches(dueAt + 24 * 60 * 60 * 1000);
    expect(patchNamed(sim, 1).remaining).toBeGreaterThan(0);
  });

  it('never grows back in the pond, on a rock or tree, at spawn or on another patch', () => {
    const sim = createWorld();
    for (let generation = 0; generation < 60; generation++) {
      // The same world each time - Koota only hands out so many - with its
      // first patch picked clean at a later and later generation.
      const emptiedAtMs = tickClock();
      sim.restorePatches([{ ...savedPatch(sim, 1), remaining: 0, generation, emptiedAtMs }]);
      sim.regrowPatches(emptiedAtMs + patchRegrowDelayMs(DEFAULT_WORLD_SEED, 1, generation));
      const grown = patchNamed(sim, 1);
      expect(grown.remaining).toBeGreaterThan(0);

      expect(overlapsWater(POND, grown.x, grown.z, PATCH_CLEARANCE)).toBe(false);
      expect(Math.hypot(grown.x - SPAWN_POSITION.x, grown.z - SPAWN_POSITION.z)).toBeGreaterThan(
        PATCH_SPAWN_CLEARANCE,
      );
      for (const prop of sim.clearing.props) {
        const radius = PROP_KINDS[prop.kind].colliderRadius * prop.scale;
        expect(Math.hypot(prop.x - grown.x, prop.z - grown.z)).toBeGreaterThan(radius);
      }
      for (const other of sim.gatherPatchesList()) {
        if (other.id === grown.id) continue;
        expect(Math.hypot(other.x - grown.x, other.z - grown.z)).toBeGreaterThanOrEqual(
          PATCH_SPACING,
        );
      }
    }
  });

  it('moves out from under anything built on top of it, keeping what it had left', () => {
    const sim = createWorld();
    const before = patchNamed(sim, 1);
    sim.restoreBuiltProps([
      {
        id: 60000,
        kind: 'cabin',
        x: before.x,
        z: before.z + 10,
        yaw: 0,
        lit: false,
        ownerKey: 'patch-builder',
        litUntilMs: null,
      },
    ]);
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
      'patch-builder',
    );
    sim.placePlayer(1, { x: before.x + 2, y: 0, z: before.z }, 0);
    sim.drainPatchChanges();

    sim.requestBuild(1, { kind: 'campfire', x: before.x, z: before.z, yaw: 0 });
    sim.queueInput(1, createInput(1, 0, 0, 0, 0));
    sim.step(tickClock());

    expect(sim.builtPropsList().filter((prop) => prop.kind === 'campfire')).toHaveLength(1);
    const after = patchNamed(sim, 1);
    expect(after.remaining).toBe(before.remaining);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);
    expect(sim.drainPatchChanges()).toEqual([1]);
  });

  it('remembers where every patch is and how many are left across a save', () => {
    const { sim, dueAt } = withEmptyPatch();
    sim.regrowPatches(dueAt);
    const saved = sim.gatherPatchesList().map((patch) => savedPatch(sim, patch.id));

    const later = createWorld();
    later.restorePatches(saved);
    expect(later.gatherPatchesList()).toEqual(sim.gatherPatchesList());
  });

  it('keeps a picked-clean patch empty across a save, still counting down', () => {
    const { sim, dueAt } = withEmptyPatch();
    const later = createWorld();
    later.restorePatches([savedPatch(sim, 1)]);
    later.regrowPatches(dueAt - 1);
    expect(patchNamed(later, 1).remaining).toBe(0);
    later.regrowPatches(dueAt);
    expect(patchNamed(later, 1).remaining).toBeGreaterThan(0);
  });

  it('ignores a saved patch that makes no sense, rather than handing out a hundred sticks', () => {
    const sim = createWorld();
    const freshPatchCount = sim.gatherPatchesList().length;
    const fresh = patchNamed(sim, 1);
    sim.restorePatches([
      { ...savedPatch(sim, 1), remaining: 100 },
      { ...savedPatch(sim, 1), x: Number.NaN },
      { id: 999, x: 0, z: 0, remaining: 3, generation: 0, emptiedAtMs: 0 },
    ]);
    expect(patchNamed(sim, 1)).toEqual(fresh);
    expect(sim.gatherPatchesList()).toHaveLength(freshPatchCount);
  });
});

describe('dropping and destroying', () => {
  /** A player carrying these, with their bag, standing in the open facing north. */
  function carrying(netId: number, items: PersistedPlayer['items']): PersistedPlayer {
    return {
      netId,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'bag', count: 1 }, ...items],
      hunger: HUNGER_MAX,
    };
  }

  const OPEN_GROUND = { x: -10, y: 0, z: 4 };

  function setUp(items: PersistedPlayer['items']) {
    const sim = createWorld();
    sim.addPlayer(1, carrying(1, items));
    sim.placePlayer(1, OPEN_GROUND, 0);
    sim.step(tickClock());
    return sim;
  }

  it('drops one just in front of you, for anybody to pick up', () => {
    const sim = setUp([{ item: 'stick', count: 5 }]);
    expect(sim.discardItem(1, { item: 'stick', amount: 1, destroy: false }, clockMs)).toBe(true);

    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(4);
    const [pile] = sim.droppedPilesList();
    expect(pile).toMatchObject({ item: 'stick', count: 1 });
    if (pile === undefined) return;
    // Facing north, which is toward -z.
    expect(pile.z).toBeLessThan(OPEN_GROUND.z);
    expect(Math.hypot(pile.x - OPEN_GROUND.x, pile.z - OPEN_GROUND.z)).toBeLessThan(1);
    expect(sim.drainDiscardEvents()).toEqual([
      { netId: 1, item: 'stick', count: 1, destroyed: false },
    ]);
  });

  it('reports a full pack once per press, leaves the log, and never eats equipped food instead', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      ...OPEN_GROUND,
      facingYaw: 0,
      hunger: 30,
      equippedItem: 'perch',
      items: [
        { item: 'log', count: 50 },
        { item: 'perch', count: 10 },
      ],
    });
    sim.restoreDroppedPiles(
      [{ id: 1, item: 'log', count: 1, x: OPEN_GROUND.x, z: OPEN_GROUND.z, droppedAtMs: clockMs }],
      clockMs,
    );
    drive(sim, 1, 0, 0, 40, 1, PlayerButton.Interact);
    expect(sim.drainPickupRefusals()).toEqual([{ netId: 1, item: 'log', reason: 'full' }]);
    expect(sim.droppedPilesList()).toHaveLength(1);
    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(10);
    // The final held sample and release can share a network bundle. Releasing
    // must not produce a second refusal for that same press.
    sim.queueInput(1, createInput(41, 0, 0, 0, PlayerButton.Interact));
    sim.queueInput(1, createInput(42, 0, 0, 0, 0));
    sim.step(tickClock());
    sim.step(tickClock());
    expect(sim.drainPickupRefusals()).toEqual([]);
    drive(sim, 1, 0, 0, 1, 43, PlayerButton.Interact);
    expect(sim.drainPickupRefusals()).toHaveLength(1);
    sim.discardItem(1, { item: 'log', amount: 10, destroy: true }, clockMs);
    drive(sim, 1, 0, 0, 1, 44, PlayerButton.Interact);
    expect(sim.droppedPilesList()).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(41);
    expect(sim.drainPickupRefusals()).toEqual([]);
  });

  it('distinguishes a duplicate tool from a full pack', () => {
    const sim = setUp([{ item: 'axe', count: 1 }]);
    sim.restoreDroppedPiles(
      [{ id: 1, item: 'axe', count: 1, x: OPEN_GROUND.x, z: OPEN_GROUND.z, droppedAtMs: clockMs }],
      clockMs,
    );
    drive(sim, 1, 0, 0, 1, 1, PlayerButton.Interact);
    expect(sim.drainPickupRefusals()).toEqual([{ netId: 1, item: 'axe', reason: 'limit' }]);
    expect(sim.droppedPilesList()).toHaveLength(1);
  });

  it('reports no room when gathering a patch without consuming the patch', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      ...OPEN_GROUND,
      facingYaw: 0,
      hunger: HUNGER_MAX,
      items: [{ item: 'log', count: 60 }],
    });
    const patch = sim.gatherPatchesList()[0]!;
    sim.placePlayer(1, { x: patch.x, y: 0, z: patch.z }, 0);
    drive(sim, 1, 0, 0, 2, 1, PlayerButton.Interact);
    expect(sim.drainPickupRefusals()).toEqual([{ netId: 1, item: patch.item, reason: 'full' }]);
    expect(sim.gatherPatchesList()[0]?.remaining).toBe(patch.remaining);
  });

  it('reports confirmed material collections and only flourishes when the pile is emptied', () => {
    const sim = setUp([{ item: 'stick', count: 2 }]);
    sim.discardItem(1, { item: 'stick', amount: 2, destroy: false }, clockMs);
    const pile = sim.droppedPilesList()[0]!;
    sim.addPlayer(2, {
      netId: 2,
      x: pile.x,
      y: 0,
      z: pile.z,
      facingYaw: 0,
      hunger: HUNGER_MAX,
      items: [
        { item: 'log', count: 50 },
        { item: 'stick', count: 9 },
      ],
    });
    drive(sim, 2, 0, 0, 1, 1, PlayerButton.Interact);
    expect(sim.drainCollectionEvents()).toEqual([
      { netId: 2, item: 'stick', count: 1, x: pile.x, z: pile.z, depleted: false },
    ]);
    drive(sim, 2, 0, 0, 1, 2, PlayerButton.Interact);
    expect(sim.drainCollectionEvents()).toEqual([]);
    sim.discardItem(2, { item: 'log', amount: 10, destroy: true }, clockMs);
    drive(sim, 2, 0, 0, 1, 3, PlayerButton.Interact);
    expect(sim.drainCollectionEvents()).toEqual([
      { netId: 2, item: 'stick', count: 1, x: pile.x, z: pile.z, depleted: true },
    ]);
    expect(sim.droppedPilesList()).toEqual([]);
  });

  it('does not celebrate piles disappearing through expiry', () => {
    const sim = setUp([{ item: 'stick', count: 1 }]);
    sim.discardItem(1, { item: 'stick', amount: 1, destroy: false }, clockMs);
    sim.fadeDroppedPiles(clockMs + (DROPPED_PILE_SECONDS + 1) * 1000);
    expect(sim.drainCollectionEvents()).toEqual([]);
  });

  it('adds more of the same, dropped in the same place, to the one pile', () => {
    const sim = setUp([{ item: 'stick', count: 5 }]);
    sim.discardItem(1, { item: 'stick', amount: 2, destroy: false }, clockMs);
    sim.discardItem(1, { item: 'stick', amount: 3, destroy: false }, clockMs);

    expect(sim.droppedPilesList()).toEqual([expect.objectContaining({ item: 'stick', count: 5 })]);
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(0);
  });

  it('keeps different things in piles of their own', () => {
    const sim = setUp([
      { item: 'stick', count: 2 },
      { item: 'flower', count: 2 },
    ]);
    sim.discardItem(1, { item: 'stick', amount: 2, destroy: false }, clockMs);
    sim.discardItem(1, { item: 'flower', amount: 2, destroy: false }, clockMs);
    expect(sim.droppedPilesList()).toHaveLength(2);
  });

  it('destroys without leaving anything behind', () => {
    const sim = setUp([{ item: 'log', count: 3 }]);
    expect(sim.discardItem(1, { item: 'log', amount: 3, destroy: true }, clockMs)).toBe(true);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    expect(sim.droppedPilesList()).toEqual([]);
    expect(sim.drainDiscardEvents()).toEqual([
      { netId: 1, item: 'log', count: 3, destroyed: true },
    ]);
  });

  it('never drops or destroys the bag', () => {
    const sim = setUp([]);
    expect(sim.discardItem(1, { item: 'bag', amount: 1, destroy: false }, clockMs)).toBe(false);
    expect(sim.discardItem(1, { item: 'bag', amount: 1, destroy: true }, clockMs)).toBe(false);
    expect(countOf(sim.inventoryOf(1), 'bag')).toBe(1);
  });

  it('never takes more than you hold, and does nothing with what you do not have', () => {
    const sim = setUp([{ item: 'stick', count: 3 }]);
    sim.discardItem(1, { item: 'stick', amount: 99, destroy: false }, clockMs);
    expect(sim.droppedPilesList()).toEqual([expect.objectContaining({ count: 3 })]);
    expect(sim.discardItem(1, { item: 'flower', amount: 1, destroy: false }, clockMs)).toBe(false);
    expect(sim.discardItem(1, { item: 'stick', amount: 0, destroy: true }, clockMs)).toBe(false);
  });

  it("drops tools too, and an emptied hand is everybody's news", () => {
    const sim = setUp([{ item: 'axe', count: 1 }]);
    sim.useItem(1, 'axe');
    sim.drainEquipEvents();

    sim.discardItem(1, { item: 'axe', amount: 1, destroy: false }, clockMs);
    expect(sim.equippedItemOf(1)).toBeNull();
    expect(sim.drainEquipEvents()).toEqual([1]);
    expect(sim.droppedPilesList()).toEqual([expect.objectContaining({ item: 'axe', count: 1 })]);
  });

  it('will not drop anything indoors, where there is nowhere for it to lie, but will destroy', () => {
    const sim = setUp([{ item: 'stick', count: 3 }]);
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 42);
    expect(sim.discardItem(1, { item: 'stick', amount: 1, destroy: false }, clockMs)).toBe(false);
    expect(sim.discardItem(1, { item: 'stick', amount: 1, destroy: true }, clockMs)).toBe(true);
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(2);
  });

  it('lands at your feet rather than in the pond', () => {
    const circle = POND[0];
    if (circle === undefined) throw new Error('no pond');
    const sim = setUp([{ item: 'stick', count: 1 }]);
    // On the bank to the pond's west, facing east toward the water.
    const bank = { x: circle.x - circle.radius - 0.4, y: 0, z: circle.z };
    sim.placePlayer(1, bank, -Math.PI / 2);

    sim.discardItem(1, { item: 'stick', amount: 1, destroy: false }, clockMs);
    const [pile] = sim.droppedPilesList();
    expect(pile?.x).toBeCloseTo(bank.x);
    expect(pile?.z).toBeCloseTo(bank.z);
  });

  it('lets anybody pick a pile up with the interact button', () => {
    const sim = setUp([{ item: 'stick', count: 4 }]);
    sim.discardItem(1, { item: 'stick', amount: 4, destroy: false }, clockMs);
    const [pile] = sim.droppedPilesList();
    if (pile === undefined) throw new Error('nothing was dropped');
    sim.drainPileChanges();

    sim.addPlayer(2, carrying(2, []));
    sim.placePlayer(2, { x: pile.x, y: 0, z: pile.z }, 0);
    sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(2), 'stick')).toBe(4);
    expect(sim.droppedPilesList()).toEqual([]);
    expect(sim.drainPileChanges()).toEqual([pile.id]);
    expect(sim.drainGatherEvents()).toContain(2);
  });

  it('picks up only what fits, leaving the rest lying there', () => {
    const sim = setUp([{ item: 'stick', count: 5 }]);
    sim.discardItem(1, { item: 'stick', amount: 5, destroy: false }, clockMs);
    const [pile] = sim.droppedPilesList();
    if (pile === undefined) throw new Error('nothing was dropped');

    // No bag: six slots, five full of logs and one nearly full of sticks.
    sim.addPlayer(2, {
      netId: 2,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'log', count: ITEM_KINDS.log.stackSize * 5 },
        { item: 'stick', count: ITEM_KINDS.stick.stackSize - 2 },
      ],
      hunger: HUNGER_MAX,
    });
    sim.placePlayer(2, { x: pile.x, y: 0, z: pile.z }, 0);
    sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());

    expect(countOf(sim.inventoryOf(2), 'stick')).toBe(ITEM_KINDS.stick.stackSize);
    expect(sim.drainPickupRefusals()).toEqual([{ netId: 2, item: 'stick', reason: 'full' }]);
    expect(sim.droppedPilesList()).toEqual([expect.objectContaining({ count: 3 })]);
  });

  it('fades after ten minutes if nobody picks it up', () => {
    const sim = setUp([{ item: 'stick', count: 1 }]);
    const droppedAt = clockMs;
    sim.discardItem(1, { item: 'stick', amount: 1, destroy: false }, droppedAt);
    sim.drainPileChanges();

    sim.fadeDroppedPiles(droppedAt + DROPPED_PILE_SECONDS * 1000 - 1);
    expect(sim.droppedPilesList()).toHaveLength(1);
    sim.fadeDroppedPiles(droppedAt + DROPPED_PILE_SECONDS * 1000);
    expect(sim.droppedPilesList()).toEqual([]);
    expect(sim.drainPileChanges()).toHaveLength(1);
  });

  it('starts the ten minutes over whenever more is added to a pile', () => {
    const sim = setUp([{ item: 'stick', count: 2 }]);
    const first = clockMs;
    sim.discardItem(1, { item: 'stick', amount: 1, destroy: false }, first);
    sim.discardItem(1, { item: 'stick', amount: 1, destroy: false }, first + 60_000);
    sim.fadeDroppedPiles(first + DROPPED_PILE_SECONDS * 1000);
    expect(sim.droppedPilesList()).toHaveLength(1);
  });

  it('keeps only so many piles, letting the oldest fade early', () => {
    const sim = setUp([{ item: 'stick', count: MAX_DROPPED_PILES + 1 }]);
    for (let i = 0; i <= MAX_DROPPED_PILES; i++) {
      // Each one a few steps from the last, so none of them share a pile.
      sim.placePlayer(1, { x: -20 + (i % 10) * 2, y: 0, z: -12 + Math.floor(i / 10) * 2 }, 0);
      sim.discardItem(1, { item: 'stick', amount: 1, destroy: false }, clockMs + i);
    }
    const piles = sim.droppedPilesList();
    expect(piles).toHaveLength(MAX_DROPPED_PILES);
    expect(piles.some((pile) => pile.id === 1)).toBe(false);
  });

  it('remembers every pile across a save, fading on time even after waking', () => {
    const sim = setUp([{ item: 'flower', count: 3 }]);
    const droppedAt = clockMs;
    sim.discardItem(1, { item: 'flower', amount: 3, destroy: false }, droppedAt);
    const saved = sim.droppedPilesList().map((pile) => sim.persistedPile(pile.id));

    const later = createWorld();
    later.restoreDroppedPiles(
      saved.flatMap((pile) => (pile === null ? [] : [pile])),
      clockMs,
    );
    expect(later.droppedPilesList()).toEqual(sim.droppedPilesList());
    later.fadeDroppedPiles(droppedAt + DROPPED_PILE_SECONDS * 1000);
    expect(later.droppedPilesList()).toEqual([]);
  });
});

describe('gathering flowers', () => {
  const spot = FLOWER_PATCHES[0];
  if (spot === undefined) throw new Error('no flower patch to test against');

  it('gathers a flower, not a stick, at a flower patch', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'bag', count: 1 }],
      hunger: HUNGER_MAX,
    });
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
    items: [
      { item: 'bag', count: 1 },
      { item: 'stick', count },
    ],
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
        { item: 'bag', count: 1 },
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
    items: [
      { item: 'bag', count: 1 },
      { item: 'axe', count: 1 },
    ],
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

  it('does nothing with the axe in the pack but not the active item', () => {
    const sim = createWorld();
    // Carrying the axe is not enough on its own - the rod is what the
    // hotbar last selected, so a swing has nothing to swing.
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
        { item: 'rod', count: 1 },
      ],
      hunger: HUNGER_MAX,
      equippedItem: 'rod',
    });
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    for (let i = 1; i <= 40; i++) {
      sim.queueInput(1, createInput(i, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
    }

    expect(sim.felledTreeIds()).toEqual([]);
    expect(sim.drainChopEvents()).toEqual([]);
  });

  it('takes the number of swings the tree is worth', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    const expected = choppingRuleFor(PROP_KINDS.oak)?.swingsToFell ?? 0;
    expect(swingUntilFelled(sim, 1, tree.id)).toBe(expected);
  });

  it('chops the tree the character aims at, wherever the camera looks', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    // The camera looks straight away from the tree (yaw pi); the character
    // was clicked round to face it (yaw 0).
    swingOnce(sim, 1, 1, 0, Math.PI);

    expect(sim.drainChopEvents().map((event) => event.treeId)).toEqual([tree.id]);
  });

  it('misses a tree the camera looks at but the character does not face', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    swingOnce(sim, 1, 1, Math.PI, 0);

    expect(sim.drainChopEvents()).toEqual([]);
  });

  it('lands partway into the swing, not the moment you click', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    let seq = 1;
    sim.queueInput(1, createInput(seq++, 0, 0, 0, PlayerButton.Swing));
    sim.step(tickClock());
    const landedOn: number[] = [];
    for (let age = 1; age <= LIGHT_COMBO[0].end; age++) {
      if (sim.drainChopEvents().length > 0) landedOn.push(age - 1);
      sim.queueInput(1, createInput(seq++, 0, 0, 0, 0));
      sim.step(tickClock());
    }
    expect(landedOn).toEqual([LIGHT_COMBO[0].impact]);
  });

  it('counts down as you go, so you can see it coming', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'birch');
    standAt(sim, 1, tree);
    const total = choppingRuleFor(PROP_KINDS.birch)?.swingsToFell ?? 0;

    swingOnce(sim, 1, 1);

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

    // Hold the button down for one swing's worth of ticks.
    let landed = 0;
    for (let i = 1; i <= LIGHT_COMBO[0].end; i++) {
      sim.queueInput(1, createInput(i, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
      landed += sim.drainChopEvents().length;
    }
    expect(landed).toBe(1);
  });

  it('leaves individual logs on the ground after the fall, for anybody to gather', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);
    swingUntilFelled(sim, 1, tree.id);

    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    expect(sim.droppedPilesList()).toEqual([]);
    const felledAt = clockMs;
    sim.step(felledAt + TREE_BREAK_SECONDS * 1000 - 1);
    expect(sim.droppedPilesList()).toEqual([]);
    sim.step(felledAt + TREE_BREAK_SECONDS * 1000);
    const logs = sim.droppedPilesList();
    expect(logs).toHaveLength(choppingRuleFor(PROP_KINDS.oak)?.logs ?? 0);
    expect(logs.every((pile) => pile.item === 'log' && pile.count === 1)).toBe(true);
    expect(logs.every((pile) => pile.z < tree.z)).toBe(true);
    expect(logs.every((pile) => !overlapsWater(sim.clearing.water, pile.x, pile.z, 0))).toBe(true);
    sim.addPlayer(2);
    for (const [index, pile] of logs.entries()) {
      sim.placePlayer(2, { x: pile.x, y: 0, z: pile.z }, 0);
      sim.queueInput(2, createInput(index + 1, 0, 0, 0, PlayerButton.Interact));
      sim.step(felledAt + (TREE_BREAK_SECONDS + 1) * 1000 + index * TICK_MILLISECONDS);
    }
    expect(sim.droppedPilesList()).toEqual([]);
    expect(countOf(sim.inventoryOf(2), 'log')).toBe(logs.length);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
  });

  it('keeps pending logs across a restart without revealing them early or creating duplicates', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);
    swingUntilFelled(sim, 1, tree.id);
    const trees = sim.persistableTrees();
    const piles = sim.drainPileChanges().flatMap((id) => {
      const pile = sim.persistedPile(id);
      return pile === null ? [] : [pile];
    });
    const waking = createWorld();
    waking.restoreTrees(trees);
    waking.restoreDroppedPiles(piles, clockMs + 500);
    expect(waking.changedTrees()).toEqual(sim.changedTrees());
    expect(waking.droppedPilesList()).toEqual([]);
    waking.fadeDroppedPiles(clockMs + TREE_BREAK_SECONDS * 1000);
    expect(waking.droppedPilesList()).toHaveLength(4);
    waking.fadeDroppedPiles(clockMs + TREE_BREAK_SECONDS * 1000 + 1000);
    expect(waking.droppedPilesList()).toHaveLength(4);
    waking.fadeDroppedPiles(clockMs + (TREE_BREAK_SECONDS + DROPPED_PILE_SECONDS) * 1000);
    expect(waking.droppedPilesList()).toEqual([]);
  });

  it('uses the direction of the final cutter and never auto-awards wood from a strong strike', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    sim.addPlayer(2, withAxe(2));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);
    swingOnce(sim, 1, 1);
    sim.placePlayer(2, { x: tree.x - 2, y: 0, z: tree.z }, -Math.PI / 2);
    sim.queueInput(2, createInput(1, 0, 0, -Math.PI / 2, PlayerButton.Charge));
    sim.step(tickClock());
    for (let seq = 2; seq < 50; seq++) {
      sim.queueInput(2, createInput(seq, 0, 0, -Math.PI / 2, 0));
      sim.step(tickClock());
      if (sim.felledTreeIds().includes(tree.id)) break;
    }
    expect(sim.changedTrees().find((entry) => entry.treeId === tree.id)?.fall?.yaw).toBeCloseTo(
      Math.PI / 2,
    );
    expect(countOf(sim.inventoryOf(2), 'log')).toBe(0);
    sim.step(clockMs + TREE_BREAK_SECONDS * 1000);
    expect(sim.droppedPilesList()).toHaveLength(4);
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
      // The axe and nine full stacks of logs fill all ten of the bag's slots.
      items: [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
        { item: 'log', count: 90 },
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
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(90);
    for (let tick = 0; tick < 40; tick++) {
      sim.queueInput(1, createInput(seq++, 0, 0, 0, 0));
      sim.step(tickClock());
    }
    const logs = sim.droppedPilesList();
    expect(logs).toHaveLength(choppingRuleFor(PROP_KINDS.birch)?.logs ?? 0);
    const first = logs[0];
    if (first === undefined) throw new Error('missing fallen logs');
    sim.placePlayer(1, { x: first.x, y: 0, z: first.z }, 0);
    sim.queueInput(1, createInput(1000, 0, 0, 0, PlayerButton.Interact));
    sim.step(clockMs + (TREE_BREAK_SECONDS + 1) * 1000);
    expect(sim.droppedPilesList()).toHaveLength(logs.length);
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

    swingOnce(sim, 1, 1);
    expect(sim.drainChopEvents()).toHaveLength(1);
    expect(sim.drainChopEvents()).toEqual([]);
  });
});

describe('trees in the wilderness', () => {
  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [
      { item: 'bag', count: 1 },
      { item: 'axe', count: 1 },
    ],
    hunger: HUNGER_MAX,
  });

  /** A forest tree with nothing else within five metres, so there is room to stand and swing at it. */
  function loneForestTree(sim: WorldSimulation, kind: 'oak' | 'birch' | 'pine') {
    const tree = sim.wilderness.props.find(
      (prop) =>
        prop.kind === kind &&
        sim.wilderness.props.every(
          (other) => other === prop || Math.hypot(other.x - prop.x, other.z - prop.z) > 5,
        ) &&
        // Keep to open ground well inside the world, away from the lake and its islands.
        Math.hypot(prop.x, prop.z) < 120 &&
        Math.hypot(prop.x - 90, prop.z + 90) > 80,
    );
    if (tree === undefined) throw new Error(`no lone ${kind} in the forest`);
    return tree;
  }

  function standBy(
    sim: WorldSimulation,
    netId: number,
    tree: { x: number; z: number; kind: string; scale: number },
  ) {
    const radius = PROP_KINDS[tree.kind as keyof typeof PROP_KINDS].colliderRadius * tree.scale;
    sim.placePlayer(netId, { x: tree.x, y: 0, z: tree.z + radius + 1 }, 0);
  }

  /** Swing until the tree is down; returns the moment it fell. */
  function swingUntilDown(sim: WorldSimulation, netId: number, treeId: number): number {
    let seq = 1;
    for (let tick = 0; tick < 200; tick++) {
      sim.queueInput(netId, createInput(seq++, 0, 0, 0, PlayerButton.Swing));
      const now = tickClock();
      sim.step(now);
      if (sim.isFelled(treeId)) return now;
    }
    throw new Error('the tree never came down');
  }

  it('numbers the forest apart from the clearing, so no tree shares a number', () => {
    const sim = createWorld();
    const ids = [...sim.clearing.props, ...sim.wilderness.props].map((prop) => prop.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...sim.clearing.props.map((prop) => prop.id))).toBeLessThan(
      WILDERNESS_PROP_FIRST_ID,
    );
    expect(Math.min(...sim.wilderness.props.map((prop) => prop.id))).toBeGreaterThanOrEqual(
      WILDERNESS_PROP_FIRST_ID,
    );
  });

  it('takes the same swings to fell a forest tree as a clearing tree of its kind', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = loneForestTree(sim, 'pine');
    standBy(sim, 1, tree);

    expect(sim.treeInReachOf({ x: tree.x, y: 0, z: tree.z + 2 }, 0)?.prop.id).toBe(tree.id);
    let landed = 0;
    let seq = 1;
    for (let tick = 0; tick < 200 && !sim.isFelled(tree.id); tick++) {
      sim.queueInput(1, createInput(seq++, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
      landed += sim.drainChopEvents().length;
    }
    expect(landed).toBe(choppingRuleFor(PROP_KINDS.pine)?.swingsToFell);
    expect(sim.felledTreeIds()).toEqual([tree.id]);
    expect(sim.swingsLeftOn(tree.id)).toBeNull();
  });

  it('leaves a stump you can walk over, and drops the logs where it fell', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = loneForestTree(sim, 'oak');
    standBy(sim, 1, tree);
    const trunk =
      sim.collision.colliders[
        sim.clearing.colliders.length + (sim.wilderness.indexById.get(tree.id) ?? -1)
      ];
    if (trunk?.shape !== 'cylinder') throw new Error('expected a cylinder trunk');
    const trunkHeight = trunk.height;

    swingUntilDown(sim, 1, tree.id);

    const stump =
      sim.collision.colliders[
        sim.clearing.colliders.length + (sim.wilderness.indexById.get(tree.id) ?? -1)
      ];
    if (stump?.shape !== 'cylinder') throw new Error('expected a cylinder stump');
    expect(stump.height).toBeLessThan(trunkHeight);
    expect(stump.height).toBeLessThan(1);
    // The logs show once the tree has finished falling.
    sim.step(clockMs + (TREE_BREAK_SECONDS + 1) * 1000);
    expect(sim.droppedPilesList().length).toBeGreaterThan(0);
  });

  it('no longer offers a felled forest tree to the next swing', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = loneForestTree(sim, 'birch');
    standBy(sim, 1, tree);
    swingUntilDown(sim, 1, tree.id);

    expect(sim.treeInReachOf({ x: tree.x, y: 0, z: tree.z + 2 }, 0)).toBeNull();
  });

  it('does not put a log inside the trunk of the tree beside it', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    // The densest stretch of forest, so a log landing on a neighbour is likely if nothing stops it.
    const crowded = sim.wilderness.props
      .filter((prop) => choppingRuleFor(PROP_KINDS[prop.kind]) !== null)
      .map((prop) => ({
        prop,
        near: sim.wilderness.props.filter(
          (other) => other !== prop && Math.hypot(other.x - prop.x, other.z - prop.z) < 3.5,
        ).length,
      }))
      .filter((entry) => Math.hypot(entry.prop.x, entry.prop.z) < 110)
      .sort((a, b) => b.near - a.near)[0];
    if (crowded === undefined) throw new Error('no crowded tree');
    const tree = crowded.prop;
    sim.placePlayer(1, { x: tree.x, y: 0, z: tree.z + 2.5 }, 0);
    swingUntilDown(sim, 1, tree.id);

    for (const log of sim.droppedPilesList()) {
      for (const other of sim.wilderness.props) {
        if (other.id === tree.id) continue;
        const reach = PROP_KINDS[other.kind].colliderRadius * other.scale;
        expect(Math.hypot(other.x - log.x, other.z - log.z)).toBeGreaterThanOrEqual(reach - 1e-6);
      }
    }
  });

  it('hands over only the trees that changed, once', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = loneForestTree(sim, 'birch');
    standBy(sim, 1, tree);
    expect(sim.drainTreeChanges()).toEqual([]);

    swingUntilDown(sim, 1, tree.id);

    const changed = sim.drainTreeChanges();
    expect(changed).toEqual([tree.id]);
    expect(sim.drainTreeChanges()).toEqual([]);
    expect(sim.changedTrees(changed)).toEqual([
      expect.objectContaining({ treeId: tree.id, felled: true, generation: 0 }),
    ]);
    expect(sim.persistableTrees(changed).map((saved) => saved.treeId)).toEqual([tree.id]);
  });

  it('remembers a felled forest tree across a restart, stump and all', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = loneForestTree(sim, 'oak');
    standBy(sim, 1, tree);
    swingUntilDown(sim, 1, tree.id);

    const later = createWorld();
    later.restoreTrees(sim.persistableTrees());

    expect(later.felledTreeIds()).toEqual([tree.id]);
    const stump =
      later.collision.colliders[
        later.clearing.colliders.length + (later.wilderness.indexById.get(tree.id) ?? -1)
      ];
    if (stump?.shape !== 'cylinder') throw new Error('expected a cylinder');
    expect(stump.height).toBeLessThan(1);
    // What was only read back is not news to be saved again.
    expect(later.drainTreeChanges()).toEqual([]);
  });

  it('grows a forest tree back at its own size once its time is up', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = loneForestTree(sim, 'birch');
    standBy(sim, 1, tree);
    const felledAt = swingUntilDown(sim, 1, tree.id);
    sim.drainTreeChanges();
    const dueAt = regrowDueAtMs(sim.seed, tree.id, 0, felledAt);
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);

    expect(sim.regrowTrees(dueAt - 60_000)).toEqual([]);
    expect(sim.regrowTrees(dueAt)).toEqual([{ treeId: tree.id, generation: 1 }]);
    expect(sim.isFelled(tree.id)).toBe(false);
    expect(sim.generationOf(tree.id)).toBe(1);
    expect(sim.drainTreeChanges()).toEqual([tree.id]);
    // It can be chopped again, at whatever size it came back.
    const grown = treeAtGeneration(sim.seed, tree, 1);
    const beside = {
      x: tree.x,
      y: 0,
      z: tree.z + PROP_KINDS.birch.colliderRadius * grown.scale + 1,
    };
    const target = sim.treeInReachOf(beside, 0);
    expect(target?.prop.id).toBe(tree.id);
    expect(target?.prop.scale).toBe(grown.scale);
  });

  it('waits for somebody to step away before a forest tree grows back', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = loneForestTree(sim, 'birch');
    standBy(sim, 1, tree);
    const felledAt = swingUntilDown(sim, 1, tree.id);
    const dueAt = regrowDueAtMs(sim.seed, tree.id, 0, felledAt);

    // Still right beside the stump.
    expect(sim.regrowTrees(dueAt + 60_000)).toEqual([]);
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    expect(sim.regrowTrees(dueAt + 60_000)).toHaveLength(1);
  });
});

describe('trees growing back', () => {
  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [
      { item: 'bag', count: 1 },
      { item: 'axe', count: 1 },
    ],
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
      ANIMAL_DENS.filter((den) => Math.hypot(den.x, den.z) <= 100)
        .map((den) => den.id)
        .sort(),
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
    expect(animals.map((animal) => animal.netId)).toEqual(
      ANIMAL_DENS.filter((den) => Math.hypot(den.x - 140, den.z - 140) <= 100).map((den) => den.id),
    );
  });
});

describe('a fox that hunts rabbits', () => {
  const foxDen = ANIMAL_DENS.find((entry) => entry.id === 1007);
  if (foxDen === undefined) throw new Error('den 1007 is gone from the data table');
  const rabbitDen = ANIMAL_DENS.find((entry) => entry.id === 1001);
  if (rabbitDen === undefined) throw new Error('den 1001 is gone from the data table');

  /** An animal entity out of a snapshot, or throws: every test here expects one. */
  function animalEntity(sim: WorldSimulation, viewerNetId: number, animalId: number) {
    const found = sim
      .snapshotFor(viewerNetId)
      .find((entity) => entity.netId === animalId && (entity.flags & SnapshotFlag.Animal) !== 0);
    if (found === undefined) throw new Error(`Animal ${animalId} was not in the snapshot`);
    return found;
  }

  /**
   * Add a player close enough to keep the pair in its snapshot, well past
   * both animals' alert radii so it never itself becomes the thing either
   * one reacts to.
   */
  function watchFromAfar(sim: WorldSimulation): void {
    sim.addPlayer(1);
    sim.placePlayer(1, { x: 0, y: 0, z: 50 }, 0);
  }

  it('closes in once a rabbit wanders within its detection radius', () => {
    const sim = createWorld();
    watchFromAfar(sim);
    sim.placeAnimal(foxDen.id, { x: 0, y: 0, z: 0 });
    sim.placeAnimal(rabbitDen.id, { x: 0, y: 0, z: 8 });

    const distanceApart = (): number => {
      const fox = animalEntity(sim, 1, foxDen.id);
      const rabbit = animalEntity(sim, 1, rabbitDen.id);
      return Math.hypot(fox.x - rabbit.x, fox.z - rabbit.z);
    };

    const before = distanceApart();
    for (let i = 0; i < 10; i++) sim.step(tickClock());
    expect(distanceApart()).toBeLessThan(before);
  });

  it('catches the rabbit once it closes the distance, the same way a knockout catch works', () => {
    const sim = createWorld();
    watchFromAfar(sim);
    sim.placeAnimal(foxDen.id, { x: 0, y: 0, z: 0 });
    sim.placeAnimal(rabbitDen.id, { x: 0, y: 0, z: PREDATOR_CATCH_RADIUS / 2 });

    sim.step(tickClock());

    const stillThere = sim
      .snapshotFor(1)
      .some(
        (entity) => entity.netId === rabbitDen.id && (entity.flags & SnapshotFlag.Animal) !== 0,
      );
    expect(stillThere).toBe(false);
  });

  it('still flees a nearby player instead of finishing a chase already in reach', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: 0, y: 0, z: 3 }, 0);
    sim.placeAnimal(foxDen.id, { x: 0, y: 0, z: 0 });
    sim.placeAnimal(rabbitDen.id, { x: 0, y: 0, z: PREDATOR_CATCH_RADIUS / 2 });

    sim.step(tickClock());

    const stillThere = sim
      .snapshotFor(1)
      .some(
        (entity) => entity.netId === rabbitDen.id && (entity.flags & SnapshotFlag.Animal) !== 0,
      );
    expect(stillThere).toBe(true);
  });

  it('a rabbit bolts from a nearby fox the same way it bolts from a player', () => {
    const sim = createWorld();
    watchFromAfar(sim);
    sim.placeAnimal(foxDen.id, { x: 0, y: 0, z: 0 });
    sim.placeAnimal(rabbitDen.id, { x: 0, y: 0, z: 5 });

    sim.step(tickClock());

    const rabbit = animalEntity(sim, 1, rabbitDen.id);
    // Fleeing carries it dead away from the fox at fleeSpeed (6 m/s) in a
    // single tick - many times what its own calm wander (1.1 m/s) could ever
    // cover, and wander is not even guaranteed to head this direction.
    expect(rabbit.z).toBeGreaterThan(5 + ANIMAL_KINDS.rabbit.wanderSpeed * TICK_SECONDS * 2);
  });
});

describe('catching wildlife', () => {
  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [
      { item: 'bag', count: 1 },
      { item: 'axe', count: 1 },
    ],
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

    swingOnce(sim, 1, 1, FACE_DEN);

    expect(sim.drainCatchEvents()).toEqual([{ netId: 1, item: 'meat', added: 1 }]);
    expect(countOf(sim.inventoryOf(1), 'meat')).toBe(1);
  });

  it('catches it with whatever is in hand - the rod as well as the axe', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
        { item: 'rod', count: 1 },
      ],
      hunger: HUNGER_MAX,
      equippedItem: 'rod',
    });
    standByDen(sim, 1);

    swingOnce(sim, 1, 1, FACE_DEN);

    expect(sim.drainCatchEvents()).toEqual([{ netId: 1, item: 'meat', added: 1 }]);
  });

  it('never lets a tree hide behind a rabbit: a swing near a den has no tree to prefer', () => {
    // Wildlife dens sit well past the clearing's own tree line, and only
    // clearing trees are ever chopping targets (see decision 0015): the
    // wilderness is scenery only. So a swing here can only ever be at most
    // one thing, and this is that there is nothing else it could be.
    const sim = createWorld();
    expect(sim.treeInReachOf(facingDen, FACE_DEN)).toBeNull();
  });

  it('refuses to catch anything with nothing in hand', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    standByDen(sim, 1);

    swingOnce(sim, 1, 1, FACE_DEN);

    expect(sim.drainCatchEvents()).toEqual([]);
  });

  it('still counts as caught when the pack has no room for the meat', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      ...withAxe(1),
      items: [
        // The axe and nine full stacks of meat fill all ten of the bag's slots.
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
        { item: 'meat', count: ITEM_KINDS.meat.stackSize * 9 },
      ],
    });
    standByDen(sim, 1);

    swingOnce(sim, 1, 1, FACE_DEN);

    expect(sim.drainCatchEvents()).toEqual([{ netId: 1, item: 'meat', added: 0 }]);
    expect(countOf(sim.inventoryOf(1), 'meat')).toBe(ITEM_KINDS.meat.stackSize * 9);
  });

  it('vanishes from every snapshot the moment it is caught', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    standByDen(sim, 1);

    swingOnce(sim, 1, 1, FACE_DEN);

    const stillThere = sim
      .snapshotFor(1)
      .some((entity) => entity.netId === den.id && (entity.flags & SnapshotFlag.Animal) !== 0);
    expect(stillThere).toBe(false);
  });

  it('is back at its den, catchable again, once the respawn wait is up', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    standByDen(sim, 1);

    let seq = swingOnce(sim, 1, 1, FACE_DEN);
    const caughtAt = clockMs;
    expect(sim.drainCatchEvents()).toHaveLength(1);

    // Short of the wait: still gone. Also lets the first swing finish, well
    // before the animal is due back - a rabbit fresh from its den gets one
    // wander tick's start on running off again, so nothing here can afford
    // to dawdle once it reappears.
    for (let i = 0; i < LIGHT_COMBO[0].end; i++) {
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

    // Worth a swing straight away, begun before it has had any chance to
    // wander off the spot it just reappeared on.
    swingOnce(sim, 1, seq, FACE_DEN);
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
    items: [
      { item: 'bag', count: 1 },
      { item: 'axe', count: 1 },
    ],
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

  /**
   * Keep clicking at it, a fresh click every few ticks, until it is beaten
   * or the clock runs out, collecting what came of it. It hits back in the
   * meantime: a hit makes you flinch and loses you that swing, so this does
   * not count on every click landing - only on each landed one counting.
   */
  function fightUntilDefeated(sim: WorldSimulation, netId: number, seq: number) {
    const hitsLeft: number[] = [];
    for (let tick = 0; tick < 400; tick++) {
      const clicking = tick % 3 === 0;
      sim.queueInput(netId, createInput(seq++, 0, 0, 0, clicking ? PlayerButton.Swing : 0));
      sim.step(tickClock());
      hitsLeft.push(...sim.drainThreatHitEvents().map((event) => event.hitsLeft));
      const caught = sim.drainCatchEvents();
      if (caught.length > 0) return { hitsLeft, caught, seq };
    }
    throw new Error('never beat it');
  }

  it('takes several swings to fight off, one ThreatHit short each time', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    sim.placePlayer(1, closeToDen, 0);

    const fight = fightUntilDefeated(sim, 1, 1);
    const countdown = Array.from(
      { length: threat.hitsToDefeat - 1 },
      (_, i) => threat.hitsToDefeat - 1 - i,
    );
    expect(fight.hitsLeft).toEqual(countdown);
    expect(fight.caught).toEqual([{ netId: 1, item: null, added: 0 }]);
  });

  it('reports full hits again once a defeated one comes back', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    sim.placePlayer(1, closeToDen, 0);

    const fight = fightUntilDefeated(sim, 1, 1);
    const defeatedAt = clockMs;

    sim.queueInput(1, createInput(fight.seq, 0, 0, 0, 0));
    sim.step(defeatedAt + ANIMAL_RESPAWN_SECONDS * 1000 + TICK_MILLISECONDS);
    expect(sim.drainThreatHitEvents()).toEqual([
      { animalId: raccoonDen.id, hitsLeft: threat.hitsToDefeat, netId: null },
    ]);
  });

  it('makes you flinch when it lands a hit, stopping your swing', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    sim.placePlayer(1, closeToDen, 0);

    // Stand there through the wind-up, swinging at the very end of it.
    let seq = 1;
    let flinched = false;
    for (let tick = 0; tick < 20 && !flinched; tick++) {
      sim.queueInput(1, createInput(seq++, 0, 0, 0, tick >= 10 ? PlayerButton.Swing : 0));
      sim.step(tickClock());
      flinched = sim.actionOf(1)?.kind === ActionKind.Flinch;
    }
    expect(flinched).toBe(true);
    expect(sim.healthOf(1)).toBe(HEALTH_MAX - threat.damage);
  });

  describe('a knockout', () => {
    it('teleports you away and heals fully once health empties', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, closeToDen, 0);

      // Four full wind-up-then-cooldown cycles: enough to empty a hundred
      // health at twenty-five a hit, with room to spare before a fifth starts.
      for (let i = 0; i < 4 * 42; i++) sim.step(tickClock());

      // Down where they fell for a moment, healed already...
      expect(sim.healthOf(1)).toBe(HEALTH_MAX);
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.KnockedOut);

      // ...then up off the ground, far away in the clearing.
      for (let i = 0; i < KNOCKED_OUT_TICKS; i++) sim.step(tickClock());
      expect(sim.actionOf(1)).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Ground });
      const position = sim.snapshotFor(1).find((entity) => entity.netId === 1);
      expect(position).toBeDefined();
      if (position === undefined) return;
      const gapFromDen = Math.hypot(position.x - raccoonDen.x, position.z - raccoonDen.z);
      expect(gapFromDen).toBeGreaterThan(20);
    });

    it('stays down, untouched, until it wakes up, however close the raccoon', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, closeToDen, 0);
      for (let i = 0; i < 4 * 42; i++) sim.step(tickClock());
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.KnockedOut);

      const events = sim.drainHealthEvents();
      for (let i = 0; i < KNOCKED_OUT_TICKS - 1; i++) sim.step(tickClock());
      expect(sim.healthOf(1)).toBe(HEALTH_MAX);
      expect(sim.drainHealthEvents()).toEqual([]);
      expect(events.some((event) => event.knockedOut)).toBe(true);
    });

    it('saves you where you will wake up, if you leave while down', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, closeToDen, 0);
      for (let i = 0; i < 4 * 42; i++) sim.step(tickClock());
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.KnockedOut);

      const saved = sim.persistablePlayers().find((player) => player.netId === 1);
      expect(saved?.x).toBeCloseTo(SPAWN_POSITION.x, 3);
      expect(saved?.z).toBeCloseTo(SPAWN_POSITION.z, 3);
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
          items: [
            { item: 'bag', count: 1 },
            { item: 'log', count: 10 },
            { item: 'stick', count: 6 },
          ],
          hunger: HUNGER_MAX,
        },
        'chris',
      );
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
      sim.requestBuild(1, { kind: 'tent', x: 0, z: -inFront('tent'), yaw: 0 });
      sim.queueInput(1, createInput(1, 0, 0, 0, 0));
      sim.step(tickClock());
      const home = sim.drainBuildEvents()[0]?.prop;
      expect(home).toBeDefined();
      if (home === undefined) return;

      sim.placePlayer(1, closeToDen, 0);
      for (let i = 0; i < 4 * 42 + KNOCKED_OUT_TICKS; i++) sim.step(tickClock());

      // Inside, getting out of their own bed - see decisions 0055 and 0056.
      expect(sim.spaceOf(1)).toBe(home.id);
      expect(sim.actionOf(1)).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Bed });
      const position = sim.snapshotFor(1).find((entity) => entity.netId === 1);
      expect(position).toBeDefined();
      if (position === undefined) return;
      expect(position.x).toBeCloseTo(HOME_WAKE_SPOT.x * 0.8, 1);
      expect(position.z).toBeCloseTo(HOME_WAKE_SPOT.z * 0.8, 1);
      expect(sim.drainSpaceChanges().some((change) => change.space === home.id)).toBe(true);
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

    it('buries half of what you carry, tools aside, right where you fell', () => {
      const sim = createWorld();
      sim.addPlayer(
        1,
        {
          netId: 1,
          x: closeToDen.x,
          y: closeToDen.y,
          z: closeToDen.z,
          facingYaw: 0,
          items: [
            { item: 'axe', count: 1 },
            { item: 'log', count: 7 },
          ],
          hunger: HUNGER_MAX,
        },
        'chris',
      );
      sim.placePlayer(1, closeToDen, 0);
      for (let i = 0; i < 4 * 42; i++) sim.step(tickClock());

      // The axe stays - you would be stuck without it - and the pack keeps
      // the larger half of everything else.
      expect(countOf(sim.inventoryOf(1), 'axe')).toBe(1);
      expect(countOf(sim.inventoryOf(1), 'log')).toBe(4);

      const caches = sim.buriedCachesList();
      expect(caches).toHaveLength(1);
      expect(caches[0]).toEqual({
        id: caches[0]?.id,
        ownerNetId: 1,
        x: closeToDen.x,
        z: closeToDen.z,
      });
    });

    it('lets you dig your own cache back up, and nobody else', () => {
      const sim = createWorld();
      sim.addPlayer(
        1,
        {
          netId: 1,
          x: closeToDen.x,
          y: closeToDen.y,
          z: closeToDen.z,
          facingYaw: 0,
          // A bag, so digging the cache back up later has somewhere to put
          // what it finds - burying itself never touches it, since it is a
          // tool, but the dig-up is a pickup like any other.
          items: [
            { item: 'bag', count: 1 },
            { item: 'log', count: 7 },
          ],
          hunger: HUNGER_MAX,
        },
        'chris',
      );
      sim.placePlayer(1, closeToDen, 0);
      for (let i = 0; i < 4 * 42; i++) sim.step(tickClock());
      const cache = sim.buriedCachesList()[0];
      expect(cache).toBeDefined();
      if (cache === undefined) return;

      // Standing right on top of it is not enough if it is not yours.
      sim.addPlayer(2, withAxe(2), 'someone-else');
      sim.placePlayer(2, { x: cache.x, y: 0, z: cache.z }, 0);
      sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
      sim.step(tickClock());
      expect(sim.buriedCachesList()).toHaveLength(1);
      expect(countOf(sim.inventoryOf(2), 'log')).toBe(0);

      // Its own owner, back on the spot, gets it back in full.
      sim.placePlayer(1, { x: cache.x, y: 0, z: cache.z }, 0);
      sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
      sim.step(tickClock());
      expect(sim.buriedCachesList()).toHaveLength(0);
      expect(countOf(sim.inventoryOf(1), 'log')).toBe(7);
    });

    it('restores buried caches from storage, resolving the owner once they reconnect', () => {
      const sim = createWorld();
      const stored: BuriedCache = {
        id: 41,
        ownerPlayerKey: 'chris',
        x: closeToDen.x,
        z: closeToDen.z,
        items: [{ item: 'log', count: 2 }],
      };
      sim.restoreBuriedCaches([stored]);

      // Nobody is connected under that key yet, so there is nobody to hint at.
      expect(sim.buriedCachesList()).toEqual([
        { id: 41, ownerNetId: null, x: stored.x, z: stored.z },
      ]);

      sim.addPlayer(1, withAxe(1), 'chris');
      expect(sim.buriedCachesList()).toEqual([{ id: 41, ownerNetId: 1, x: stored.x, z: stored.z }]);
    });
  });

  describe('a dodge through its swing', () => {
    // Aimed straight at the den (yaw 0 already faces it from here) rather
    // than away: a dodge this size would otherwise carry a player already
    // this close straight out of attack range, which would only prove
    // distance saved them, not the untouchable window this is actually
    // about. Landing just past the den keeps them just as reachable on the
    // far side, so only the window itself can be what saves them.
    const towardDen = (seq: number): PlayerInput => createInput(seq, 0, 1, 0, PlayerButton.Dodge);

    it('comes through untouched if it lands shortly before the swing resolves', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, closeToDen, 0);

      // Well into the twelve-tick wind-up, but with room to spare before it
      // resolves - the untouchable window (seven ticks) easily reaches.
      for (let i = 0; i < 8; i++) sim.step(tickClock());
      sim.queueInput(1, towardDen(9));
      sim.step(tickClock());
      for (let i = 0; i < 4; i++) sim.step(tickClock());

      expect(sim.healthOf(1)).toBe(HEALTH_MAX);
      expect(sim.drainHealthEvents().some((event) => event.dodged)).toBe(true);
    });

    it('has worn off by the time the swing resolves, if it lands too early', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, closeToDen, 0);

      // Right as the wind-up starts: seven ticks of cover is long gone by
      // the time it resolves, thirteen steps in.
      sim.queueInput(1, towardDen(1));
      sim.step(tickClock());
      for (let i = 0; i < 12; i++) sim.step(tickClock());

      expect(sim.healthOf(1)).toBe(HEALTH_MAX - threat.damage);
    });
  });

  describe('noticing players in the dark', () => {
    const kind = ANIMAL_KINDS.maskedRaccoon;
    // Chosen so a chase (which pulls up short at threat.attackRadius from
    // the player, not all the way to them) still carries the raccoon well
    // past its own leashRadius (10) from the den - the only way "it chased"
    // and "it only ever wandered" read as clearly different distances.
    // Also comfortably between the day alert radius (8) and the bolder one
    // once dark (8 * 1.75 = 14), which is the whole point being tested.
    const probeDistance = 13;
    const probePosition = { x: raccoonDen.x, y: 0, z: raccoonDen.z + probeDistance };
    // Each a clock of its own, anchored to a guaranteed day or night moment,
    // so these tests never depend on how many ticks the rest of this file
    // has already spent on the shared clock above.
    let dayMs = DAY_LENGTH_MS * 0.5;
    const tickDay = (): number => (dayMs += TICK_MILLISECONDS);
    let nightMs = DAY_LENGTH_MS * 0.85;
    const tickNight = (): number => (nightMs += TICK_MILLISECONDS);

    /** The furthest this raccoon strays from its own den over some ticks. */
    const strayFromDen = (sim: WorldSimulation, ticks: number, tick: () => number): number => {
      let furthest = 0;
      for (let i = 0; i < ticks; i++) {
        sim.step(tick());
        const entity = animalEntity(sim, 1, raccoonDen.id);
        furthest = Math.max(furthest, Math.hypot(entity.x - raccoonDen.x, entity.z - raccoonDen.z));
      }
      return furthest;
    };

    it('stays within its leash by day, from a distance that does not notice a player', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, probePosition, 0);

      expect(strayFromDen(sim, 60, tickDay)).toBeLessThanOrEqual(kind.leashRadius + 0.2);
    });

    it('notices the same player from the same distance once it is dark', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, probePosition, 0);

      expect(strayFromDen(sim, 60, tickNight)).toBeGreaterThan(kind.leashRadius + 0.5);
    });

    it('is unbothered by the same dark once the player has a torch lit', () => {
      const sim = createWorld();
      sim.addPlayer(1, {
        netId: 1,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        items: [
          { item: 'bag', count: 1 },
          { item: 'torch', count: 1 },
        ],
        hunger: HUNGER_MAX,
      });
      expect(sim.useItem(1, 'torch')).toBe(true);
      sim.placePlayer(1, probePosition, 0);

      expect(strayFromDen(sim, 60, tickNight)).toBeLessThanOrEqual(kind.leashRadius + 0.2);
    });

    it('is unbothered by the same dark standing next to a lit campfire', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, probePosition, 0);
      sim.restoreBuiltProps([
        {
          id: 9001,
          kind: 'campfire',
          x: probePosition.x,
          z: probePosition.z,
          yaw: 0,
          lit: true,
          ownerKey: null,
          litUntilMs: nightMs + 999_999_999,
        },
      ]);

      expect(strayFromDen(sim, 60, tickNight)).toBeLessThanOrEqual(kind.leashRadius + 0.2);
    });

    it('does not count a campfire that is not actually lit', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, probePosition, 0);
      sim.restoreBuiltProps([
        {
          id: 9002,
          kind: 'campfire',
          x: probePosition.x,
          z: probePosition.z,
          yaw: 0,
          lit: false,
          ownerKey: null,
          litUntilMs: null,
        },
      ]);

      expect(strayFromDen(sim, 60, tickNight)).toBeGreaterThan(kind.leashRadius + 0.5);
    });

    it('is unbothered by the same dark next to a built lantern, which has no lit flag of its own', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      sim.placePlayer(1, probePosition, 0);
      sim.restoreBuiltProps([
        {
          id: 9003,
          kind: 'lantern',
          x: probePosition.x,
          z: probePosition.z,
          yaw: 0,
          lit: false,
          ownerKey: null,
          litUntilMs: null,
        },
      ]);

      expect(strayFromDen(sim, 60, tickNight)).toBeLessThanOrEqual(kind.leashRadius + 0.2);
    });
  });
});

describe('a charged attack', () => {
  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [
      { item: 'bag', count: 1 },
      { item: 'axe', count: 1 },
    ],
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

  /**
   * Hold the button through the wind-up, then release and wait until the strike
   * lands, or until it plainly never will. Returns the next sequence number.
   */
  function chargeUntilItLands(sim: WorldSimulation, netId: number, seq: number): number {
    for (let i = 0; i < CHARGE_TICKS + STRIKE.impact + 20; i++) {
      sim.queueInput(
        netId,
        createInput(seq++, 0, 0, 0, i < CHARGE_TICKS ? PlayerButton.Charge : 0),
      );
      sim.step(tickClock());
      const action = sim.actionOf(netId);
      if (action?.kind === ActionKind.Strike && action.age >= STRIKE.impact) break;
    }
    return seq;
  }

  it('winds up for as long as it says, then lands partway into the strike', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    let seq = 1;
    for (let i = 0; i < CHARGE_TICKS; i++) {
      sim.queueInput(1, createInput(seq++, 0, 0, 0, PlayerButton.Charge));
      sim.step(tickClock());
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.Charge);
    }
    expect(sim.drainChopEvents()).toEqual([]);
    for (let i = 0; i <= STRIKE.impact; i++) {
      expect(sim.drainChopEvents()).toEqual([]);
      sim.queueInput(1, createInput(seq++, 0, 0, 0, 0));
      sim.step(tickClock());
    }
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Strike);
    expect(sim.felledTreeIds()).toContain(tree.id);
  });

  it('slows you to a creep while it winds up, holding a direction the whole time', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const before = sim.readPlayer(1)?.position;
    if (before === undefined) throw new Error('missing player');

    let seq = 1;
    // Half a second, held throughout - walking, this would have carried the
    // player a couple of metres by now.
    const ticks = 10;
    for (let i = 0; i < ticks; i++) {
      sim.queueInput(1, createInput(seq++, 0, 1, 0, PlayerButton.Charge));
      sim.step(tickClock());
    }
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Charge);

    const during = sim.readPlayer(1)?.position;
    if (during === undefined) throw new Error('missing player');
    const crept = Math.hypot(during.x - before.x, during.z - before.z);
    const creepPace = PLAYER_WALK_SPEED * CHARGE_WALK_SHARE * ticks * TICK_SECONDS;
    expect(crept).toBeGreaterThan(creepPace * 0.9);
    expect(crept).toBeLessThanOrEqual(creepPace + 1e-6);
  });

  it('never starts with nothing in hand', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    chargeUntilItLands(sim, 1, 1);

    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Idle);
    expect(sim.felledTreeIds()).toEqual([]);
    expect(sim.drainChopEvents()).toEqual([]);
  });

  it('fells nothing with the rod in hand: only the axe chops a tree', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
        { item: 'rod', count: 1 },
      ],
      hunger: HUNGER_MAX,
      equippedItem: 'rod',
    });
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);

    chargeUntilItLands(sim, 1, 1);

    expect(sim.felledTreeIds()).toEqual([]);
    expect(sim.drainChopEvents()).toEqual([]);
  });

  it('fells a tree outright once it resolves, whatever that tree would otherwise take', () => {
    const sim = createWorld();
    sim.addPlayer(1, withAxe(1));
    const tree = findTree(sim, 'oak');
    standAt(sim, 1, tree);
    const swingsToFell = choppingRuleFor(PROP_KINDS.oak)?.swingsToFell ?? 0;
    expect(swingsToFell).toBeGreaterThan(1);

    chargeUntilItLands(sim, 1, 1);

    expect(sim.felledTreeIds()).toContain(tree.id);
    expect(sim.drainChopEvents()).toEqual([
      { netId: 1, treeId: tree.id, swingsLeft: 0, logsGained: expect.any(Number) },
    ]);
  });

  describe('against a threat', () => {
    const raccoonDen = ANIMAL_DENS.find((entry) => entry.id === 1005);
    if (raccoonDen === undefined) {
      throw new Error('the masked raccoon den is gone from the data table');
    }
    const threat = ANIMAL_KINDS.maskedRaccoon.threat;
    if (threat === undefined) throw new Error('the masked raccoon has lost its threat behaviour');

    const inItsReach = { x: raccoonDen.x, y: 0, z: raccoonDen.z + threat.attackRadius - 0.1 };

    /** Stand in its reach and let its first swing land, which leaves a gap before the next. */
    function takeItsFirstSwing(sim: WorldSimulation): number {
      sim.placePlayer(1, inItsReach, 0);
      let seq = 1;
      while (sim.healthOf(1) === HEALTH_MAX && seq < 60) {
        sim.queueInput(1, createInput(seq++, 0, 0, 0, 0));
        sim.step(tickClock());
      }
      expect(sim.healthOf(1)).toBeLessThan(HEALTH_MAX);
      return seq;
    }

    it('defeats it outright, regardless of hitsToDefeat', () => {
      const sim = createWorld();
      sim.addPlayer(1, withAxe(1));
      expect(threat.hitsToDefeat).toBeGreaterThan(1);

      // Wound up in the gap after its own swing, the whole point of reading one.
      const seq = takeItsFirstSwing(sim);
      chargeUntilItLands(sim, 1, seq);

      expect(sim.drainCatchEvents()).toEqual([{ netId: 1, item: null, added: 0 }]);
    });

    it('is knocked out of its wind-up by a hit landing first', () => {
      const sim = createWorld();
      sim.addPlayer(1, withAxe(1));
      sim.placePlayer(1, { x: raccoonDen.x, y: 0, z: raccoonDen.z + threat.attackRadius - 0.1 }, 0);

      // Winding up right into its own wind-up: it gets there first.
      let seq = 1;
      let interrupted = false;
      for (let i = 0; i < CHARGE_TICKS && !interrupted; i++) {
        sim.queueInput(1, createInput(seq++, 0, 0, 0, PlayerButton.Charge));
        sim.step(tickClock());
        interrupted = sim.actionOf(1)?.kind === ActionKind.Flinch;
      }

      expect(interrupted).toBe(true);
      expect(sim.drainCatchEvents()).toEqual([]);
      expect(sim.healthOf(1)).toBe(HEALTH_MAX - threat.damage);
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
    items: [
      { item: 'bag', count: 1 },
      { item: 'log', count },
    ],
    hunger: HUNGER_MAX,
  });
  const FACE_OUT = 0;
  function giveBuildArea(sim: WorldSimulation, ownerKey = 'builder-1'): void {
    sim.restoreBuiltProps([
      { id: 60000, kind: 'cabin', x: 0, z: 15, yaw: 0, lit: false, ownerKey, litUntilMs: null },
    ]);
  }

  /** Idle ticks, so the shared cooldown from a previous swing or build clears. */
  function waitOutCooldown(sim: WorldSimulation, netId: number, seq: number): number {
    for (let i = 0; i < SWING_COOLDOWN_TICKS; i++) {
      sim.queueInput(netId, createInput(seq++, 0, 0, FACE_OUT, 0));
      sim.step(tickClock());
    }
    return seq;
  }

  /**
   * Ask to build `inFront` of the player, in the direction `yaw` looks
   * (FACE_OUT unless told otherwise), and let one tick settle it.
   */
  function requestAndStep(
    sim: WorldSimulation,
    netId: number,
    kind: BuildableKindId,
    seq: number,
    yaw = FACE_OUT,
  ): void {
    const at = sim.readPlayer(netId)?.position ?? { x: 0, y: 0, z: 0 };
    sim.requestBuild(netId, {
      kind,
      x: at.x - Math.sin(yaw) * inFront(kind),
      z: at.z - Math.cos(yaw) * inFront(kind),
      yaw: 0,
    });
    sim.queueInput(netId, createInput(seq, 0, 0, yaw, 0));
    sim.step(tickClock());
  }

  it('places a campfire in front of you, and spends the logs', () => {
    const sim = createWorld();
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1), 'builder-1');
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);

    const events = sim.drainBuildEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.netId).toBe(1);
    expect(events[0]?.prop.kind).toBe('campfire');
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)).toEqual([events[0]?.prop]);
  });

  it('refuses without enough logs, and spends nothing', () => {
    const sim = createWorld();
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1, 3), 'builder-1');
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);

    expect(sim.drainBuildEvents()).toEqual([]);
    expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(3);
  });

  it('refuses a spot outside the home building area', () => {
    const sim = createWorld();
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1), 'builder-1');
    sim.placePlayer(1, { x: 0, y: 0, z: -(CLEARING_TREE_LINE_INNER - 1) }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);

    expect(sim.drainBuildEvents()).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(4);
  });

  it('builds exactly where it was asked to, turned the way it was asked', () => {
    const sim = createWorld();
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1), 'builder-1');
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    sim.requestBuild(1, { kind: 'campfire', x: 1.5, z: -3, yaw: 0.75 });
    sim.queueInput(1, createInput(1, 0, 0, FACE_OUT, 0));
    sim.step(tickClock());

    expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)).toEqual([
      expect.objectContaining({ kind: 'campfire', x: 1.5, z: -3, yaw: 0.75 }),
    ]);
  });

  it('refuses a spot out of reach, and spends nothing', () => {
    const sim = createWorld();
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1), 'builder-1');
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    const tooFar = BUILD_REACH + BUILD_REACH_SLACK + 0.5;
    sim.requestBuild(1, { kind: 'campfire', x: 0, z: -tooFar, yaw: 0 });
    sim.queueInput(1, createInput(1, 0, 0, FACE_OUT, 0));
    sim.step(tickClock());

    expect(sim.drainBuildEvents()).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(4);
  });

  it('refuses a spot right on top of a tree, whatever the client asked for', () => {
    const sim = createWorld();
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1), 'builder-1');
    const tree = sim.clearing.props.find((prop) => PROP_KINDS[prop.kind].shape.family === 'tree');
    if (tree === undefined) throw new Error('no tree in the clearing');
    sim.placePlayer(1, { x: tree.x, y: 0, z: tree.z + 2 }, FACE_OUT);

    sim.requestBuild(1, { kind: 'campfire', x: tree.x, z: tree.z, yaw: 0 });
    sim.queueInput(1, createInput(1, 0, 0, FACE_OUT, 0));
    sim.step(tickClock());

    expect(sim.drainBuildEvents()).toEqual([]);
  });

  it('will not stack a second campfire on top of the first', () => {
    const sim = createWorld();
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1, 8), 'builder-1');
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

    requestAndStep(sim, 1, 'campfire', 1);
    expect(sim.drainBuildEvents()).toHaveLength(1);

    const seq = waitOutCooldown(sim, 1, 2);
    requestAndStep(sim, 1, 'campfire', seq);

    // Blocked by the campfire already sitting there, so the second attempt
    // never happened and never spent the logs it would have needed.
    expect(sim.drainBuildEvents()).toEqual([]);
    expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)).toHaveLength(1);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(4);
  });

  it('a second request before the cooldown clears does nothing', () => {
    const sim = createWorld();
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1, 12), 'builder-1');
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
    giveBuildArea(sim, 'builder-1');
    sim.addPlayer(1, withLogs(1), 'builder-1');
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
    requestAndStep(sim, 1, 'campfire', 1);
    const built = sim.builtPropsList().filter((prop) => prop.id !== 60000);
    expect(built).toHaveLength(1);

    const restored = createWorld();
    restored.restoreBuiltProps(
      built.map((prop) => ({ ...prop, ownerKey: null, litUntilMs: null })),
    );
    expect(restored.builtPropsList().filter((prop) => prop.id !== 60000)).toEqual(built);

    // A fresh build in the restored world gets its own id, never one already
    // taken by something restored from storage.
    giveBuildArea(restored, 'builder-2');
    restored.addPlayer(2, withLogs(2), 'builder-2');
    restored.placePlayer(2, { x: 15, y: 0, z: 0 }, FACE_OUT);
    requestAndStep(restored, 2, 'campfire', 1);
    const ids = restored
      .builtPropsList()
      .filter((prop) => prop.id !== 60000)
      .map((prop) => prop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe('a home to come back to', () => {
    const withTenLogs = (netId: number): PersistedPlayer => ({
      netId,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'bag', count: 1 },
        { item: 'log', count: 10 },
        { item: 'stick', count: 6 },
      ],
      hunger: HUNGER_MAX,
    });

    it('requires expedition supplies and is marked as a home', () => {
      expect(BUILDABLE_KINDS.cabin.costs).toEqual([
        { item: 'log', amount: 40 },
        { item: 'stick', amount: 24 },
        { item: 'bone', amount: 8 },
      ]);
      expect(BUILDABLE_KINDS.cabin.isHome).toBe(true);
      expect(BUILDABLE_KINDS.campfire.isHome).toBe(false);
    });

    it('refuses a second cabin for somebody who already has one', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'tent', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      // Far enough away that footprint overlap is not what blocks this one -
      // already owning a home is.
      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'tent', seq);
      expect(sim.drainBuildEvents()).toEqual([]);
    });

    it('lets a different player build their own cabin', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'tent', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      sim.addPlayer(2, withTenLogs(2), 'someone-else');
      sim.placePlayer(2, { x: -26, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 2, 'tent', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);
    });

    it('refuses a home without an identity, without spending its materials', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1));
      requestAndStep(sim, 1, 'tent', 1);
      expect(sim.drainBuildEvents()).toHaveLength(0);
      expect(sim.inventoryOf(1).stick).toBe(6);
      expect(sim.drainHomeBuildFeedback()[0]?.reason).toBe('identity');
    });

    it('wakes its owner up inside, by their own bed, next time', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'tent', 1);
      const home = sim.drainBuildEvents()[0]?.prop;
      expect(home).toBeDefined();

      const back = createWorld();
      back.restoreBuiltProps(
        sim
          .builtPropsList()
          .filter((prop) => prop.id !== 60000)
          .map((prop) => ({ ...prop, ownerKey: 'chris', litUntilMs: null })),
      );
      back.addPlayer(9, undefined, 'chris');
      expect(back.spaceOf(9)).toBe(home?.id);
      const position = back.snapshotFor(9).find((entity) => entity.netId === 9);
      expect(position?.x).toBeCloseTo(HOME_WAKE_SPOT.x * 0.8, 5);
      expect(position?.z).toBeCloseTo(HOME_WAKE_SPOT.z * 0.8, 5);
    });

    it('puts the front door on whichever side the cabin was turned to face', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      // A quarter turn: the door, on the model's +Z side, now faces +X.
      sim.requestBuild(1, { kind: 'tent', x: 0, z: -inFront('tent'), yaw: Math.PI / 2 });
      sim.queueInput(1, createInput(1, 0, 0, FACE_OUT, 0));
      sim.step(tickClock());
      const home = sim.drainBuildEvents()[0]?.prop;
      if (home === undefined) throw new Error('the cabin was not built');

      // Walk out of the room: you come out on the side the door now faces.
      const back = createWorld();
      back.restoreBuiltProps(
        sim
          .builtPropsList()
          .filter((prop) => prop.id !== 60000)
          .map((prop) => ({ ...prop, ownerKey: 'chris', litUntilMs: null })),
      );
      back.addPlayer(9, undefined, 'chris');
      back.placePlayer(9, { x: HOME_ENTRY.x, y: 0, z: HOME_ENTRY.z }, 0, home.id);
      for (let seq = 1; seq <= 20 && back.spaceOf(9) !== OUTDOORS; seq++) {
        // Backwards, towards the door, with the camera looking into the room.
        back.queueInput(9, createInput(seq, 0, -1, 0));
        back.step(tickClock());
      }
      expect(back.spaceOf(9)).toBe(OUTDOORS);
      const position = back.snapshotFor(9).find((entity) => entity.netId === 9);
      if (position === undefined) throw new Error('no snapshot for the player who left');
      expect(position.x - home.x).toBeGreaterThan(2);
      expect(Math.abs(position.z - home.z)).toBeLessThan(1);
    });

    describe('going inside', () => {
      /** A cabin built for `chris`, restored into a fresh world with its door facing +Z. */
      function worldWithCabin(locked = false): { sim: WorldSimulation; home: BuiltProp } {
        const sim = createWorld();
        const home: BuiltProp = { id: 7, kind: 'cabin', x: 0, z: -20, yaw: 0, lit: false, locked };
        sim.restoreBuiltProps([{ ...home, ownerKey: 'chris', litUntilMs: null }]);
        return { sim, home };
      }

      /** Stand in front of the door and walk at it for a second. */
      function walkIntoTheDoor(sim: WorldSimulation, netId: number, home: BuiltProp): void {
        const doorway = cabinDoorway(home);
        sim.placePlayer(netId, { x: doorway.x, y: 0, z: doorway.z + 1.2 }, 0);
        for (let seq = 1; seq <= 20; seq++) {
          sim.queueInput(netId, createInput(seq, 0, 1, 0));
          sim.step(tickClock());
          if (sim.spaceOf(netId) !== OUTDOORS) return;
        }
      }

      it('takes you in when you walk into the door, and back out again', () => {
        const { sim, home } = worldWithCabin();
        sim.addPlayer(1, undefined, 'chris');
        sim.drainSpaceChanges();

        walkIntoTheDoor(sim, 1, home);
        expect(sim.spaceOf(1)).toBe(home.id);
        const arrived = sim.drainSpaceChanges().at(-1);
        expect(arrived).toMatchObject({ netId: 1, space: home.id });
        expect(arrived?.x).toBeCloseTo(HOME_ENTRY.x, 5);
        expect(arrived?.z).toBeCloseTo(HOME_ENTRY.z, 5);

        // Wait out the door's breather, then walk back out.
        for (let i = 0; i < 20; i++) sim.step(tickClock());
        for (let seq = 30; seq <= 60 && sim.spaceOf(1) !== OUTDOORS; seq++) {
          sim.queueInput(1, createInput(seq, 0, -1, 0));
          sim.step(tickClock());
        }
        expect(sim.spaceOf(1)).toBe(OUTDOORS);
        const left = sim.drainSpaceChanges().at(-1);
        const doorstep = cabinDoorstep(home);
        expect(left?.x).toBeCloseTo(doorstep.x, 1);
        expect(left?.z).toBeCloseTo(doorstep.z, 1);
      });

      it('lets a visitor in through an open door, but not a locked one', () => {
        const open = worldWithCabin(false);
        open.sim.addPlayer(2, undefined, 'visitor');
        walkIntoTheDoor(open.sim, 2, open.home);
        expect(open.sim.spaceOf(2)).toBe(open.home.id);

        const locked = worldWithCabin(true);
        locked.sim.addPlayer(2, undefined, 'visitor');
        walkIntoTheDoor(locked.sim, 2, locked.home);
        expect(locked.sim.spaceOf(2)).toBe(OUTDOORS);

        // Its owner always gets in.
        locked.sim.addPlayer(1, undefined, 'chris');
        walkIntoTheDoor(locked.sim, 1, locked.home);
        expect(locked.sim.spaceOf(1)).toBe(locked.home.id);
      });

      it('only ever locks your own door', () => {
        const { sim, home } = worldWithCabin();
        sim.addPlayer(1, undefined, 'chris');
        sim.addPlayer(2, undefined, 'visitor');
        expect(sim.setHomeLocked(2, true)).toBeNull();
        expect(sim.setHomeLocked(1, true)?.id).toBe(home.id);
        expect(
          sim
            .builtPropsList()
            .filter((prop) => prop.id !== 60000)
            .find((prop) => prop.id === home.id)?.locked,
        ).toBe(true);
        // Already locked: nothing changed, nothing to say.
        expect(sim.setHomeLocked(1, true)).toBeNull();
        expect(sim.setHomeLocked(1, false)?.locked).toBe(false);
      });

      it('shows you only whoever is in the same place as you', () => {
        const { sim, home } = worldWithCabin();
        sim.addPlayer(1, undefined, 'chris');
        sim.addPlayer(2, undefined, 'visitor');
        sim.placePlayer(2, { x: 0, y: 0, z: -12 }, 0);
        expect(sim.spaceOf(1)).toBe(home.id);
        expect(sim.snapshotFor(1).some((entity) => entity.netId === 2)).toBe(false);
        expect(sim.snapshotFor(2).some((entity) => entity.netId === 1)).toBe(false);
        // No wildlife in the house.
        expect(
          sim.snapshotFor(1).every((entity) => (entity.flags & SnapshotFlag.Animal) === 0),
        ).toBe(true);

        walkIntoTheDoor(sim, 2, home);
        expect(sim.snapshotFor(1).some((entity) => entity.netId === 2)).toBe(true);
      });

      it("keeps a player inside at their home's front door when they are saved", () => {
        const { sim, home } = worldWithCabin();
        sim.addPlayer(1, undefined, 'chris');
        expect(sim.spaceOf(1)).toBe(home.id);
        const saved = sim.persistablePlayers()[0];
        const doorstep = cabinDoorstep(home);
        expect(saved?.x).toBeCloseTo(doorstep.x, 5);
        expect(saved?.z).toBeCloseTo(doorstep.z, 5);
      });

      it('makes the cabin solid, so you cannot walk through its walls', () => {
        const { sim, home } = worldWithCabin();
        sim.addPlayer(2, undefined, 'visitor');
        // Behind the cabin, walking straight at its back wall.
        sim.placePlayer(2, { x: home.x, y: 0, z: home.z - 5 }, Math.PI);
        for (let seq = 1; seq <= 60; seq++) {
          sim.queueInput(2, createInput(seq, 0, 1, Math.PI));
          sim.step(tickClock());
        }
        const position = sim.readPlayer(2)?.position;
        expect(position?.z).toBeLessThan(home.z - 2);
        expect(sim.spaceOf(2)).toBe(OUTDOORS);
      });

      it('leaves nothing out in the world within reach from inside', () => {
        const { sim, home } = worldWithCabin();
        sim.addPlayer(1, withTenLogs(1), 'chris');
        expect(sim.spaceOf(1)).toBe(home.id);
        sim.requestBuild(1, { kind: 'campfire', x: 0, z: -2, yaw: 0 });
        sim.queueInput(1, createInput(1, 0, 0, 0, 0));
        sim.step(tickClock());
        expect(sim.drainBuildEvents()).toEqual([]);
      });
    });

    it('somebody with no cabin yet still spawns exactly as before', () => {
      const sim = createWorld();
      sim.addPlayer(1, withTenLogs(1), 'chris');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'tent', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      const fresh = createWorld();
      fresh.restoreBuiltProps(
        sim
          .builtPropsList()
          .filter((prop) => prop.id !== 60000)
          .map((prop) => ({ ...prop, ownerKey: 'chris', litUntilMs: null })),
      );
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
      items: [
        { item: 'bag', count: 1 },
        { item: 'flower', count },
      ],
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
      giveBuildArea(sim, 'chris');
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
      giveBuildArea(sim, 'chris');
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
            { item: 'bag', count: 1 },
            { item: 'log', count: 10 },
            { item: 'stick', count: 6 },
            { item: 'flower', count: 6 },
          ],
          hunger: HUNGER_MAX,
        },
        'chris',
      );
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'tent', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', seq);
      expect(sim.drainBuildEvents()).toHaveLength(1);
    });

    it('refuses building without an established private home, without spending', () => {
      const sim = createWorld();
      sim.addPlayer(1, withFlowers(1));
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', 1);
      expect(sim.drainBuildEvents()).toHaveLength(0);

      addItem(sim.inventoryOf(1), 'flower', 6);
      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'flowerBed', seq);
      expect(sim.drainBuildEvents()).toHaveLength(0);
    });
  });

  describe('fences and garden paths', () => {
    const withSticks = (netId: number, count = 2): PersistedPlayer => ({
      netId,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'bag', count: 1 },
        { item: 'stick', count },
      ],
      hunger: HUNGER_MAX,
    });

    it('a fence costs logs, a garden path costs sticks, and neither is capped or a home', () => {
      expect(BUILDABLE_KINDS.fence.costs).toEqual([{ item: 'log', amount: 2 }]);
      expect(BUILDABLE_KINDS.fence.capPerPlayer).toBe(false);
      expect(BUILDABLE_KINDS.fence.isHome).toBe(false);
      expect(BUILDABLE_KINDS.gardenPath.costs).toEqual([{ item: 'stick', amount: 2 }]);
      expect(BUILDABLE_KINDS.gardenPath.capPerPlayer).toBe(false);
      expect(BUILDABLE_KINDS.gardenPath.isHome).toBe(false);
    });

    it('lets the same player line up as many fence segments as they can afford', () => {
      const sim = createWorld();
      giveBuildArea(sim, 'builder-1');
      sim.addPlayer(1, withLogs(1, 6), 'builder-1');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'fence', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      // A second fence, a different spot so its own footprint is not what
      // would refuse this - proving the per-kind cap (personal decorations,
      // above) simply does not apply here, not that there was nowhere to put it.
      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'fence', seq);
      expect(sim.drainBuildEvents()).toHaveLength(1);
      expect(countOf(sim.inventoryOf(1), 'log')).toBe(2);
    });

    it('joins fence pieces end to end into one line', () => {
      const sim = createWorld();
      giveBuildArea(sim, 'builder-1');
      sim.addPlayer(1, withLogs(1, 6), 'builder-1');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      const length = BUILDABLE_KINDS.fence.footprintHalfLength * 2;

      let seq = 1;
      for (let piece = 0; piece < 3; piece++) {
        sim.requestBuild(1, { kind: 'fence', x: (piece - 1) * length, z: -3, yaw: 0 });
        sim.queueInput(1, createInput(seq++, 0, 0, FACE_OUT, 0));
        sim.step(tickClock());
        seq = waitOutCooldown(sim, 1, seq);
      }

      expect(
        sim
          .builtPropsList()
          .filter((prop) => prop.id !== 60000)
          .filter((prop) => prop.kind === 'fence'),
      ).toHaveLength(3);
      expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    });

    it('lets the same player lay down more than one garden path stone', () => {
      const sim = createWorld();
      giveBuildArea(sim, 'builder-1');
      sim.addPlayer(1, withSticks(1, 4), 'builder-1');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'gardenPath', 1);
      expect(sim.drainBuildEvents()).toHaveLength(1);

      const seq = waitOutCooldown(sim, 1, 2);
      sim.placePlayer(1, { x: -10, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'gardenPath', seq);
      expect(sim.drainBuildEvents()).toHaveLength(1);
      expect(countOf(sim.inventoryOf(1), 'stick')).toBe(0);
    });

    it('refuses a garden path stone without enough sticks, and spends nothing', () => {
      const sim = createWorld();
      giveBuildArea(sim, 'builder-1');
      sim.addPlayer(1, withSticks(1, 1), 'builder-1');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);

      requestAndStep(sim, 1, 'gardenPath', 1);

      expect(sim.drainBuildEvents()).toEqual([]);
      expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
    });
  });

  describe('lighting a campfire', () => {
    /** Build one, then stand right on top of it - well within interact reach. */
    function buildAndStandNextToIt(
      sim: WorldSimulation,
      netId: number,
      hunger = HUNGER_MAX,
    ): BuiltProp {
      giveBuildArea(sim, `builder-${netId}`);
      sim.addPlayer(netId, { ...withLogs(netId), hunger }, `builder-${netId}`);
      sim.placePlayer(netId, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, netId, 'campfire', 1);
      const built = sim.drainBuildEvents()[0]?.prop;
      if (built === undefined) throw new Error('test setup failed to build a campfire');
      sim.placePlayer(netId, { x: built.x, y: 0, z: built.z }, FACE_OUT);
      return built;
    }

    it('lights an unlit campfire in reach, at no cost', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1);
      expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);

      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());

      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(true);
      // Atmosphere only, per the design: nothing was spent to light it.
      expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    });

    it('puts a lit campfire back out on a second, separate press', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1);

      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());
      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(true);

      // Released, then pressed again - a fresh edge, not the same held button.
      sim.queueInput(1, createInput(3, 0, 0, FACE_OUT, 0));
      sim.step(tickClock());
      sim.queueInput(1, createInput(4, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());

      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(false);
    });

    it('lets a hungry player equip raw food beside a lit fire instead of eating it immediately', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1, 0);

      // Light the fire before there is food in hand.
      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());
      sim.queueInput(1, createInput(3, 0, 0, FACE_OUT, 0));
      sim.step(tickClock());

      addItem(sim.inventoryOf(1), 'perch');
      expect(sim.useItem(1, 'perch')).toBe(true);
      expect(countOf(sim.inventoryOf(1), 'perch')).toBe(1);
      expect(sim.equippedItemOf(1)).toBe('perch');

      sim.queueInput(1, createInput(4, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());
      expect(countOf(sim.inventoryOf(1), 'perch')).toBe(0);
      expect(countOf(sim.inventoryOf(1), 'roastedPerch')).toBe(1);
    });

    it('cooks one held raw food over a lit campfire without putting the fire out', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1);

      // Light first, then choose the food: selecting food away from a lit fire
      // deliberately keeps the old "select food = eat it" behaviour.
      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());
      sim.queueInput(1, createInput(3, 0, 0, FACE_OUT, 0));
      sim.step(tickClock());

      addItem(sim.inventoryOf(1), 'trout');
      expect(sim.useItem(1, 'trout')).toBe(true);
      sim.queueInput(1, createInput(4, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());

      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(true);
      expect(countOf(sim.inventoryOf(1), 'trout')).toBe(0);
      expect(countOf(sim.inventoryOf(1), 'roastedTrout')).toBe(1);
      expect(sim.drainCookingEvents()).toEqual([
        { netId: 1, raw: 'trout', cooked: 'roastedTrout' },
      ]);
      expect(sim.equippedItemOf(1)).toBeNull();
    });

    it('cooks only what is actually held, not raw food elsewhere in the pack', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1);
      addItem(sim.inventoryOf(1), 'perch');
      addItem(sim.inventoryOf(1), 'axe');
      expect(sim.useItem(1, 'axe')).toBe(true);

      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());
      sim.queueInput(1, createInput(3, 0, 0, FACE_OUT, 0));
      sim.step(tickClock());
      sim.queueInput(1, createInput(4, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());

      // With the axe held, the second press keeps the old campfire behaviour.
      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(false);
      expect(countOf(sim.inventoryOf(1), 'perch')).toBe(1);
      expect(countOf(sim.inventoryOf(1), 'roastedPerch')).toBe(0);
      expect(sim.drainCookingEvents()).toEqual([]);
    });

    it('does not extinguish a lit fire when held raw food cannot fit once cooked', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1);

      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());
      sim.queueInput(1, createInput(3, 0, 0, FACE_OUT, 0));
      sim.step(tickClock());

      const pack = sim.inventoryOf(1);
      addItem(pack, 'perch', 2);
      addItem(pack, 'log', 10);
      addItem(pack, 'stick', 10);
      addItem(pack, 'flower', 10);
      addItem(pack, 'trout', 10);
      addItem(pack, 'meat', 10);
      addItem(pack, 'goldenCarp', 10);
      addItem(pack, 'bone', 10);
      addItem(pack, 'roastedTrout', 10);
      addItem(pack, 'roastedGoldenCarp', 10);
      expect(roomFor(pack, 'roastedPerch')).toBe(0);
      expect(sim.useItem(1, 'perch')).toBe(true);

      sim.queueInput(1, createInput(4, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());

      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(true);
      expect(countOf(pack, 'perch')).toBe(2);
      expect(countOf(pack, 'roastedPerch')).toBe(0);
      expect(sim.drainCookingEvents()).toEqual([]);
    });

    it('holding the button down toggles it once, not every tick it stays held', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1);

      for (let seq = 2; seq < 12; seq++) {
        sim.queueInput(1, createInput(seq, 0, 0, FACE_OUT, PlayerButton.Interact));
        sim.step(tickClock());
      }

      // If holding it flickered the state on every tick, ten ticks (an even
      // count) would land back on unlit rather than staying lit.
      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(true);
    });

    it('does nothing to a campfire out of reach', () => {
      const sim = createWorld();
      giveBuildArea(sim, 'builder-1');
      sim.addPlayer(1, withLogs(1), 'builder-1');
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, FACE_OUT);
      requestAndStep(sim, 1, 'campfire', 1);
      // Still exactly where building leaves you: past PICKUP_REACH from the
      // campfire itself, which these tests put `inFront` of the player.

      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());

      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(false);
    });

    it('burns out on its own after CAMPFIRE_BURN_SECONDS', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1);
      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());
      const propId = sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]!.id;
      const litUntilMs = sim.campfireLitUntilMsFor(propId);
      expect(litUntilMs).not.toBeNull();
      if (litUntilMs === null) return;

      // Draining the toggle event itself first, the way a real tick would
      // right after it happens - what is left to check below is only the
      // auto-extinguish, on an otherwise-empty event queue.
      expect(sim.extinguishBurnedOutCampfires(tickClock())).toEqual([{ propId, lit: true }]);

      expect(sim.extinguishBurnedOutCampfires(litUntilMs - 1)).toEqual([]);
      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(true);

      expect(sim.extinguishBurnedOutCampfires(litUntilMs)).toEqual([{ propId, lit: false }]);
      expect(sim.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(false);
      expect(sim.campfireLitUntilMsFor(propId)).toBeNull();
    });

    it('restores a lit campfire from storage, and catches up if it should already be out', () => {
      const sim = createWorld();
      buildAndStandNextToIt(sim, 1);
      sim.queueInput(1, createInput(2, 0, 0, FACE_OUT, PlayerButton.Interact));
      sim.step(tickClock());
      const built = sim.builtPropsList().filter((prop) => prop.id !== 60000)[0];
      const litUntilMs = built === undefined ? null : sim.campfireLitUntilMsFor(built.id);
      expect(built).toBeDefined();
      expect(litUntilMs).not.toBeNull();
      if (built === undefined || litUntilMs === null) return;

      const restored = createWorld();
      restored.restoreBuiltProps([{ ...built, ownerKey: null, litUntilMs }]);
      expect(restored.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(true);

      // Woken long after it should have burned out - the same real-time
      // catch-up regrowth gets when a world wakes from storage.
      expect(restored.extinguishBurnedOutCampfires(litUntilMs + 1)).toEqual([
        { propId: built.id, lit: false },
      ]);
      expect(restored.builtPropsList().filter((prop) => prop.id !== 60000)[0]?.lit).toBe(false);
    });
  });
});

describe('moves in the world', () => {
  /** A cabin built for `chris`, restored into a fresh world: chris starts inside it, by the bed. */
  function worldWithChrisAtHome(): { sim: WorldSimulation; home: BuiltProp } {
    const sim = createWorld();
    const home: BuiltProp = { id: 7, kind: 'cabin', x: 0, z: -20, yaw: 0, lit: false };
    sim.restoreBuiltProps([{ ...home, ownerKey: 'chris', litUntilMs: null }]);
    sim.addPlayer(1, undefined, 'chris');
    return { sim, home };
  }

  function press(sim: WorldSimulation, netId: number, seq: number, buttons: number): number {
    sim.queueInput(netId, createInput(seq++, 0, 0, 0, buttons));
    sim.step(tickClock());
    sim.queueInput(netId, createInput(seq++, 0, 0, 0, 0));
    sim.step(tickClock());
    return seq;
  }

  it('lies you down in bed when you press interact beside it, and gets you up when you move', () => {
    const { sim } = worldWithChrisAtHome();
    let seq = press(sim, 1, 1, PlayerButton.Interact);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Lie);
    const lying = sim.readPlayer(1);
    expect(lying?.position.x).toBeCloseTo(HOME_BED.stand.x, 5);
    expect(lying?.position.z).toBeCloseTo(HOME_BED.stand.z, 5);
    expect(lying?.facingYaw).toBeCloseTo(HOME_BED.stand.yaw, 5);

    // Walking gets you up, and only once you are up do you go anywhere.
    for (let i = 0; i < 4; i++) {
      sim.queueInput(1, createInput(seq++, 0, 1, 0));
      sim.step(tickClock());
    }
    expect(sim.actionOf(1)).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Bed });
    expect(sim.readPlayer(1)?.position.x).toBeCloseTo(HOME_BED.stand.x, 5);
    for (let i = 0; i < RISE.bed; i++) {
      sim.queueInput(1, createInput(seq++, 0, 1, 0));
      sim.step(tickClock());
    }
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Idle);
  });

  it('sits you in the chair when you press interact beside it', () => {
    const { sim } = worldWithChrisAtHome();
    sim.placePlayer(1, { x: HOME_CHAIR.stand.x, y: 0, z: HOME_CHAIR.stand.z + 0.3 }, 0, 7);
    press(sim, 1, 1, PlayerButton.Interact);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Sit);
    expect(sim.readPlayer(1)?.position.z).toBeCloseTo(HOME_CHAIR.stand.z, 5);
  });

  it('eats the food in hand beside the chair while hungry, and sits down once full', () => {
    const sim = createWorld();
    const home: BuiltProp = { id: 7, kind: 'cabin', x: 0, z: -20, yaw: 0, lit: false };
    sim.restoreBuiltProps([{ ...home, ownerKey: 'chris', litUntilMs: null }]);
    sim.addPlayer(
      1,
      {
        netId: 1,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        items: [
          { item: 'bag', count: 1 },
          { item: 'perch', count: 1 },
        ],
        hunger: HUNGER_MAX - 1,
        equippedItem: 'perch',
      },
      'chris',
    );
    sim.placePlayer(1, { x: HOME_CHAIR.stand.x, y: 0, z: HOME_CHAIR.stand.z + 0.3 }, 0, 7);
    const seq = press(sim, 1, 1, PlayerButton.Interact);
    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(0);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Idle);

    press(sim, 1, seq, PlayerButton.Interact);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Sit);
  });

  describe('sitting on the ground', () => {
    it('sits you down on the spot, outdoors, and gets you up again with the same button', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      const before = sim.readPlayer(1);
      let seq = press(sim, 1, 1, PlayerButton.Sit);
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.SitGround);
      // Right where they were standing, and the snapshot says so to everybody.
      expect(sim.readPlayer(1)?.position.x).toBeCloseTo(before?.position.x ?? NaN, 5);
      expect(sim.readPlayer(1)?.position.z).toBeCloseTo(before?.position.z ?? NaN, 5);
      expect(unpackActionByte(sim.snapshotFor(1)[0]?.action ?? 0, createActionState()).kind).toBe(
        ActionKind.SitGround,
      );

      // Pushing about does not move a sitter.
      for (let i = 0; i < SETTLE.earliestUp; i++) {
        sim.queueInput(1, createInput(seq++, 0, 0, 0, 0));
        sim.step(tickClock());
      }
      seq = press(sim, 1, seq, PlayerButton.Sit);
      expect(sim.actionOf(1)).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Sat });
      for (let i = 0; i < RISE.floor; i++) {
        sim.queueInput(1, createInput(seq++, 0, 0, 0, 0));
        sim.step(tickClock());
      }
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.Idle);
    });

    it('walks off when you move', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      const seq = press(sim, 1, 1, PlayerButton.Sit);
      drive(sim, 1, 0, 1, SETTLE.earliestUp + RISE.floor + 10, seq);
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.Idle);
    });

    it('does not sit you down in mid-air', () => {
      const sim = createWorld();
      sim.addPlayer(1);
      const seq = drive(sim, 1, 0, 0, 1, 1, PlayerButton.Jump);
      expect(sim.readPlayer(1)?.grounded).toBe(false);
      drive(sim, 1, 0, 0, 1, seq, PlayerButton.Sit);
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.Idle);
    });

    it('sits you down indoors, too, anywhere on the floor', () => {
      const { sim } = worldWithChrisAtHome();
      sim.placePlayer(1, { x: 0.5, y: 0, z: 0.5 }, 0, 7);
      press(sim, 1, 1, PlayerButton.Sit);
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.SitGround);
    });

    it('does not take your place at the chair, or keep anybody else out of it', () => {
      const { sim } = worldWithChrisAtHome();
      sim.addPlayer(2, undefined, 'visitor');
      sim.placePlayer(1, { x: 0.5, y: 0, z: 0.5 }, 0, 7);
      sim.placePlayer(2, { x: HOME_CHAIR.stand.x, y: 0, z: HOME_CHAIR.stand.z + 0.3 }, 0, 7);
      press(sim, 1, 1, PlayerButton.Sit);
      press(sim, 2, 1, PlayerButton.Interact);
      expect(sim.actionOf(1)?.kind).toBe(ActionKind.SitGround);
      expect(sim.actionOf(2)?.kind).toBe(ActionKind.Sit);
    });
  });

  it('keeps a chair for whoever sat in it first', () => {
    const { sim } = worldWithChrisAtHome();
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(1, { x: HOME_CHAIR.stand.x, y: 0, z: HOME_CHAIR.stand.z }, 0, 7);
    sim.placePlayer(2, { x: HOME_CHAIR.stand.x + 0.4, y: 0, z: HOME_CHAIR.stand.z + 0.3 }, 0, 7);
    press(sim, 1, 1, PlayerButton.Interact);
    press(sim, 2, 1, PlayerButton.Interact);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Sit);
    expect(sim.actionOf(2)?.kind).toBe(ActionKind.Idle);
  });

  it('never swings indoors, whatever is in hand', () => {
    const sim = createWorld();
    const home: BuiltProp = { id: 7, kind: 'cabin', x: 0, z: -20, yaw: 0, lit: false };
    sim.restoreBuiltProps([{ ...home, ownerKey: 'chris', litUntilMs: null }]);
    sim.addPlayer(
      1,
      {
        netId: 1,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        items: [
          { item: 'bag', count: 1 },
          { item: 'axe', count: 1 },
        ],
        hunger: HUNGER_MAX,
      },
      'chris',
    );
    press(sim, 1, 1, PlayerButton.Swing);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Idle);
  });

  it('swings anything in hand, and needs something in hand to swing at all', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    press(sim, 1, 1, PlayerButton.Swing);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Idle);

    sim.addPlayer(2, {
      netId: 2,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'bag', count: 1 },
        { item: 'perch', count: 1 },
      ],
      hunger: HUNGER_MAX,
      equippedItem: 'perch',
    });
    press(sim, 2, 1, PlayerButton.Swing);
    expect(sim.actionOf(2)).toMatchObject({ kind: ActionKind.Swing, step: 1 });
  });

  it("puts everybody's move in the snapshot, for every browser to play", () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
      ],
      hunger: HUNGER_MAX,
    });
    sim.addPlayer(2);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Swing));
    sim.step(tickClock());
    const seen = sim.snapshotFor(2).find((entity) => entity.netId === 1);
    expect(seen?.action).toBe(ActionKind.Swing | (1 << 5));
    expect(seen?.actionAge).toBe(0);
  });

  it('tells everybody when somebody picks something up', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: BAG_SPOT.x, y: 0, z: BAG_SPOT.z }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
    expect(sim.drainGestureEvents()).toEqual([{ netId: 1, gesture: Gesture.PickUp, item: 'bag' }]);
  });
});

describe('targeted right-click looting', () => {
  const OPEN_GROUND = { x: 8, z: 8 };
  it('takes the clicked pile even when another pile is closer', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: OPEN_GROUND.x, y: 0, z: OPEN_GROUND.z }, 0);
    sim.restoreDroppedPiles(
      [
        {
          id: 10,
          item: 'stick',
          count: 1,
          x: OPEN_GROUND.x,
          z: OPEN_GROUND.z,
          droppedAtMs: clockMs,
        },
        {
          id: 11,
          item: 'log',
          count: 3,
          x: OPEN_GROUND.x + 1,
          z: OPEN_GROUND.z,
          droppedAtMs: clockMs,
        },
      ],
      clockMs,
    );
    sim.requestLoot(1, { kind: 'pile', id: 11 });
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(3);
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(0);
    expect(sim.droppedPilesList().map((pile) => pile.id)).toEqual([10]);
  });
  it('never falls back to nearby loot for an unknown or distant target', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: AXE_STUMP.x, y: 0, z: AXE_STUMP.z }, 0);
    sim.requestLoot(1, { kind: 'pickup', id: 65535 });
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(0);
    sim.placePlayer(1, { x: OPEN_GROUND.x, y: 0, z: OPEN_GROUND.z }, 0);
    sim.requestLoot(1, { kind: 'pickup', id: AXE_PICKUP_ID });
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(0);
  });
  it('collects a world pickup only once across competing players', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.addPlayer(2);
    for (const id of [1, 2]) {
      sim.placePlayer(id, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
      sim.requestLoot(id, { kind: 'pickup', id: AXE_PICKUP_ID });
    }
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'axe') + countOf(sim.inventoryOf(2), 'axe')).toBe(1);
    expect(sim.drainPickupEvents()).toHaveLength(1);
  });
  it('gathers exactly one from a clicked patch and respects gathering cooldown', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    const patch = sim.gatherPatchesList().find((entry) => entry.item === 'stick')!;
    sim.placePlayer(1, { x: patch.x, y: 0, z: patch.z }, 0);
    sim.requestLoot(1, { kind: 'patch', id: patch.id });
    sim.step(tickClock());
    sim.requestLoot(1, { kind: 'patch', id: patch.id });
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'stick')).toBe(1);
    expect(sim.gatherPatchesList().find((entry) => entry.id === patch.id)?.remaining).toBe(
      patch.remaining - 1,
    );
  });
  it('reports a full pack without eating equipped food or collecting nearby loot', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      netId: 1,
      x: OPEN_GROUND.x,
      y: 0,
      z: OPEN_GROUND.z,
      facingYaw: 0,
      hunger: 30,
      equippedItem: 'perch',
      items: [
        { item: 'log', count: 50 },
        { item: 'perch', count: 10 },
      ],
    });
    sim.restoreDroppedPiles(
      [{ id: 10, item: 'log', count: 1, x: OPEN_GROUND.x, z: OPEN_GROUND.z, droppedAtMs: clockMs }],
      clockMs,
    );
    sim.requestLoot(1, { kind: 'pile', id: 10 });
    sim.step(tickClock());
    expect(sim.drainPickupRefusals()).toEqual([{ netId: 1, item: 'log', reason: 'full' }]);
    expect(countOf(sim.inventoryOf(1), 'perch')).toBe(10);
    expect(sim.droppedPilesList()).toHaveLength(1);
  });
  it('forgets queued loot when control is handed to a new connection', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    sim.requestLoot(1, { kind: 'pickup', id: AXE_PICKUP_ID });
    sim.handOver(1);
    sim.step(tickClock());
    expect(countOf(sim.inventoryOf(1), 'axe')).toBe(0);
  });
});
