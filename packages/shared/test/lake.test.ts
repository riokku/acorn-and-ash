import { describe, expect, it } from 'vitest';

import { createCollisionWorld, resolveCapsule } from '../src/collision/capsule';
import {
  CLEARING_TREE_LINE_OUTER,
  DEFAULT_WORLD_SEED,
  FLOAT_SHORE_MARGIN,
  PLAYABLE_HALF_EXTENT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  TICK_SECONDS,
} from '../src/constants';
import { PlayerButton, createInput, createPlayerMotion, stepPlayer } from '../src/sim/player';
import { buildTestClearing } from '../src/world/clearing';
import { buildEncounterSites } from '../src/world/encounters';
import { buildIslandProps } from '../src/world/islands';
import {
  LAKE,
  LAKE_PROP_CLEARANCE,
  LAKE_SHORE_WIDTH,
  basinDepthAt,
  defineLake,
  isOnLake,
  islandDepthAt,
  lakeDepthAt,
  lakeSlopeAt,
  overlapsLake,
  type LakeSlope,
} from '../src/world/lake';
import {
  createFlatTerrain,
  createWildernessTerrain,
  wildernessHeightAt,
} from '../src/world/terrain';
import { castLanding } from '../src/world/water';
import { buildWilderness } from '../src/world/wilderness';

/** One round lake with one round island, on flat ground, for checking the shore rules in isolation. */
const SMALL = defineLake(
  0,
  [{ x: 0, z: 0, radius: 20 }],
  [{ id: 'dot', rise: 2, lobes: [{ x: 0, z: 0, radius: 4 }] }],
);

const NO_LAKE = defineLake(0, [], []);

describe('where the lake is', () => {
  it('is in the north-east corner, well inside the walls of the world', () => {
    for (const circle of LAKE.basin) {
      expect(circle.x - circle.radius).toBeGreaterThan(0);
      expect(circle.z + circle.radius).toBeLessThan(0);
      expect(circle.x + circle.radius).toBeLessThan(PLAYABLE_HALF_EXTENT - 12);
      expect(circle.z - circle.radius).toBeGreaterThan(-PLAYABLE_HALF_EXTENT + 12);
    }
  });

  it('is big: about a hundred metres across', () => {
    const width = LAKE.bounds.maxX - LAKE.bounds.minX;
    const depth = LAKE.bounds.maxZ - LAKE.bounds.minZ;
    expect(width).toBeGreaterThan(80);
    expect(width).toBeLessThan(120);
    expect(depth).toBeGreaterThan(80);
    expect(depth).toBeLessThan(120);
  });

  it('is a good walk from the home clearing, past its tree line and the bank', () => {
    let nearest = Infinity;
    for (const circle of LAKE.basin) {
      nearest = Math.min(nearest, Math.hypot(circle.x, circle.z) - circle.radius);
    }
    expect(nearest).toBeGreaterThan(CLEARING_TREE_LINE_OUTER + LAKE_SHORE_WIDTH);
  });

  it('has five islands', () => {
    expect(LAKE.islands).toHaveLength(5);
    expect(new Set(LAKE.islands.map((island) => island.id)).size).toBe(5);
  });

  it('keeps every island in open water, with room to row round it', () => {
    for (const island of LAKE.islands) {
      for (const lobe of island.lobes) {
        // The gap between the island's edge and the nearest mainland shore.
        expect(basinDepthAt(LAKE, lobe.x, lobe.z) - lobe.radius).toBeGreaterThan(4);
      }
    }
  });

  it('keeps the islands well apart from each other', () => {
    for (const a of LAKE.islands) {
      for (const b of LAKE.islands) {
        if (a === b) continue;
        for (const lobeA of a.lobes) {
          for (const lobeB of b.lobes) {
            const gap =
              Math.hypot(lobeA.x - lobeB.x, lobeA.z - lobeB.z) - lobeA.radius - lobeB.radius;
            expect(gap).toBeGreaterThan(5);
          }
        }
      }
    }
  });
});

