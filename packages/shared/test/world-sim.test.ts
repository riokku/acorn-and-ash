import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_WORLD_SEED,
  INTEREST_RADIUS,
  MAX_QUEUED_INPUTS_PER_PLAYER,
  PLAYER_RADIUS,
  SWING_COOLDOWN_TICKS,
  TICK_HZ,
} from '../src/constants';
import { COLLISION_SKIN_WIDTH } from '../src/collision/capsule';
import { PROP_KINDS, choppingRuleFor } from '../src/data/props';
import { countOf } from '../src/sim/inventory';
import { PlayerButton, createInput } from '../src/sim/player';
import { AXE_PICKUP_ID, AXE_STUMP } from '../src/world/clearing';
import {
  inputsToConsume,
  WorldSimulation,
  SnapshotFlag,
  type PersistedPlayer,
} from '../src/sim/world-sim';

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

describe('picking the axe up', () => {
  /** Put a player next to the stump and hold the interact button for one tick. */
  function reachForTheAxe(sim: WorldSimulation, netId: number, seq = 1): void {
    sim.placePlayer(netId, { x: AXE_STUMP.x + 1, y: 0, z: AXE_STUMP.z }, 0);
    sim.queueInput(netId, createInput(seq, 0, 0, 0, PlayerButton.Interact));
    sim.step();
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
    sim.step();

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
      sim.step();
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

describe('chopping a tree down', () => {
  const withAxe = (netId: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [{ item: 'axe', count: 1 }],
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
      sim.step();
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
      sim.step();
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
    sim.step();

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
      sim.step();
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
      sim.step();
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
      sim.step();
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
    sim.step();
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
    sim.step();
    expect(sim.drainChopEvents()).toHaveLength(1);
    expect(sim.drainChopEvents()).toEqual([]);
  });
});
