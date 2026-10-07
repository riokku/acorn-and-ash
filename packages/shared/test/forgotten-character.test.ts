import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_WORLD_SEED, HUNGER_MAX, TICK_MILLISECONDS } from '../src/constants';
import { nearestCampfire } from '../src/sim/building';
import { countOf } from '../src/sim/inventory';
import { createInput, PlayerButton } from '../src/sim/player';
import {
  ABANDONED_OWNER,
  OUTDOORS,
  WorldSimulation,
  type BuiltProp,
  type PersistedPile,
} from '../src/sim/world-sim';
import { cabinDoorstep, cabinDoorway } from '../src/world/home';
import { LAKE } from '../src/world/lake';
import { REED_PATCHES } from '../src/world/reeds';

const worlds: WorldSimulation[] = [];
let clockMs = 1_700_000_000_000;
const tickClock = (): number => (clockMs += TICK_MILLISECONDS);

afterEach(() => {
  for (const sim of worlds.splice(0)) sim.dispose();
});

const THIRTY_MINUTES = 30 * 60 * 1000;

const CABIN_ID = 7;
const CAMPFIRE_ID = 8;
const FENCE_ID = 9;
const VISITORS_CAMPFIRE_ID = 10;

function createWorld(): WorldSimulation {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  worlds.push(sim);
  return sim;
}

/** Chris's cabin, campfire and fence, and a campfire that belongs to somebody else. */
function worldWithBuilds(): WorldSimulation {
  const sim = createWorld();
  const own = { ownerKey: 'chris', litUntilMs: null };
  sim.restoreBuiltProps([
    { id: CABIN_ID, kind: 'cabin', x: 0, z: -20, yaw: 0, lit: false, ...own },
    { id: CAMPFIRE_ID, kind: 'campfire', x: 12, z: 12, yaw: 0, lit: false, ...own },
    { id: FENCE_ID, kind: 'fence', x: 16, z: 12, yaw: 0, lit: false, ...own },
    {
      id: VISITORS_CAMPFIRE_ID,
      kind: 'campfire',
      x: -12,
      z: 12,
      yaw: 0,
      lit: false,
      ownerKey: 'visitor',
      litUntilMs: null,
    },
  ]);
  return sim;
}

const builtIn = (sim: WorldSimulation, id: number): BuiltProp | undefined =>
  sim.builtPropsList().find((prop) => prop.id === id);

