import { afterEach, describe, expect, it } from 'vitest';

import { createCollisionWorld, resolveCapsule } from '../src/collision/capsule';
import {
  DEFAULT_WORLD_SEED,
  GATHER_PATCH_MAX_COUNT,
  GATHER_PATCH_MIN_COUNT,
  PATCH_SPACING,
  PICKUP_REACH,
  PLAYABLE_HALF_EXTENT,
  REED_REGROW_MAX_SECONDS,
  REED_REGROW_MIN_SECONDS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  SPAWN_POSITION,
  TICK_MILLISECONDS,
} from '../src/constants';
import { ITEM_KINDS } from '../src/data/items';
import { recipeFor } from '../src/data/recipes';
import { reedFootprints } from '../src/sim/building';
import { PlayerButton, createInput } from '../src/sim/player';
import { countOf } from '../src/sim/inventory';
import { WorldSimulation } from '../src/sim/world-sim';
import { buildWilderness } from '../src/world/wilderness';
import { createWildernessTerrain } from '../src/world/terrain';
import { LAKE, lakeDepthAt, basinDepthAt, nearestIslandDepthAt } from '../src/world/lake';
import {
  AXE_STUMP,
  BAG_SPOT,
  FLOWER_PATCHES,
  POND,
  ROD_SPOT,
  STICK_PATCHES,
} from '../src/world/clearing';
import { waterColliders, type WaterCircle } from '../src/world/water';
import {
  REED_PATCHES,
  REED_PATCH_DEPTH,
  REED_PATCH_FIRST_ID,
  REED_SHORE_SPOTS,
  REED_WATERS,
  buildReedPatchSpots,
  isReedPatch,
  isReedSpot,
  isReedSpotFor,
  reedBedSpacing,
  reedRegrowDelayMs,
  reedRegrowSpot,
  reedShoreSpots,
  reedWaterOf,
} from '../src/world/reeds';

const LAKE_WATER = REED_WATERS.find((water) => water.name === 'lake')!;
const POND_WATER = REED_WATERS.find((water) => water.name === 'pond')!;
const LAKE_BEDS = REED_PATCHES.filter((bed) => reedWaterOf(bed.id) === LAKE_WATER);
const POND_BEDS = REED_PATCHES.filter((bed) => reedWaterOf(bed.id) === POND_WATER);

/** How far inside a pond's outline a spot is, in metres: negative on dry land. */
function outlineDepth(circles: readonly WaterCircle[], x: number, z: number): number {
  return Math.max(...circles.map((c) => c.radius - Math.hypot(x - c.x, z - c.z)));
}

/** Everything the clearing already lays out round the pond. */
const AROUND_THE_POND = [
  SPAWN_POSITION,
  AXE_STUMP,
  BAG_SPOT,
  ROD_SPOT,
  ...STICK_PATCHES,
  ...FLOWER_PATCHES,
];