describe('what is water and what is not', () => {
  it('is water in the open middle and land beyond the shore', () => {
    expect(isOnLake(LAKE, 70, -90)).toBe(true);
    expect(isOnLake(LAKE, 0, 0)).toBe(false);
    expect(isOnLake(LAKE, 140, -140)).toBe(false);
  });

  it('is not water on an island, even though it is inside the lake', () => {
    for (const island of LAKE.islands) {
      const heart = island.lobes[0]!;
      expect(basinDepthAt(LAKE, heart.x, heart.z)).toBeGreaterThan(0);
      expect(islandDepthAt(island, heart.x, heart.z)).toBeGreaterThan(0);
      expect(isOnLake(LAKE, heart.x, heart.z)).toBe(false);
      expect(lakeDepthAt(LAKE, heart.x, heart.z)).toBeLessThan(0);
    }
  });

  it('measures depth from the nearest shore, the island shore included', () => {
    expect(lakeDepthAt(SMALL, 12, 0)).toBeCloseTo(8);
    expect(lakeDepthAt(SMALL, 6, 0)).toBeCloseTo(2);
    expect(lakeDepthAt(SMALL, 3, 0)).toBeCloseTo(-1);
    expect(lakeDepthAt(SMALL, 25, 0)).toBeCloseTo(-5);
  });

  it('asks for a margin in from the shore, from both the bank and an island', () => {
    expect(isOnLake(SMALL, 19.7, 0, 0)).toBe(true);
    expect(isOnLake(SMALL, 19.7, 0, FLOAT_SHORE_MARGIN)).toBe(false);
    expect(isOnLake(SMALL, 4.2, 0, FLOAT_SHORE_MARGIN)).toBe(false);
    expect(isOnLake(SMALL, 10, 0, FLOAT_SHORE_MARGIN)).toBe(true);
  });

  it('has no lake where none is described', () => {
    expect(isOnLake(NO_LAKE, 0, 0)).toBe(false);
    expect(overlapsLake(NO_LAKE, 0, 0, 5)).toBe(false);
  });

  it('counts an island as part of the lake when only keeping clear of it', () => {
    expect(overlapsLake(SMALL, 0, 0, 0.5)).toBe(true);
    expect(overlapsLake(SMALL, 20.5, 0, 1)).toBe(true);
    expect(overlapsLake(SMALL, 22, 0, 1)).toBe(false);
  });

  it('points toward deeper water, away from the bank and away from an island', () => {
    const slope: LakeSlope = { depth: 0, towardX: 0, towardZ: 0 };
    lakeSlopeAt(SMALL, 15, 0, slope);
    expect(slope.depth).toBeCloseTo(5);
    expect(slope.towardX).toBeCloseTo(-1);
    expect(slope.towardZ).toBeCloseTo(0);

    // Between the island and the bank, nearer the island: deeper is away from the island.
    lakeSlopeAt(SMALL, 5.5, 0, slope);
    expect(slope.depth).toBeCloseTo(1.5);
    expect(slope.towardX).toBeCloseTo(1);

    // And it really does get deeper that way.
    const here = lakeDepthAt(SMALL, 5.5, 0);
    expect(lakeDepthAt(SMALL, 5.5 + slope.towardX * 0.5, slope.towardZ * 0.5)).toBeGreaterThan(
      here,
    );
  });
});