describe('deleting a character', () => {
  it('leaves everything they built standing, locked, and owned by nobody', () => {
    const sim = worldWithBuilds();
    const now = clockMs;

    const { abandoned } = sim.forgetCharacter('chris', now, THIRTY_MINUTES);

    expect(abandoned.map((entry) => entry.prop.id).sort((a, b) => a - b)).toEqual([
      CABIN_ID,
      CAMPFIRE_ID,
      FENCE_ID,
    ]);
    for (const id of [CABIN_ID, CAMPFIRE_ID, FENCE_ID]) {
      expect(builtIn(sim, id)?.locked).toBe(true);
      expect(sim.builtPropOwner(id)).toBe(ABANDONED_OWNER);
      expect(sim.abandonedUntilMsFor(id)).toBe(now + THIRTY_MINUTES);
    }
  });

  it('does not touch what somebody else built', () => {
    const sim = worldWithBuilds();
    sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);

    expect(builtIn(sim, VISITORS_CAMPFIRE_ID)?.locked).toBeUndefined();
    expect(sim.builtPropOwner(VISITORS_CAMPFIRE_ID)).toBe('visitor');
    expect(sim.abandonedUntilMsFor(VISITORS_CAMPFIRE_ID)).toBeNull();
  });

  it('does nothing for somebody who built nothing', () => {
    const sim = worldWithBuilds();
    const result = sim.forgetCharacter('nobody', clockMs, THIRTY_MINUTES);
    expect(result).toEqual({ abandoned: [], cacheIds: [] });
    expect(sim.builtPropsList().every((prop) => prop.locked !== true)).toBe(true);
  });

  it('keeps the cabin shut even to a new character on the same account', () => {
    const sim = worldWithBuilds();
    sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);

    sim.addPlayer(1, undefined, 'chris');
    const home = builtIn(sim, CABIN_ID)!;
    const doorway = cabinDoorway(home);
    sim.placePlayer(1, { x: doorway.x, y: 0, z: doorway.z + 1.2 }, 0);
    for (let seq = 1; seq <= 20; seq++) {
      sim.queueInput(1, createInput(seq, 0, 1, 0));
      sim.step(tickClock());
    }

    expect(sim.spaceOf(1)).toBe(OUTDOORS);
    // And the new character has no home of their own to lock or unlock.
    expect(sim.setHomeLocked(1, true)).toBeNull();
  });

  it('puts a visitor who is inside the cabin back out on its doorstep', () => {
    const sim = worldWithBuilds();
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(2, { x: 0, y: 0, z: 2 }, 0, CABIN_ID);
    sim.drainSpaceChanges();

    sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);

    expect(sim.spaceOf(2)).toBe(OUTDOORS);
    const doorstep = cabinDoorstep(builtIn(sim, CABIN_ID)!);
    const [change] = sim.drainSpaceChanges();
    expect(change).toMatchObject({ netId: 2, space: OUTDOORS });
    expect(change?.x).toBeCloseTo(doorstep.x, 5);
    expect(change?.z).toBeCloseTo(doorstep.z, 5);
  });

  it('digs their buried caches up at once, and leaves everybody else’s', () => {
    const sim = createWorld();
    sim.restoreBuriedCaches([
      { id: 1, ownerPlayerKey: 'chris', x: 5, z: 5, items: [{ item: 'log', count: 3 }] },
      { id: 2, ownerPlayerKey: 'visitor', x: 9, z: 9, items: [{ item: 'log', count: 3 }] },
    ]);

    const { cacheIds } = sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);

    expect(cacheIds).toEqual([1]);
    expect(sim.buriedCachesList().map((cache) => cache.id)).toEqual([2]);
  });

  it('takes away piles that were set aside for them alone', () => {
    const sim = createWorld();
    const pile = (id: number, ownerKey?: string): PersistedPile => ({
      id,
      item: 'bone',
      count: 4,
      x: id,
      z: 0,
      droppedAtMs: clockMs,
      ...(ownerKey === undefined ? {} : { ownerKey }),
    });
    sim.restoreDroppedPiles([pile(5, 'chris'), pile(6), pile(7, 'visitor')], clockMs);
    sim.drainPileChanges();

    sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);

    expect(
      sim
        .droppedPilesList()
        .map((each) => each.id)
        .sort(),
    ).toEqual([6, 7]);
    expect(sim.drainPileChanges()).toEqual([5]);
  });

  describe('while their things stand locked', () => {
    /** Somebody standing right on a campfire, pressing E. */
    function pressEAt(sim: WorldSimulation, id: number): void {
      const fire = builtIn(sim, id)!;
      sim.addPlayer(2, undefined, 'visitor');
      sim.placePlayer(2, { x: fire.x, y: 0, z: fire.z }, 0);
      sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
      sim.step(tickClock());
    }

    it('lets nobody light their campfire', () => {
      const sim = worldWithBuilds();
      sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);

      pressEAt(sim, CAMPFIRE_ID);

      expect(builtIn(sim, CAMPFIRE_ID)?.lit).toBe(false);
      expect(nearestCampfire({ x: 12, y: 0, z: 12 }, sim.builtPropsList())).toBeNull();
    });

    it('still lets somebody light a campfire that is not abandoned', () => {
      const sim = worldWithBuilds();
      sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);

      pressEAt(sim, VISITORS_CAMPFIRE_ID);

      expect(builtIn(sim, VISITORS_CAMPFIRE_ID)?.lit).toBe(true);
    });

    it('does not cook on an abandoned fire that was left burning', () => {
      const sim = createWorld();
      sim.restoreBuiltProps([
        {
          id: CAMPFIRE_ID,
          kind: 'campfire',
          x: 12,
          z: 12,
          yaw: 0,
          lit: true,
          ownerKey: 'chris',
          litUntilMs: clockMs + THIRTY_MINUTES,
        },
      ]);
      sim.addPlayer(2, undefined, 'visitor');
      sim.placePlayer(2, { x: 12, y: 0, z: 12 }, 0);
      expect(sim.nearCookingFireOf(2)).toBe(true);

      sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);

      expect(sim.nearCookingFireOf(2)).toBe(false);
    });
  });

  describe('when the 30 minutes are up', () => {
    it('keeps everything until then, and takes it all away together at the end', () => {
      const sim = worldWithBuilds();
      const now = clockMs;
      sim.forgetCharacter('chris', now, THIRTY_MINUTES);

      expect(sim.removeExpiredBuilds(now + THIRTY_MINUTES - 1)).toEqual([]);
      expect(builtIn(sim, CABIN_ID)).toBeDefined();

      const gone = sim.removeExpiredBuilds(now + THIRTY_MINUTES);
      expect(gone.sort((a, b) => a - b)).toEqual([CABIN_ID, CAMPFIRE_ID, FENCE_ID]);
      expect(sim.builtPropsList().map((prop) => prop.id)).toEqual([VISITORS_CAMPFIRE_ID]);
      expect(sim.builtPropOwner(CABIN_ID)).toBeNull();
      expect(sim.abandonedUntilMsFor(CABIN_ID)).toBeNull();
      // Said once: nothing left to report afterwards.
      expect(sim.removeExpiredBuilds(now + THIRTY_MINUTES + 1000)).toEqual([]);
    });

    it('takes the cabin’s decorations, chest and walls with it', () => {
      const sim = worldWithBuilds();
      sim.restoreDecorations([
        { id: 1, homeId: CABIN_ID, kind: 'cedarBench', x: -0.5, z: -0.1, yaw: 0 },
      ]);
      const slots = Array.from({ length: 10 }, () => null) as (null | {
        item: 'log';
        count: number;
      })[];
      slots[0] = { item: 'log', count: 5 };
      sim.restoreChest(CABIN_ID, slots);
      expect(sim.decorationsList()).toHaveLength(1);
      expect(sim.chestSlots(CABIN_ID)[0]).toEqual({ item: 'log', count: 5 });

      /** Walk at the cabin's front wall, off to one side of the door, and say where that ends. */
      const walkAtTheWall = (): number => {
        sim.placePlayer(3, { x: 1.5, y: 0, z: -12 }, 0);
        for (let seq = 1; seq <= 60; seq++) {
          sim.queueInput(3, createInput(seq + clockMs, 0, 1, 0));
          sim.step(tickClock());
        }
        return sim.snapshotFor(3).find((entity) => entity.netId === 3)!.z;
      };
      sim.addPlayer(3, undefined, 'visitor');
      // Standing, the walls stop you.
      expect(walkAtTheWall()).toBeGreaterThan(-20);

      const now = clockMs;
      sim.forgetCharacter('chris', now, THIRTY_MINUTES);
      sim.removeExpiredBuilds(now + THIRTY_MINUTES);

      expect(sim.decorationsList()).toEqual([]);
      expect(sim.chestSlots(CABIN_ID).every((slot) => slot === null)).toBe(true);
      // Gone, there is nothing to stop you walking through where it stood.
      expect(walkAtTheWall()).toBeLessThan(-21);
    });

    it('does not change what a campfire’s own timer would have done', () => {
      const sim = createWorld();
      sim.restoreBuiltProps([
        {
          id: CAMPFIRE_ID,
          kind: 'campfire',
          x: 12,
          z: 12,
          yaw: 0,
          lit: true,
          ownerKey: 'chris',
          litUntilMs: clockMs + THIRTY_MINUTES * 2,
        },
      ]);
      const now = clockMs;
      sim.forgetCharacter('chris', now, THIRTY_MINUTES);

      expect(sim.removeExpiredBuilds(now + THIRTY_MINUTES)).toEqual([CAMPFIRE_ID]);
      expect(sim.campfireLitUntilMsFor(CAMPFIRE_ID)).toBeNull();
      expect(sim.extinguishBurnedOutCampfires(now + THIRTY_MINUTES * 3)).toEqual([]);
    });
  });

  describe('when the world wakes from storage', () => {
    it('remembers what is abandoned, still locked, and when it goes', () => {
      const sim = createWorld();
      const expiresAtMs = clockMs + 5000;
      sim.restoreBuiltProps([
        {
          id: CABIN_ID,
          kind: 'cabin',
          x: 0,
          z: -20,
          yaw: 0,
          lit: false,
          ownerKey: ABANDONED_OWNER,
          litUntilMs: null,
          expiresAtMs,
        },
      ]);

      expect(builtIn(sim, CABIN_ID)?.locked).toBe(true);
      expect(sim.abandonedUntilMsFor(CABIN_ID)).toBe(expiresAtMs);
      expect(sim.removeExpiredBuilds(expiresAtMs - 1)).toEqual([]);
    });

    it('takes away at once whatever ran out while nobody was here', () => {
      const sim = createWorld();
      sim.restoreBuiltProps([
        {
          id: CABIN_ID,
          kind: 'cabin',
          x: 0,
          z: -20,
          yaw: 0,
          lit: false,
          ownerKey: ABANDONED_OWNER,
          litUntilMs: null,
          expiresAtMs: clockMs - 1,
        },
      ]);

      expect(sim.removeExpiredBuilds(clockMs)).toEqual([CABIN_ID]);
      expect(sim.builtPropsList()).toEqual([]);
    });
  });

  describe('a rowboat', () => {
    const BOAT_ID = 11;

    /** A boat floating off the first clump of reeds, and somebody on the bank beside it. */
    function worldWithBoat(): { sim: WorldSimulation; bank: { x: number; z: number } } {
      const spot = REED_PATCHES[0]!;
      const circle = LAKE.basin.reduce((best, c) => {
        const gap = (each: { x: number; z: number; radius: number }) =>
          Math.abs(Math.hypot(spot.x - each.x, spot.z - each.z) - each.radius);
        return gap(c) < gap(best) ? c : best;
      });
      const length = Math.hypot(circle.x - spot.x, circle.z - spot.z);
      const inward = { x: (circle.x - spot.x) / length, z: (circle.z - spot.z) / length };
      const along = { x: -inward.z, z: inward.x };
      const x = spot.x + inward.x * 2.05;
      const z = spot.z + inward.z * 2.05;
      const sim = createWorld();
      sim.restoreBuiltProps([
        {
          id: BOAT_ID,
          kind: 'rowboat',
          x,
          z,
          yaw: Math.atan2(-along.z, along.x),
          lit: false,
          ownerKey: 'chris',
          litUntilMs: null,
        },
      ]);
      return {
        sim,
        bank: {
          x: x - inward.x * 2.9 + along.x * 3.5,
          z: z - inward.z * 2.9 + along.z * 3.5,
        },
      };
    }

    function standAndTapE(sim: WorldSimulation, netId: number, bank: { x: number; z: number }) {
      sim.placePlayer(netId, { x: bank.x, y: 0, z: bank.z }, 0);
      sim.queueInput(netId, createInput(1, 0, 0, 0, PlayerButton.Interact));
      sim.step(tickClock());
      sim.queueInput(netId, createInput(2, 0, 0, 0, 0));
      sim.step(tickClock());
    }

    const rower = (sim: WorldSimulation): number | undefined =>
      sim.builtPropsList().find((prop) => prop.id === BOAT_ID)?.rower;

    it('is there to row until its owner is deleted, and cannot be boarded afterwards', () => {
      const first = worldWithBoat();
      first.sim.addPlayer(
        2,
        { netId: 2, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: HUNGER_MAX },
        'visitor',
      );
      standAndTapE(first.sim, 2, first.bank);
      expect(rower(first.sim)).toBe(2);

      const second = worldWithBoat();
      second.sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);
      second.sim.addPlayer(
        2,
        { netId: 2, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: HUNGER_MAX },
        'visitor',
      );
      standAndTapE(second.sim, 2, second.bank);
      expect(rower(second.sim)).toBeUndefined();
    });

    it('stays until the person rowing it climbs out, even after its time is up', () => {
      const { sim, bank } = worldWithBoat();
      sim.addPlayer(
        2,
        { netId: 2, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: HUNGER_MAX },
        'visitor',
      );
      standAndTapE(sim, 2, bank);
      expect(rower(sim)).toBe(2);

      const now = clockMs;
      sim.forgetCharacter('chris', now, THIRTY_MINUTES);
      expect(sim.removeExpiredBuilds(now + THIRTY_MINUTES)).toEqual([]);
      expect(rower(sim)).toBe(2);

      sim.removePlayer(2);
      expect(sim.removeExpiredBuilds(now + THIRTY_MINUTES + 1000)).toEqual([BOAT_ID]);
      expect(sim.builtPropsList()).toEqual([]);
    });
  });

  it('leaves the player themself alone: letting them go is the game server’s job', () => {
    const sim = createWorld();
    sim.addPlayer(
      1,
      {
        netId: 1,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        items: [{ item: 'log', count: 9 }],
        hunger: HUNGER_MAX,
      },
      'chris',
    );
    sim.forgetCharacter('chris', clockMs, THIRTY_MINUTES);
    expect(sim.droppedPilesList()).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(9);
  });
});