describe('where the reeds grow', () => {
  it('has a handful of patches at every water', () => {
    expect(REED_PATCHES.length).toBeGreaterThanOrEqual(4);
    expect(REED_PATCHES.length).toBeLessThanOrEqual(12);
    for (const spot of REED_PATCHES) expect(spot.item).toBe('reed');
    // The lake and the pond each start with some.
    expect(LAKE_BEDS.length).toBeGreaterThanOrEqual(4);
    expect(POND_BEDS.length).toBeGreaterThanOrEqual(2);
    expect(LAKE_BEDS.length + POND_BEDS.length).toBe(REED_PATCHES.length);
  });

  it('numbers them from 100, clear of the clearing and the forest', () => {
    const ids = REED_PATCHES.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(REED_PATCH_FIRST_ID);
    // The clearing numbers its own from 1; the forest's berries and mushrooms start at 200.
    const clearingIds = STICK_PATCHES.length + FLOWER_PATCHES.length;
    expect(Math.min(...ids)).toBeGreaterThan(clearingIds);
    expect(Math.max(...ids)).toBeLessThan(200);
    // Patch ids are one byte on the wire.
    expect(Math.max(...ids)).toBeLessThanOrEqual(0xff);
  });

  it('keeps the lake beds numbered as they always were, with the pond after them', () => {
    // A world saved before the pond had any loads unchanged: the lake's ids come first.
    expect(LAKE_BEDS.map((bed) => bed.id)).toEqual(
      LAKE_BEDS.map((_, index) => REED_PATCH_FIRST_ID + index),
    );
    expect(POND_BEDS.map((bed) => bed.id)).toEqual(
      POND_BEDS.map((_, index) => REED_PATCH_FIRST_ID + LAKE_BEDS.length + index),
    );
    expect(buildReedPatchSpots([LAKE_WATER])).toEqual(LAKE_BEDS);
  });

  it('knows its own, and only its own', () => {
    for (const spot of REED_PATCHES) expect(isReedPatch(spot.id)).toBe(true);
    expect(isReedPatch(1)).toBe(false);
    expect(isReedPatch(REED_PATCH_FIRST_ID - 1)).toBe(false);
    expect(isReedPatch(REED_PATCH_FIRST_ID + REED_PATCHES.length)).toBe(false);
    expect(isReedPatch(200)).toBe(false);
  });

  it('knows which water each bed belongs to', () => {
    for (const bed of LAKE_BEDS) expect(reedWaterOf(bed.id)?.name).toBe('lake');
    for (const bed of POND_BEDS) expect(reedWaterOf(bed.id)?.name).toBe('pond');
    expect(reedWaterOf(1)).toBeNull();
    expect(reedWaterOf(200)).toBeNull();
  });

  it("stands the lake's in the shallows at the water edge, never out on an island", () => {
    for (const spot of LAKE_BEDS) {
      expect(lakeDepthAt(LAKE, spot.x, spot.z)).toBeGreaterThan(REED_PATCH_DEPTH - 0.05);
      expect(lakeDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(REED_PATCH_DEPTH + 0.05);
      // On the open bank of the lake, not where two of its circles run together.
      expect(basinDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(REED_PATCH_DEPTH + 0.05);
      // And a long way from any island.
      expect(nearestIslandDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(-5);
    }
  });

  it("stands the pond's in the shallows at the water edge, on the open bank", () => {
    for (const spot of POND_BEDS) {
      const depth = outlineDepth(POND, spot.x, spot.z);
      expect(depth).toBeGreaterThan(REED_PATCH_DEPTH - 0.05);
      expect(depth).toBeLessThan(REED_PATCH_DEPTH + 0.05);
    }
  });

  it('spreads them out along each bank, and never lets two beds crowd a press of the button', () => {
    for (const [index, spot] of REED_PATCHES.entries()) {
      for (const other of REED_PATCHES.slice(index + 1)) {
        const apart = Math.hypot(spot.x - other.x, spot.z - other.z);
        expect(apart).toBeGreaterThanOrEqual(PATCH_SPACING);
        if (reedWaterOf(spot.id) === reedWaterOf(other.id)) {
          expect(apart).toBeGreaterThanOrEqual(reedWaterOf(spot.id)!.startSpacing);
        }
      }
    }
  });

  it('keeps every patch inside the world', () => {
    for (const spot of REED_PATCHES) {
      expect(Math.abs(spot.x)).toBeLessThan(PLAYABLE_HALF_EXTENT - 2);
      expect(Math.abs(spot.z)).toBeLessThan(PLAYABLE_HALF_EXTENT - 2);
    }
  });

  it('is the same every time it is worked out', () => {
    expect(buildReedPatchSpots(REED_WATERS)).toEqual(REED_PATCHES);
  });

  it("keeps the pond's beds clear of the rod, the flowers, the sticks and the rest of the clearing", () => {
    for (const bed of POND_BEDS) {
      for (const place of AROUND_THE_POND) {
        expect(Math.hypot(bed.x - place.x, bed.z - place.z)).toBeGreaterThanOrEqual(PATCH_SPACING);
      }
    }
  });

  it('can be reached from the bank without wading in', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const world = createCollisionWorld(terrain, waterColliders(POND), PLAYABLE_HALF_EXTENT, LAKE);
    for (const spot of REED_PATCHES) {
      // Stand right on the reeds: the shore pushes you back to the bank, and the
      // bank is within a hand's reach of where they grow.
      const position = { x: spot.x, y: terrain.heightAt(spot.x, spot.z), z: spot.z };
      resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
      expect(Math.hypot(position.x - spot.x, position.z - spot.z)).toBeLessThan(PICKUP_REACH);
      expect(lakeDepthAt(LAKE, position.x, position.z)).toBeLessThan(0);
      expect(outlineDepth(POND, position.x, position.z)).toBeLessThan(0.01);
    }
  });

  it('leaves no tree growing on a patch', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const { props } = buildWilderness(DEFAULT_WORLD_SEED, terrain);
    for (const spot of REED_PATCHES) {
      for (const prop of props) {
        expect(Math.hypot(prop.x - spot.x, prop.z - spot.z)).toBeGreaterThan(1);
      }
    }
  });
});

describe('everywhere a bed of mature reeds can come back to', () => {
  it('is a good many places, all along each bank', () => {
    expect(REED_SHORE_SPOTS.length).toBeGreaterThan(REED_PATCHES.length * 3);
    for (const water of REED_WATERS) {
      const beds = REED_PATCHES.filter((bed) => reedWaterOf(bed.id) === water);
      expect(reedShoreSpots(water).length).toBeGreaterThan(beds.length * 3);
    }
  });

  it("stands the lake's all in the shallows at the water edge, never out on an island", () => {
    for (const spot of reedShoreSpots(LAKE_WATER)) {
      expect(lakeDepthAt(LAKE, spot.x, spot.z)).toBeGreaterThan(REED_PATCH_DEPTH - 0.05);
      expect(lakeDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(REED_PATCH_DEPTH + 0.05);
      expect(nearestIslandDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(-5);
      expect(Math.abs(spot.x)).toBeLessThan(PLAYABLE_HALF_EXTENT - 2);
      expect(Math.abs(spot.z)).toBeLessThan(PLAYABLE_HALF_EXTENT - 2);
    }
  });

  it("stands the pond's all in the shallows at the water edge, and clear of the clearing's things", () => {
    for (const spot of reedShoreSpots(POND_WATER)) {
      const depth = outlineDepth(POND, spot.x, spot.z);
      expect(depth).toBeGreaterThan(REED_PATCH_DEPTH - 0.05);
      expect(depth).toBeLessThan(REED_PATCH_DEPTH + 0.05);
      for (const place of AROUND_THE_POND) {
        expect(Math.hypot(spot.x - place.x, spot.z - place.z)).toBeGreaterThanOrEqual(
          PATCH_SPACING,
        );
      }
    }
  });

  it('can all be reached from the bank without wading in', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const world = createCollisionWorld(terrain, waterColliders(POND), PLAYABLE_HALF_EXTENT, LAKE);
    for (const spot of REED_SHORE_SPOTS) {
      const position = { x: spot.x, y: terrain.heightAt(spot.x, spot.z), z: spot.z };
      resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
      expect(Math.hypot(position.x - spot.x, position.z - spot.z)).toBeLessThan(PICKUP_REACH);
      expect(lakeDepthAt(LAKE, position.x, position.z)).toBeLessThan(0);
      expect(outlineDepth(POND, position.x, position.z)).toBeLessThan(0.01);
    }
  });

  it('knows its own places, and nothing inland', () => {
    for (const spot of REED_SHORE_SPOTS) expect(isReedSpot(spot.x, spot.z)).toBe(true);
    for (const spot of REED_PATCHES) expect(isReedSpot(spot.x, spot.z)).toBe(true);
    expect(isReedSpot(0, 0)).toBe(false);
  });

  it("only lets a bed stand at the water it belongs to: the pond's never on the lake, nor the lake's at the pond", () => {
    const lakeBed = LAKE_BEDS[0]!;
    const pondBed = POND_BEDS[0]!;
    for (const spot of reedShoreSpots(LAKE_WATER)) {
      expect(isReedSpotFor(lakeBed.id, spot.x, spot.z)).toBe(true);
      expect(isReedSpotFor(pondBed.id, spot.x, spot.z)).toBe(false);
    }
    for (const spot of reedShoreSpots(POND_WATER)) {
      expect(isReedSpotFor(pondBed.id, spot.x, spot.z)).toBe(true);
      expect(isReedSpotFor(lakeBed.id, spot.x, spot.z)).toBe(false);
    }
    expect(isReedSpotFor(1, pondBed.x, pondBed.z)).toBe(false);
    expect(isReedSpotFor(pondBed.id, 0, 0)).toBe(false);
  });

  it('gives every bed its own water spacing, and nothing else any', () => {
    for (const bed of LAKE_BEDS) expect(reedBedSpacing(bed.id)).toBe(LAKE_WATER.bedSpacing);
    for (const bed of POND_BEDS) expect(reedBedSpacing(bed.id)).toBe(POND_WATER.bedSpacing);
    expect(reedBedSpacing(1)).toBe(0);
  });

  it("comes back at its own water, however it is asked, and never on the other's", () => {
    for (const bed of REED_PATCHES) {
      const water = reedWaterOf(bed.id)!;
      const back = reedRegrowSpot(DEFAULT_WORLD_SEED, bed.id, 1, bed, () => true);
      expect(back).not.toBeNull();
      expect(isReedSpotFor(bed.id, back!.x, back!.z)).toBe(true);
      expect(Math.hypot(back!.x - bed.x, back!.z - bed.z)).toBeGreaterThanOrEqual(water.minMove);
    }
  });
});

describe('reed and rope', () => {
  it('are things you carry ten to a slot', () => {
    expect(ITEM_KINDS.reed.stackSize).toBe(10);
    expect(ITEM_KINDS.rope.stackSize).toBe(10);
  });

  it('twists three reeds into a rope, by hand', () => {
    const recipe = recipeFor('rope');
    expect(recipe?.costs).toEqual([{ item: 'reed', amount: 3 }]);
    expect(recipe?.station).toBeUndefined();
  });
});

const built: WorldSimulation[] = [];
let clockMs = 1_700_000_000_000;
const tickClock = (): number => (clockMs += TICK_MILLISECONDS);
let inputNumber = 0;

afterEach(() => {
  for (const sim of built.splice(0)) sim.dispose();
});

function worldWithGatherer(items: Array<{ item: 'bag' | 'reed'; count: number }> = []) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  built.push(sim);
  sim.addPlayer(1, {
    netId: 1,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [{ item: 'bag', count: 1 }, ...items],
    hunger: 100,
  });
  return sim;
}

function reedPatchView(sim: WorldSimulation, id: number) {
  const patch = sim.gatherPatchesList().find((candidate) => candidate.id === id);
  if (patch === undefined) throw new Error(`no patch ${id}`);
  return patch;
}

/** Stand on the bank beside a reed patch and hold E for this many ticks. */
function gatherFor(sim: WorldSimulation, id: number, ticks: number): void {
  const patch = reedPatchView(sim, id);
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  sim.placePlayer(1, { x: patch.x, y: terrain.heightAt(patch.x, patch.z), z: patch.z }, 0);
  for (let tick = 1; tick <= ticks; tick++) {
    // Input numbers only ever go up, however many times this is called on one world.
    sim.queueInput(1, createInput(++inputNumber, 0, 0, 0, PlayerButton.Interact));
    sim.step(tickClock());
  }
}

describe('cutting reeds', () => {
  const first = REED_PATCHES[0]!;

  it('puts every patch in the world, each holding a few', () => {
    const sim = worldWithGatherer();
    for (const spot of REED_PATCHES) {
      const patch = reedPatchView(sim, spot.id);
      expect(patch.item).toBe('reed');
      expect(patch.x).toBeCloseTo(spot.x, 5);
      expect(patch.z).toBeCloseTo(spot.z, 5);
      expect(patch.remaining).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
      expect(patch.remaining).toBeLessThanOrEqual(GATHER_PATCH_MAX_COUNT);
    }
  });

  it('gives one reed for each press and takes one from the patch', () => {
    const sim = worldWithGatherer();
    const before = reedPatchView(sim, first.id).remaining;
    gatherFor(sim, first.id, 1);
    expect(countOf(sim.inventoryOf(1), 'reed')).toBe(1);
    expect(reedPatchView(sim, first.id).remaining).toBe(before - 1);
  });

  it('leaves a patch bare once every reed is cut', () => {
    const sim = worldWithGatherer();
    gatherFor(sim, first.id, 120);
    expect(reedPatchView(sim, first.id).remaining).toBe(0);
    expect(countOf(sim.inventoryOf(1), 'reed')).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
  });

  it('comes back about twenty minutes later, with a fresh few, somewhere else round the shore', () => {
    const sim = worldWithGatherer();
    gatherFor(sim, first.id, 120);
    const bare = reedPatchView(sim, first.id);
    expect(bare.remaining).toBe(0);
    sim.drainPatchChanges();

    const saved = sim.persistedPatch(first.id)!;
    const delay = reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, 0);
    expect(delay).toBeGreaterThanOrEqual(REED_REGROW_MIN_SECONDS * 1000);
    expect(delay).toBeLessThanOrEqual(REED_REGROW_MAX_SECONDS * 1000);
    // The old three-to-six-minute wait is gone: not back after six minutes.
    sim.regrowPatches(saved.emptiedAtMs + 6 * 60 * 1000);
    expect(reedPatchView(sim, first.id).remaining).toBe(0);
    const dueAt = saved.emptiedAtMs + delay;
    sim.regrowPatches(dueAt - 1);
    expect(reedPatchView(sim, first.id).remaining).toBe(0);

    sim.regrowPatches(dueAt);
    const grown = reedPatchView(sim, first.id);
    expect(grown.remaining).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
    expect(grown.remaining).toBeLessThanOrEqual(GATHER_PATCH_MAX_COUNT);
    expect(Math.hypot(grown.x - bare.x, grown.z - bare.z)).toBeGreaterThanOrEqual(
      LAKE_WATER.minMove,
    );
    expect(isReedSpotFor(first.id, grown.x, grown.z)).toBe(true);
    expect(sim.persistedPatch(first.id)?.generation).toBe(1);
    expect(sim.drainPatchChanges()).toEqual([first.id]);
  });

  it('can be cut again where it came back', () => {
    const sim = worldWithGatherer();
    gatherFor(sim, first.id, 120);
    const saved = sim.persistedPatch(first.id)!;
    sim.regrowPatches(saved.emptiedAtMs + reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, 0));
    const grown = reedPatchView(sim, first.id);
    expect(grown.remaining).toBeGreaterThan(0);

    // A few presses, so the pause after the last cut cannot swallow it.
    const carried = countOf(sim.inventoryOf(1), 'reed');
    gatherFor(sim, first.id, 30);
    const cut = countOf(sim.inventoryOf(1), 'reed') - carried;
    expect(cut).toBeGreaterThan(0);
    expect(reedPatchView(sim, first.id).remaining).toBe(grown.remaining - cut);
  });

  it('keeps moving round the shore, never twice running to the same place', () => {
    const sim = worldWithGatherer();
    const seen: Array<{ x: number; z: number }> = [reedPatchView(sim, first.id)];
    for (let generation = 0; generation < 8; generation++) {
      const emptiedAtMs = tickClock();
      sim.restorePatches([
        { ...sim.persistedPatch(first.id)!, remaining: 0, generation, emptiedAtMs },
      ]);
      sim.regrowPatches(emptiedAtMs + reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, generation));
      const grown = reedPatchView(sim, first.id);
      expect(grown.remaining).toBeGreaterThan(0);
      expect(isReedSpot(grown.x, grown.z)).toBe(true);
      const last = seen[seen.length - 1]!;
      expect(Math.hypot(grown.x - last.x, grown.z - last.z)).toBeGreaterThanOrEqual(
        LAKE_WATER.minMove,
      );
      seen.push(grown);
    }
    // Over eight comings back it has been to more than a couple of places.
    expect(
      new Set(seen.map((spot) => `${spot.x.toFixed(2)},${spot.z.toFixed(2)}`)).size,
    ).toBeGreaterThan(3);
  });

  it('keeps clear of every other bed that still has reeds in it', () => {
    const sim = worldWithGatherer();
    for (let generation = 0; generation < 8; generation++) {
      const emptiedAtMs = tickClock();
      sim.restorePatches([
        { ...sim.persistedPatch(first.id)!, remaining: 0, generation, emptiedAtMs },
      ]);
      sim.regrowPatches(emptiedAtMs + reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, generation));
      const grown = reedPatchView(sim, first.id);
      for (const other of REED_PATCHES.slice(1)) {
        const bed = reedPatchView(sim, other.id);
        if (bed.remaining === 0) continue;
        expect(Math.hypot(grown.x - bed.x, grown.z - bed.z)).toBeGreaterThanOrEqual(
          reedBedSpacing(first.id),
        );
      }
    }
  });

  describe("at the clearing's pond", () => {
    const pondFirst = POND_BEDS[0]!;
    const pondOther = POND_BEDS[1]!;

    /** Cut this bed clean, then bring it back and say where it came back to. */
    function cutAndRegrow(sim: WorldSimulation, id: number, generation = 0) {
      const emptiedAtMs = tickClock();
      sim.restorePatches([{ ...sim.persistedPatch(id)!, remaining: 0, generation, emptiedAtMs }]);
      sim.regrowPatches(emptiedAtMs + reedRegrowDelayMs(DEFAULT_WORLD_SEED, id, generation));
      return reedPatchView(sim, id);
    }

    it('starts a few beds in the world, each holding a few', () => {
      const sim = worldWithGatherer();
      for (const spot of POND_BEDS) {
        const patch = reedPatchView(sim, spot.id);
        expect(patch.item).toBe('reed');
        expect(patch.remaining).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
        expect(patch.remaining).toBeLessThanOrEqual(GATHER_PATCH_MAX_COUNT);
      }
    });

    it('can be cut by hand from the bank', () => {
      const sim = worldWithGatherer();
      const before = reedPatchView(sim, pondFirst.id).remaining;
      gatherFor(sim, pondFirst.id, 1);
      expect(countOf(sim.inventoryOf(1), 'reed')).toBe(1);
      expect(reedPatchView(sim, pondFirst.id).remaining).toBe(before - 1);
    });

    it('comes back after the same fifteen to twenty-five minutes, somewhere else round the pond', () => {
      const sim = worldWithGatherer();
      gatherFor(sim, pondFirst.id, 120);
      const bare = reedPatchView(sim, pondFirst.id);
      expect(bare.remaining).toBe(0);

      const saved = sim.persistedPatch(pondFirst.id)!;
      const delay = reedRegrowDelayMs(DEFAULT_WORLD_SEED, pondFirst.id, 0);
      expect(delay).toBeGreaterThanOrEqual(REED_REGROW_MIN_SECONDS * 1000);
      expect(delay).toBeLessThanOrEqual(REED_REGROW_MAX_SECONDS * 1000);
      sim.regrowPatches(saved.emptiedAtMs + delay - 1);
      expect(reedPatchView(sim, pondFirst.id).remaining).toBe(0);

      sim.regrowPatches(saved.emptiedAtMs + delay);
      const grown = reedPatchView(sim, pondFirst.id);
      expect(grown.remaining).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
      expect(Math.hypot(grown.x - bare.x, grown.z - bare.z)).toBeGreaterThanOrEqual(
        POND_WATER.minMove,
      );
      expect(isReedSpotFor(pondFirst.id, grown.x, grown.z)).toBe(true);
    });

    it('always comes back at the pond, never at the lake', () => {
      const sim = worldWithGatherer();
      for (let generation = 0; generation < 10; generation++) {
        const grown = cutAndRegrow(sim, pondFirst.id, generation);
        expect(grown.remaining).toBeGreaterThan(0);
        expect(outlineDepth(POND, grown.x, grown.z)).toBeGreaterThan(REED_PATCH_DEPTH - 0.05);
        expect(lakeDepthAt(LAKE, grown.x, grown.z)).toBeLessThan(0);
      }
    });

    it("and the lake's beds never come back at the pond", () => {
      const sim = worldWithGatherer();
      for (let generation = 0; generation < 10; generation++) {
        const grown = cutAndRegrow(sim, first.id, generation);
        expect(grown.remaining).toBeGreaterThan(0);
        expect(lakeDepthAt(LAKE, grown.x, grown.z)).toBeGreaterThan(0);
      }
    });

    it('keeps clear of the other pond bed while it still has reeds, and of everything the clearing lays out', () => {
      // Wider than the gap that keeps any two things apart, or this would prove nothing.
      expect(POND_WATER.bedSpacing).toBeGreaterThan(PATCH_SPACING);
      const sim = worldWithGatherer();
      // Two of the pond's places are only four or five metres from the other bed, so
      // it takes a good many comings back for the wider gap to be what turns one away.
      for (let generation = 0; generation < 60; generation++) {
        const grown = cutAndRegrow(sim, pondFirst.id, generation);
        const other = reedPatchView(sim, pondOther.id);
        expect(other.remaining).toBeGreaterThan(0);
        expect(Math.hypot(grown.x - other.x, grown.z - other.z)).toBeGreaterThanOrEqual(
          POND_WATER.bedSpacing,
        );
        for (const place of AROUND_THE_POND) {
          expect(Math.hypot(grown.x - place.x, grown.z - place.z)).toBeGreaterThanOrEqual(
            PATCH_SPACING,
          );
        }
      }
    });

    it('is not put where somebody has left a dropped pile, so one press of the button never means two things', () => {
      const learn = worldWithGatherer();
      const where = cutAndRegrow(learn, pondFirst.id);

      const sim = worldWithGatherer();
      sim.restoreDroppedPiles(
        [{ id: 1, item: 'stick', count: 1, x: where.x, z: where.z, droppedAtMs: clockMs }],
        clockMs,
      );
      const grown = cutAndRegrow(sim, pondFirst.id);
      expect(grown.remaining).toBeGreaterThan(0);
      expect(Math.hypot(grown.x - where.x, grown.z - where.z)).toBeGreaterThanOrEqual(
        PATCH_SPACING,
      );
    });

    it('is remembered across a restart, and a row saved at the lake for a pond bed is not believed', () => {
      const sim = worldWithGatherer();
      const moved = cutAndRegrow(sim, pondFirst.id);
      const saved = sim.persistedPatch(pondFirst.id)!;

      const later = worldWithGatherer();
      later.restorePatches([saved]);
      expect(reedPatchView(later, pondFirst.id)).toEqual(moved);

      const lakeSpot = reedShoreSpots(LAKE_WATER)[0]!;
      const bad = worldWithGatherer();
      bad.restorePatches([{ ...saved, x: lakeSpot.x, z: lakeSpot.z }]);
      expect(reedPatchView(bad, pondFirst.id).x).toBeCloseTo(pondFirst.x, 5);
      expect(reedPatchView(bad, pondFirst.id).z).toBeCloseTo(pondFirst.z, 5);
    });

    it('stops a boat being moored on a pond bed, the same as a lake one', () => {
      const sim = worldWithGatherer();
      const beds = sim
        .gatherPatchesList()
        .filter((patch) => isReedPatch(patch.id) && patch.remaining > 0);
      const footprints = reedFootprints(beds);
      expect(footprints).toHaveLength(REED_PATCHES.length);
      for (const bed of POND_BEDS) {
        expect(footprints.some((f) => f.x === bed.x && f.z === bed.z)).toBe(true);
      }
    });
  });

  it('comes back at the same time for everybody: the wait is worked out from the seed', () => {
    const delays = [0, 1, 2, 3].map((generation) =>
      reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, generation),
    );
    expect(delays).toEqual(
      [0, 1, 2, 3].map((generation) => reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, generation)),
    );
    // Random, not the same every time.
    expect(new Set(delays).size).toBeGreaterThan(1);
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(15 * 60 * 1000);
      expect(delay).toBeLessThanOrEqual(25 * 60 * 1000);
    }
  });

  it('is turned down for previews, the same way the other timers are', () => {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, reedRegrowMinSeconds: 30 });
    built.push(sim);
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [{ item: 'bag', count: 1 }],
      hunger: 100,
    });
    gatherFor(sim, first.id, 120);
    const saved = sim.persistedPatch(first.id)!;
    const delay = reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, 0, 30);
    expect(delay).toBeGreaterThanOrEqual(30_000);
    expect(delay).toBeLessThanOrEqual(50_000);
    sim.regrowPatches(saved.emptiedAtMs + delay);
    expect(reedPatchView(sim, first.id).remaining).toBeGreaterThan(0);
  });

  it('stays where it grew when the whole shore is taken', () => {
    expect(reedRegrowSpot(DEFAULT_WORLD_SEED, first.id, 1, first, () => false)).toBeNull();
  });

  it('is remembered across a restart', () => {
    const sim = worldWithGatherer();
    gatherFor(sim, first.id, 10);
    const saved = REED_PATCHES.map((spot) => sim.persistedPatch(spot.id)!);

    const later = worldWithGatherer();
    later.restorePatches(saved);
    expect(later.gatherPatchesList()).toEqual(sim.gatherPatchesList());
  });

  it('remembers where a bed came back to, and ignores a bed saved somewhere it cannot grow', () => {
    const sim = worldWithGatherer();
    gatherFor(sim, first.id, 120);
    sim.regrowPatches(
      sim.persistedPatch(first.id)!.emptiedAtMs +
        reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, 0),
    );
    const moved = reedPatchView(sim, first.id);
    const saved = sim.persistedPatch(first.id)!;

    const later = worldWithGatherer();
    later.restorePatches([saved]);
    expect(reedPatchView(later, first.id)).toEqual(moved);

    // A row with the bed standing on dry land is not believed.
    const bad = worldWithGatherer();
    bad.restorePatches([{ ...saved, x: 0, z: 0 }]);
    expect(reedPatchView(bad, first.id).x).toBeCloseTo(first.x, 5);
    expect(reedPatchView(bad, first.id).z).toBeCloseTo(first.z, 5);
  });

  it('stops a boat being moored on a bed where it stands now, and not where it stood', () => {
    const sim = worldWithGatherer();
    gatherFor(sim, first.id, 120);
    const before = reedPatchView(sim, first.id);
    sim.regrowPatches(
      sim.persistedPatch(first.id)!.emptiedAtMs +
        reedRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, 0),
    );
    const after = reedPatchView(sim, first.id);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);

    const beds = sim
      .gatherPatchesList()
      .filter((patch) => isReedPatch(patch.id) && patch.remaining > 0);
    const footprints = reedFootprints(beds);
    expect(footprints).toHaveLength(beds.length);
    expect(footprints.some((footprint) => footprint.x === after.x && footprint.z === after.z)).toBe(
      true,
    );
    expect(
      footprints.some((footprint) => footprint.x === before.x && footprint.z === before.z),
    ).toBe(false);
  });

  it('twists three reeds into one rope', () => {
    const sim = worldWithGatherer([{ item: 'reed', count: 3 }]);
    expect(sim.craftItem(1, 'rope')).toBe(true);
    expect(countOf(sim.inventoryOf(1), 'rope')).toBe(1);
    expect(countOf(sim.inventoryOf(1), 'reed')).toBe(0);
  });

  it('will not twist a rope from two', () => {
    const sim = worldWithGatherer([{ item: 'reed', count: 2 }]);
    expect(sim.craftItem(1, 'rope')).toBe(false);
    expect(countOf(sim.inventoryOf(1), 'rope')).toBe(0);
    expect(countOf(sim.inventoryOf(1), 'reed')).toBe(2);
  });

  it("adds to the clearing's own patches and leaves them be", () => {
    const sim = worldWithGatherer();
    const ids = sim.gatherPatchesList().map((patch) => patch.id);
    for (const id of [1, 2, 3, 4]) expect(ids).toContain(id);
    expect(ids.length).toBeGreaterThanOrEqual(4 + REED_PATCHES.length);
  });
});