describe('the ground round the lake', () => {
  const seed = DEFAULT_WORLD_SEED;
  const height = (x: number, z: number): number => wildernessHeightAt(seed, x, z, LAKE, null);

  it('sinks below the water in open water', () => {
    expect(height(88, -88 + 20)).toBeLessThan(LAKE.level - 1);
    expect(height(70, -90)).toBeLessThan(LAKE.level - 0.5);
  });

  it('rises above the water on every island, highest in the middle', () => {
    for (const island of LAKE.islands) {
      const heart = island.lobes[0]!;
      const top = height(heart.x, heart.z);
      expect(top).toBeGreaterThan(LAKE.level + island.rise * 0.5);
      expect(top).toBeLessThanOrEqual(LAKE.level + island.rise + 0.1);
      // And it comes down to the water, rather than ending in a cliff.
      expect(height(heart.x + heart.radius + 1.5, heart.z)).toBeLessThan(top);
    }
  });

  it('meets the water at the shore, a hair above it, on a gentle beach', () => {
    // The west edge of the biggest blob, where nothing else is in the way.
    const big = LAKE.basin[0]!;
    const x = big.x - big.radius;
    const z = big.z;
    expect(Math.abs(basinDepthAt(LAKE, x, z))).toBeLessThan(0.5);
    expect(height(x, z) - LAKE.level).toBeGreaterThan(0);
    expect(height(x, z) - LAKE.level).toBeLessThan(0.3);
  });

  it('has no cliffs or steps across the shore', () => {
    for (const [fromX, fromZ, toX, toZ] of [
      [40, -88, 100, -88],
      [88, -40, 88, -130],
      [120, -50, 60, -110],
    ] as const) {
      const steps = 800;
      let previous = height(fromX, fromZ);
      for (let step = 1; step <= steps; step++) {
        const alpha = step / steps;
        const here = height(fromX + (toX - fromX) * alpha, fromZ + (toZ - fromZ) * alpha);
        const run = Math.hypot(toX - fromX, toZ - fromZ) / steps;
        // Steeper than a metre up for a metre along would be a cliff.
        expect(Math.abs(here - previous) / run).toBeLessThan(1);
        previous = here;
      }
    }
  });

  it('is exactly the hills, untouched, once the bank has eased away', () => {
    for (const [x, z] of [
      [0, 0],
      [30, 30],
      [-100, 60],
      [20, -100],
      [140, 20],
    ] as const) {
      expect(wildernessHeightAt(seed, x, z, LAKE)).toBe(wildernessHeightAt(seed, x, z, NO_LAKE));
    }
  });

  it('is the same ground on every call', () => {
    expect(height(77, -63)).toBe(height(77, -63));
    expect(createWildernessTerrain(seed).heightAt(77, -63)).toBe(height(77, -63));
  });
});

