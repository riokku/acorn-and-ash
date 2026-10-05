import { afterEach, describe, expect, it } from 'vitest';

import { createCollisionWorld, isLakeFrozen, setLakeFrozen } from '../src/collision/capsule';
import {
  DEFAULT_WORLD_SEED,
  HUNGER_MAX,
  PLAYABLE_HALF_EXTENT,
  TICK_MILLISECONDS,
  TICK_SECONDS,
} from '../src/constants';
import { ActionKind, createActionState, unpackActionByte } from '../src/sim/actions';
import { buildableFootprint, checkBuildSpot } from '../src/sim/building';
import { countOf } from '../src/sim/inventory';
import { createInput, createPlayerMotion, PlayerButton, stepPlayer } from '../src/sim/player';
import {
  calendarAt,
  clockShiftForSeason,
  DAYS_PER_SEASON,
  lakeIsFrozen,
  SEASONS,
  type SeasonId,
} from '../src/sim/seasons';
import { WorldSimulation } from '../src/sim/world-sim';
import { BOAT_ICE_STEP_OUT } from '../src/world/boat';
import { LAKE, lakeDepthAt, lakeIceHeight } from '../src/world/lake';
import { REED_PATCHES } from '../src/world/reeds';
import { createWildernessTerrain } from '../src/world/terrain';

const SEED = DEFAULT_WORLD_SEED;

/** The water in front of the first clump of reeds: the boat's berth, which way is out, and the bank. */
function berth(alongBank = 0) {
  const spot = REED_PATCHES[0]!;
  const circle = LAKE.basin.reduce((best, each) => {
    const gap = (c: { x: number; z: number; radius: number }) =>
      Math.abs(Math.hypot(spot.x - c.x, spot.z - c.z) - c.radius);
    return gap(each) < gap(best) ? each : best;
  });
  const length = Math.hypot(circle.x - spot.x, circle.z - spot.z);
  const inward = { x: (circle.x - spot.x) / length, z: (circle.z - spot.z) / length };
  const along = { x: -inward.z, z: inward.x };
  const x = spot.x + inward.x * 2.05 + along.x * alongBank;
  const z = spot.z + inward.z * 2.05 + along.z * alongBank;
  return {
    x,
    z,
    inward,
    yaw: Math.atan2(-along.z, along.x),
    /** Somebody standing on the bank a little way along it, in reach of the boat. */
    bank: {
      x: x - inward.x * 2.9 + along.x * 3.5,
      y: 0,
      z: z - inward.z * 2.9 + along.z * 3.5,
    },
    /** The camera heading that points out over the water. */
    outYaw: Math.atan2(-inward.x, -inward.z),
  };
}

/** The deepest of the lake's circle centres: well out from every shore. */
function middleOfTheLake() {
  return LAKE.basin.reduce((best, each) =>
    lakeDepthAt(LAKE, each.x, each.z) > lakeDepthAt(LAKE, best.x, best.z) ? each : best,
  );
}

describe('when the lake is frozen', () => {
  it('is all of winter and none of the rest of the year', () => {
    for (const season of SEASONS) {
      for (let day = 1; day <= DAYS_PER_SEASON; day++) {
        const calendar = calendarAt(SEED, clockShiftForSeason(SEED, 0, season, day));
        expect(calendar.season).toBe(season);
        expect(lakeIsFrozen(calendar)).toBe(season === 'winter');
      }
    }
  });
});

