import { afterEach, expect, it } from 'vitest';
import { createWorld, type World } from 'koota';
import {
  SKELETON_TOWN as town,
  TOWN_DISTRICTS,
  townColliders,
  inSkeletonTown,
  createWildernessTerrain,
  buildWilderness,
  buildTestClearing,
  buildEncounterSites,
  createCollisionWorld,
  resolveCapsule,
  PLAYER_RADIUS,
  PLAYER_HEIGHT,
  DEFAULT_WORLD_SEED,
  RaidDirector,
  createActionState,
  TICK_HZ,
  LAKE,
  STREAM,
  lakeWaterDepthAt,
  streamWaterDepthAt,
  type RaidFighter,
} from '../src/index';
const worlds: World[] = [];
afterEach(() => {
  for (const world of worlds.splice(0)) world.destroy();
});
it('keeps the settlement dry, level and clear of scenery across seeds', () => {
  for (const seed of [DEFAULT_WORLD_SEED, 7, 99]) {
    const terrain = createWildernessTerrain(seed),
      level = terrain.heightAt(town.x, town.z);
    for (let dx = -28; dx <= 28; dx += 7)
      for (let dz = -28; dz <= 28; dz += 7) {
        expect(terrain.heightAt(town.x + dx, town.z + dz)).toBeCloseTo(level, 5);
        expect(lakeWaterDepthAt(LAKE, town.x + dx, town.z + dz)).toBe(0);
        expect(streamWaterDepthAt(STREAM, town.x + dx, town.z + dz)).toBe(0);
      }
    expect(buildWilderness(seed, terrain).props.some((p) => inSkeletonTown(p.x, p.z, 2))).toBe(
      false,
    );
  }
});
it('blocks houses and graves while leaving roads and district centers open', () => {
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED),
    y = terrain.heightAt(town.x, town.z);
  const world = createCollisionWorld(terrain, townColliders(terrain));
  for (const district of TOWN_DISTRICTS)
    expect(
      resolveCapsule(
        { x: town.x + district.x, y, z: town.z + district.z },
        PLAYER_RADIUS,
        PLAYER_HEIGHT,
        world,
      ),
    ).toBe(false);
  for (const [dx, dz] of [
    [0, 28],
    [0, -23.5],
    [-10, -1],
    [10, -1],
  ])
    expect(
      resolveCapsule(
        { x: town.x + dx!, y: y + 0.1, z: town.z + dz! },
        PLAYER_RADIUS,
        PLAYER_HEIGHT,
        world,
      ),
    ).toBe(false);
  expect(
    resolveCapsule(
      { x: town.x - 23, y: y + 0.1, z: town.z + 16 },
      PLAYER_RADIUS,
      PLAYER_HEIGHT,
      world,
    ),
  ).toBe(true);
  expect(
    resolveCapsule(
      { x: town.x + 20, y: y + 0.1, z: town.z - 4 },
      PLAYER_RADIUS,
      PLAYER_HEIGHT,
      world,
    ),
  ).toBe(true);
});
it('wakes thirteen residents in four groups, engages locally and sleeps when deserted', () => {
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED),
    clearing = buildTestClearing(DEFAULT_WORLD_SEED, terrain);
  const sites = buildEncounterSites(DEFAULT_WORLD_SEED, terrain, [], clearing.water).filter(
    (s) => s.townDistrict,
  );
  expect(sites.map((s) => s.id)).toEqual([100, 101, 102, 103]);
  const world = createWorld();
  worlds.push(world);
  const fighters: RaidFighter[] = [
    {
      netId: 1,
      position: { x: town.x, y: terrain.heightAt(town.x, town.z), z: town.z + 40 },
      aimYaw: 0,
      outdoors: true,
      down: false,
      action: createActionState(),
    },
  ];
  const director = new RaidDirector(
    world,
    DEFAULT_WORLD_SEED,
    {
      collision: createCollisionWorld(terrain, townColliders(terrain)),
      water: [],
      fighters: () => fighters,
      strikePlayer: () => {},
      dropLoot: () => {},
    },
    { intervalMinSeconds: 100000, encounterSites: sites },
  );
  let tick = 0;
  const step = (seconds: number) => {
    for (let i = 0; i < seconds * TICK_HZ; i++) director.step(++tick, false);
  };
  step(2);
  expect(director.raiderCount).toBe(13);
  expect(director.drainNews()).toEqual([]);
  fighters[0] = { ...fighters[0]!, position: { ...fighters[0]!.position, z: town.z + 20 } };
  step(4);
  const news = director.drainNews().filter((n) => n.kind === 'ruins');
  expect(news).toHaveLength(1);
  expect(news[0]!.count).toBe(3);
  fighters[0] = { ...fighters[0]!, position: { x: 0, y: 0, z: 0 } };
  step(35);
  expect(director.raiderCount).toBe(0);
});