describe('the shore wall', () => {
  const flat = createFlatTerrain(0);
  const worldWith = (lake = SMALL) => createCollisionWorld(flat, [], PLAYABLE_HALF_EXTENT, lake);

  function walkEast(world: ReturnType<typeof worldWith>, fromX: number, ticks: number, moveZ = 0) {
    const motion = createPlayerMotion({ x: fromX, y: 0, z: 0 });
    let everInWater = false;
    for (let tick = 1; tick <= ticks; tick++) {
      stepPlayer(motion, createInput(tick, 1, moveZ, 0, 0), TICK_SECONDS, world);
      if (isOnLake(SMALL, motion.position.x, motion.position.z)) everInWater = true;
    }
    return { motion, everInWater };
  }

  it('stops a walker at the water instead of letting them wade in', () => {
    const { motion, everInWater } = walkEast(worldWith(), -30, 200);
    expect(everInWater).toBe(false);
    // Standing on the bank, a body's width from the water's edge.
    expect(Math.hypot(motion.position.x, motion.position.z)).toBeGreaterThanOrEqual(
      20 + PLAYER_RADIUS - 0.01,
    );
    expect(motion.position.x).toBeLessThan(-19);
  });

  it('stops a sprinter just the same', () => {
    const world = worldWith();
    const motion = createPlayerMotion({ x: -40, y: 0, z: 0 });
    for (let tick = 1; tick <= 200; tick++) {
      stepPlayer(motion, createInput(tick, 1, 0, 0, PlayerButton.Sprint), TICK_SECONDS, world);
      expect(isOnLake(SMALL, motion.position.x, motion.position.z)).toBe(false);
    }
  });

  it('slides along the bank when walking at it on a slant, rather than sticking', () => {
    // East and north at once, into a bank that faces west.
    const { motion, everInWater } = walkEast(worldWith(), -30, 200, 1);
    expect(everInWater).toBe(false);
    expect(Math.abs(motion.position.z)).toBeGreaterThan(15);
  });

  it('pushes someone standing in the water out to the shore', () => {
    const world = worldWith(defineLake(0, [{ x: 0, z: 0, radius: 20 }], []));
    const position = { x: 15, y: 0, z: 0 };
    expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
    expect(position.x).toBeCloseTo(20 + PLAYER_RADIUS);
    expect(position.z).toBeCloseTo(0);
  });

  it('leaves someone alone on dry land', () => {
    const position = { x: 30, y: 0, z: 5 };
    expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, worldWith())).toBe(false);
    expect(position).toEqual({ x: 30, y: 0, z: 5 });
  });

  it('lets someone on an island stay there', () => {
    const position = { x: 0, y: 0, z: 0 };
    expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, worldWith())).toBe(false);
  });

  it('can be taken down, so a boat or the winter ice can cross the water', () => {
    const world = worldWith();
    expect(world.lakeWall?.up).toBe(true);
    world.lakeWall!.up = false;
    const { motion, everInWater } = walkEast(world, -30, 200);
    expect(everInWater).toBe(true);
    expect(motion.position.x).toBeGreaterThan(0);
  });

  it('is not there in a world with no lake', () => {
    const world = createCollisionWorld(flat, [], PLAYABLE_HALF_EXTENT);
    expect(world.lakeWall).toBeNull();
    const position = { x: 5, y: 0, z: 0 };
    expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(false);
  });

  it('keeps a walker out of the real lake, on the real ground', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const world = createCollisionWorld(terrain, [], PLAYABLE_HALF_EXTENT, LAKE);
    for (const startZ of [-60, -88, -100, -120]) {
      const motion = createPlayerMotion({ x: 40, y: terrain.heightAt(40, startZ), z: startZ });
      for (let tick = 1; tick <= 400; tick++) {
        stepPlayer(motion, createInput(tick, 1, 0, 0, 0), TICK_SECONDS, world);
        expect(isOnLake(LAKE, motion.position.x, motion.position.z)).toBe(false);
      }
    }
  });
});

describe('casting from the shore', () => {
  it('lands the float on the lake, out from the bank', () => {
    // On the west bank of the biggest blob, facing east: yaw -90 degrees looks down +X.
    const bank = { x: 55.4, y: 0, z: -88 };
    const spot = castLanding(bank, -Math.PI / 2, [], LAKE);
    expect(spot).not.toBeNull();
    expect(isOnLake(LAKE, spot!.x, spot!.z, FLOAT_SHORE_MARGIN)).toBe(true);
  });

  it('finds nothing facing away from the lake', () => {
    const bank = { x: 55.4, y: 0, z: -88 };
    expect(castLanding(bank, Math.PI / 2, [], LAKE)).toBeNull();
  });

  it('never lands a float on an island', () => {
    for (const island of LAKE.islands) {
      const heart = island.lobes[0]!;
      for (let step = 0; step < 16; step++) {
        const yaw = (step / 16) * Math.PI * 2;
        // Stand a stone's throw from the island's middle, in open water, and cast every way round.
        const from = { x: heart.x + 3, y: 0, z: heart.z };
        const spot = castLanding(from, yaw, [], LAKE);
        if (spot !== null) expect(islandDepthAt(island, spot.x, spot.z)).toBeLessThan(0);
      }
    }
  });

  it('still works on the pond alone, as before', () => {
    expect(castLanding({ x: 0, y: 0, z: 0 }, 0, [])).toBeNull();
    expect(castLanding({ x: 0, y: 0, z: 0 }, 0, [], NO_LAKE)).toBeNull();
  });
});