describe('the ground on a frozen lake', () => {
  const terrain = createWildernessTerrain(SEED);
  const open = { x: 70, z: -90 };
  const crown = LAKE.islands[0]!.lobes[0]!;

  it('is the bed of the lake while it is open, and the top of the ice once it is frozen', () => {
    const world = createCollisionWorld(terrain, [], PLAYABLE_HALF_EXTENT, LAKE);
    expect(isLakeFrozen(world)).toBe(false);
    expect(world.terrain.heightAt(open.x, open.z)).toBeLessThan(LAKE.level - 1);

    setLakeFrozen(world, true);
    expect(isLakeFrozen(world)).toBe(true);
    expect(world.terrain.heightAt(open.x, open.z)).toBeCloseTo(lakeIceHeight(LAKE), 6);

    setLakeFrozen(world, false);
    expect(world.terrain.heightAt(open.x, open.z)).toBeLessThan(LAKE.level - 1);
  });

  it('leaves the land, and the high ground of an island, as it was', () => {
    const world = createCollisionWorld(terrain, [], PLAYABLE_HALF_EXTENT, LAKE);
    const land = [
      [0, 0],
      [140, -140],
      [crown.x, crown.z],
    ] as const;
    const before = land.map(([x, z]) => world.terrain.heightAt(x, z));
    setLakeFrozen(world, true);
    land.forEach(([x, z], index) => expect(world.terrain.heightAt(x, z)).toBe(before[index]));
    expect(before[2]).toBeGreaterThan(lakeIceHeight(LAKE));
  });

  it('is a world with no lake all year round', () => {
    const world = createCollisionWorld(terrain, [], PLAYABLE_HALF_EXTENT);
    setLakeFrozen(world, true);
    expect(isLakeFrozen(world)).toBe(false);
  });

  it('can be walked out on once frozen, and not before', () => {
    const water = berth();
    const start = { x: water.bank.x - water.inward.x, z: water.bank.z - water.inward.z };
    const farthestOut = (frozen: boolean) => {
      const world = createCollisionWorld(terrain, [], PLAYABLE_HALF_EXTENT, LAKE);
      setLakeFrozen(world, frozen);
      const motion = createPlayerMotion({
        x: start.x,
        y: world.terrain.heightAt(start.x, start.z),
        z: start.z,
      });
      let deepest = -Infinity;
      for (let tick = 0; tick < 5 / TICK_SECONDS; tick++) {
        stepPlayer(motion, createInput(tick + 1, 0, 1, water.outYaw), TICK_SECONDS, world);
        deepest = Math.max(deepest, lakeDepthAt(LAKE, motion.position.x, motion.position.z));
        if (frozen && deepest > 3) {
          // Out over the water and still at the height of the ice.
          expect(motion.position.y).toBeCloseTo(lakeIceHeight(LAKE), 2);
        }
      }
      return deepest;
    };

    expect(farthestOut(false)).toBeLessThan(0.5);
    expect(farthestOut(true)).toBeGreaterThan(8);
  });
});