describe('what stands on and beside the lake', () => {
  const seed = DEFAULT_WORLD_SEED;
  const terrain = createWildernessTerrain(seed);
  const wilderness = buildWilderness(seed, terrain);
  const onIslands = (x: number, z: number): boolean =>
    LAKE.islands.some((island) => islandDepthAt(island, x, z) > 0);

  it('leaves the lake and its edge free of ordinary trees and rocks', () => {
    for (const prop of wilderness.props) {
      if (onIslands(prop.x, prop.z)) continue;
      expect(basinDepthAt(LAKE, prop.x, prop.z)).toBeLessThanOrEqual(-LAKE_PROP_CLEARANCE);
    }
  });

  it('puts trees and rocks on every island, and keeps the middle clear', () => {
    let total = 0;
    for (const island of LAKE.islands) {
      const heart = island.lobes[0]!;
      const here = wilderness.props.filter((prop) => islandDepthAt(island, prop.x, prop.z) > 0);
      expect(here.length).toBeGreaterThanOrEqual(1);
      total += here.length;
      for (const prop of here) {
        expect(islandDepthAt(island, prop.x, prop.z)).toBeGreaterThan(1.2);
        expect(Math.hypot(prop.x - heart.x, prop.z - heart.z)).toBeGreaterThan(
          Math.min(3.4, heart.radius * 0.5) - 1e-9,
        );
        // Standing on the ground, which is above the water.
        expect(prop.y ?? 0).toBeGreaterThan(LAKE.level);
      }
    }
    // The big island carries most of them.
    expect(total).toBeGreaterThanOrEqual(8);
  });

  it('numbers every tree and rock differently', () => {
    const ids = wilderness.props.map((prop) => prop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('plants the same islands for the same world, and different ones for another', () => {
    const first = buildIslandProps(seed, LAKE, terrain, 1);
    expect(buildIslandProps(seed, LAKE, terrain, 1)).toEqual(first);
    expect(buildIslandProps(seed + 1, LAKE, terrain, 1)).not.toEqual(first);
  });

  it('does not move any tree that is not at the lake', () => {
    const without = buildWilderness(seed, terrain, NO_LAKE);
    const keptByBoth = without.props.filter(
      (prop) => basinDepthAt(LAKE, prop.x, prop.z) <= -LAKE_PROP_CLEARANCE,
    );
    const withLake = new Map(wilderness.props.map((prop) => [prop.id, prop]));
    for (const prop of keptByBoth) {
      const same = withLake.get(prop.id);
      expect(same).toBeDefined();
      expect(same?.x).toBe(prop.x);
      expect(same?.z).toBe(prop.z);
      // Beside the water a conifer may give way to an alder or a maple; nothing else changes kind.
      if (same?.kind !== prop.kind) expect(['maple', 'alder']).toContain(same?.kind);
    }
  });

  it('keeps encounter sites out of the lake and off its bank', () => {
    const clearing = buildTestClearing(seed);
    for (let world = 1; world <= 40; world++) {
      const ground = createWildernessTerrain(world);
      const built = buildWilderness(world, ground);
      const sites = buildEncounterSites(
        world,
        ground,
        [...clearing.colliders, ...built.siteColliders],
        clearing.water,
        LAKE,
      );
      for (const site of sites) {
        expect(basinDepthAt(LAKE, site.x, site.z)).toBeLessThanOrEqual(-(LAKE_SHORE_WIDTH + 4));
      }
    }
  });

  it('leaves encounter sites exactly where they were when none was near the lake', () => {
    const clearing = buildTestClearing(seed);
    let unaffected = 0;
    for (let world = 1; world <= 40; world++) {
      const ground = createWildernessTerrain(world, NO_LAKE);
      const built = buildWilderness(world, ground, NO_LAKE);
      const colliders = [...clearing.colliders, ...built.siteColliders];
      const before = buildEncounterSites(world, ground, colliders, clearing.water);
      const nearTheLake = before.some(
        (site) => basinDepthAt(LAKE, site.x, site.z) > -(LAKE_SHORE_WIDTH + 4),
      );
      if (nearTheLake) continue;
      unaffected += 1;
      const lakeGround = createWildernessTerrain(world, LAKE);
      expect(buildEncounterSites(world, lakeGround, colliders, clearing.water, LAKE)).toEqual(
        before,
      );
    }
    // Plenty of worlds have no glade near the lake, so this is not an empty check.
    expect(unaffected).toBeGreaterThan(10);
  });
});