describe('a world through the winter', () => {
  const built: WorldSimulation[] = [];
  let clockMs = 1_700_000_000_000;
  let sequence = 0;
  afterEach(() => {
    for (const sim of built.splice(0)) sim.dispose();
  });

  const BOAT_ID = 7;

  /**
   * A world in this season, with a boat moored at the berth and a player on the
   * bank beside it. The boat is the player's own unless `boatOwner` says whose.
   */
  function worldIn(
    season: SeasonId,
    { boatOwner = 'rower-1', rod = false } = {},
  ): { sim: WorldSimulation; water: ReturnType<typeof berth> } {
    const water = berth();
    const sim = new WorldSimulation({ seed: SEED, hungerEmptyAfterSeconds: Infinity });
    built.push(sim);
    sim.setCalendarShift(clockShiftForSeason(SEED, 0, season));
    sim.restoreBuiltProps([
      {
        id: BOAT_ID,
        kind: 'rowboat',
        x: water.x,
        z: water.z,
        yaw: water.yaw,
        lit: false,
        ownerKey: boatOwner,
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
        items: rod
          ? [
              { item: 'bag', count: 1 },
              { item: 'rod', count: 1 },
            ]
          : [],
        hunger: HUNGER_MAX,
        equippedItem: rod ? 'rod' : null,
      },
      'rower-1',
    );
    sim.placePlayer(1, { x: water.bank.x, y: 0, z: water.bank.z }, 0);
    return { sim, water };
  }

  /** One tick for the player, with this way held, this camera heading and these buttons. */
  function tick(sim: WorldSimulation, moveZ = 0, yaw = 0, buttons = 0): void {
    sim.queueInput(1, createInput(++sequence, 0, moveZ, yaw, buttons));
    sim.step((clockMs += TICK_MILLISECONDS));
  }
  /** A press and a release of interact: one tap of E. */
  const tapE = (sim: WorldSimulation) => {
    tick(sim, 0, 0, PlayerButton.Interact);
    tick(sim);
  };
  /** The player as everybody else sees them. */
  const me = (sim: WorldSimulation) => sim.snapshotFor(1).find((entity) => entity.netId === 1)!;
  const actionOf = (sim: WorldSimulation) =>
    unpackActionByte(me(sim).action, createActionState()).kind;
  const boatOf = (sim: WorldSimulation) => sim.builtPropsList().find((p) => p.id === BOAT_ID)!;
  const boatsIn = (sim: WorldSimulation) =>
    sim.builtPropsList().filter((prop) => prop.kind === 'rowboat');
  const turnTo = (sim: WorldSimulation, season: SeasonId) =>
    sim.setCalendarShift(clockShiftForSeason(SEED, sim.tick * TICK_MILLISECONDS, season));

  it('knows the season by the ticks it has run, and a test can push the calendar on', () => {
    const { sim } = worldIn('summer');
    expect(sim.calendar().season).toBe('summer');
    turnTo(sim, 'winter');
    expect(sim.calendar().season).toBe('winter');
    sim.setCalendarShift(0);
    expect(sim.calendar()).toEqual(calendarAt(SEED, sim.tick * TICK_MILLISECONDS));
  });

  it('freezes when winter comes, and tells everybody once', () => {
    const { sim } = worldIn('autumn');
    tick(sim);
    expect(sim.isLakeFrozen()).toBe(false);
    expect(sim.drainLakeFreezeChange()).toBeNull();

    turnTo(sim, 'winter');
    tick(sim);
    expect(sim.isLakeFrozen()).toBe(true);
    expect(sim.drainLakeFreezeChange()).toBe(true);
    expect(sim.drainLakeFreezeChange()).toBeNull();
  });

  it('is frozen from the very first tick of a world that wakes in winter', () => {
    const { sim } = worldIn('winter');
    tick(sim);
    expect(sim.isLakeFrozen()).toBe(true);
    expect(sim.drainLakeFreezeChange()).toBe(true);
  });

  it('thaws with spring, and tells everybody', () => {
    const { sim } = worldIn('winter');
    tick(sim);
    sim.drainLakeFreezeChange();
    turnTo(sim, 'spring');
    tick(sim);
    expect(sim.isLakeFrozen()).toBe(false);
    expect(sim.drainLakeFreezeChange()).toBe(false);
  });

  it('steps a rower out onto the ice beside their boat, which stays frozen in place', () => {
    const { sim, water } = worldIn('autumn');
    tapE(sim);
    expect(actionOf(sim)).toBe(ActionKind.Row);
    for (let i = 0; i < 80; i++) tick(sim, 1, water.outYaw, PlayerButton.Sprint);
    const rowed = me(sim);
    expect(lakeDepthAt(LAKE, rowed.x, rowed.z)).toBeGreaterThan(5);
    sim.drainBoatChanges();

    turnTo(sim, 'winter');
    tick(sim);

    // The boat is where the rower was, nobody is in it, and everybody is told.
    const boat = boatOf(sim);
    expect(boat.rower).toBeUndefined();
    expect(Math.hypot(boat.x - rowed.x, boat.z - rowed.z)).toBeLessThan(1.5);
    expect(sim.drainBoatChanges().map((changed) => changed.id)).toEqual([BOAT_ID]);
    // They stand on the ice a step from its side, no longer rowing.
    const standing = me(sim);
    expect(actionOf(sim)).toBe(ActionKind.Idle);
    expect(Math.hypot(standing.x - boat.x, standing.z - boat.z)).toBeCloseTo(BOAT_ICE_STEP_OUT, 0);
    expect(standing.y).toBeCloseTo(lakeIceHeight(LAKE), 1);
    // And the ice holds them as they walk on.
    for (let i = 0; i < 10; i++) tick(sim, 1, water.outYaw);
    const walked = me(sim);
    expect(Math.hypot(walked.x - standing.x, walked.z - standing.z)).toBeGreaterThan(2);
    expect(lakeDepthAt(LAKE, walked.x, walked.z)).toBeGreaterThan(3);
    expect(walked.y).toBeCloseTo(lakeIceHeight(LAKE), 1);
  });

  it('does not let anybody climb into a boat that is frozen in', () => {
    const { sim } = worldIn('winter');
    tapE(sim);
    expect(actionOf(sim)).toBe(ActionKind.Idle);
    expect(boatOf(sim).rower).toBeUndefined();
  });

  it('lets them climb in again once it thaws', () => {
    const { sim } = worldIn('winter');
    tick(sim);
    turnTo(sim, 'spring');
    tapE(sim);
    expect(actionOf(sim)).toBe(ActionKind.Row);
  });

  it('does not let a boat be moored on the ice, and does while the water is open', () => {
    const second = berth(4.5);
    const mooring = buildableFootprint('rowboat', second.x, second.z, second.yaw);
    expect(checkBuildSpot(mooring, second.bank, 1000, [], [])).toBeNull();
    expect(checkBuildSpot(mooring, second.bank, 1000, [], [], false, true)).toEqual({
      reason: 'frozen',
    });
  });

  it('does not take a build request for a boat while frozen, and keeps the materials', () => {
    for (const [season, boats, logs] of [
      ['winter', 1, 6],
      ['summer', 2, 0],
    ] as const) {
      // Somebody else's boat is moored; this player has none and every material for one.
      const { sim } = worldIn(season, { boatOwner: 'somebody-else' });
      const second = berth(4.5);
      Object.assign(sim.inventoryOf(1), { log: 6, rope: 2 });
      sim.placePlayer(1, { x: second.bank.x, y: 0, z: second.bank.z }, 0);
      tick(sim);
      sim.requestBuild(1, { kind: 'rowboat', x: second.x, z: second.z, yaw: second.yaw });
      tick(sim);
      expect(boatsIn(sim)).toHaveLength(boats);
      expect(countOf(sim.inventoryOf(1), 'log')).toBe(logs);
    }
  });

  it('does not let a line be cast onto the ice, and does onto open water', () => {
    for (const [season, cast] of [
      ['summer', true],
      ['winter', false],
    ] as const) {
      const { sim, water } = worldIn(season, { rod: true });
      sim.placePlayer(1, { x: water.bank.x, y: 0, z: water.bank.z }, water.outYaw);
      tick(sim, 0, water.outYaw, PlayerButton.Fish);
      tick(sim, 0, water.outYaw);
      expect(sim.castOf(1) !== null).toBe(cast);
    }
  });

  it('does not break up a boat cut off on an island while it is frozen', () => {
    const { sim } = worldIn('winter');
    tick(sim);
    expect(sim.drainBrokenBoats()).toEqual([]);
    expect(boatsIn(sim)).toHaveLength(1);
  });

  it('puts anybody out on the lake on the nearest shore when the ice goes', () => {
    const { sim } = worldIn('winter');
    tick(sim);
    const middle = middleOfTheLake();
    sim.placePlayer(1, { x: middle.x, y: lakeIceHeight(LAKE), z: middle.z }, 0);
    tick(sim);
    expect(lakeDepthAt(LAKE, me(sim).x, me(sim).z)).toBeGreaterThan(3);

    turnTo(sim, 'spring');
    tick(sim);
    const ashore = me(sim);
    expect(lakeDepthAt(LAKE, ashore.x, ashore.z)).toBeLessThanOrEqual(0);
    // On the ground, not hanging over the water.
    expect(ashore.y).toBeCloseTo(createWildernessTerrain(SEED).heightAt(ashore.x, ashore.z), 1);
  });

  it('brings somebody who logged out on the ice back on the shore if it has thawed since', () => {
    const middle = middleOfTheLake();
    for (const [season, onTheIce] of [
      ['winter', true],
      ['spring', false],
    ] as const) {
      const sim = new WorldSimulation({ seed: SEED, hungerEmptyAfterSeconds: Infinity });
      built.push(sim);
      sim.setCalendarShift(clockShiftForSeason(SEED, 0, season));
      sim.addPlayer(
        2,
        {
          netId: 2,
          x: middle.x,
          y: lakeIceHeight(LAKE),
          z: middle.z,
          facingYaw: 0,
          items: [],
          hunger: HUNGER_MAX,
        },
        'ice-walker',
      );
      sim.step((clockMs += TICK_MILLISECONDS));
      const back = sim.snapshotFor(2).find((entity) => entity.netId === 2)!;
      expect(lakeDepthAt(LAKE, back.x, back.z) > 3).toBe(onTheIce);
    }
  });
});
