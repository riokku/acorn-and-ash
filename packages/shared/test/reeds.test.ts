import { afterEach, describe, expect, it } from 'vitest';

import { createCollisionWorld, resolveCapsule } from '../src/collision/capsule';
import {
  DEFAULT_WORLD_SEED,
  GATHER_PATCH_MAX_COUNT,
  GATHER_PATCH_MIN_COUNT,
  PICKUP_REACH,
  PLAYABLE_HALF_EXTENT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  TICK_MILLISECONDS,
} from '../src/constants';
import { ITEM_KINDS } from '../src/data/items';
import { recipeFor } from '../src/data/recipes';
import { PlayerButton, createInput } from '../src/sim/player';
import { patchRegrowDelayMs } from '../src/sim/gathering';
import { countOf } from '../src/sim/inventory';
import { WorldSimulation } from '../src/sim/world-sim';
import { buildWilderness } from '../src/world/wilderness';
import { createWildernessTerrain } from '../src/world/terrain';
import { LAKE, lakeDepthAt, basinDepthAt, nearestIslandDepthAt } from '../src/world/lake';
import { STICK_PATCHES, FLOWER_PATCHES } from '../src/world/clearing';
import {
  REED_PATCHES,
  REED_PATCH_DEPTH,
  REED_PATCH_FIRST_ID,
  REED_PATCH_SPACING,
  buildReedPatchSpots,
  isReedPatch,
} from '../src/world/reeds';

describe('where the reeds grow', () => {
  it('has a handful of patches round the bank', () => {
    expect(REED_PATCHES.length).toBeGreaterThanOrEqual(4);
    expect(REED_PATCHES.length).toBeLessThanOrEqual(12);
    for (const spot of REED_PATCHES) expect(spot.item).toBe('reed');
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

  it('knows its own, and only its own', () => {
    for (const spot of REED_PATCHES) expect(isReedPatch(spot.id)).toBe(true);
    expect(isReedPatch(1)).toBe(false);
    expect(isReedPatch(REED_PATCH_FIRST_ID - 1)).toBe(false);
    expect(isReedPatch(REED_PATCH_FIRST_ID + REED_PATCHES.length)).toBe(false);
    expect(isReedPatch(200)).toBe(false);
  });

  it('stands them in the shallows at the water edge, never out on an island', () => {
    for (const spot of REED_PATCHES) {
      expect(lakeDepthAt(LAKE, spot.x, spot.z)).toBeGreaterThan(REED_PATCH_DEPTH - 0.05);
      expect(lakeDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(REED_PATCH_DEPTH + 0.05);
      // On the open bank of the lake, not where two of its circles run together.
      expect(basinDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(REED_PATCH_DEPTH + 0.05);
      // And a long way from any island.
      expect(nearestIslandDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(-5);
    }
  });

  it('spreads them out along the bank', () => {
    for (const [index, spot] of REED_PATCHES.entries()) {
      for (const other of REED_PATCHES.slice(index + 1)) {
        expect(Math.hypot(spot.x - other.x, spot.z - other.z)).toBeGreaterThanOrEqual(
          REED_PATCH_SPACING,
        );
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
    expect(buildReedPatchSpots(LAKE)).toEqual(REED_PATCHES);
  });

  it('can be reached from the bank without wading in', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const world = createCollisionWorld(terrain, [], PLAYABLE_HALF_EXTENT, LAKE);
    for (const spot of REED_PATCHES) {
      // Stand right on the reeds: the shore pushes you back to the bank, and the
      // bank is within a hand's reach of where they grow.
      const position = { x: spot.x, y: terrain.heightAt(spot.x, spot.z), z: spot.z };
      resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
      expect(Math.hypot(position.x - spot.x, position.z - spot.z)).toBeLessThan(PICKUP_REACH);
      expect(lakeDepthAt(LAKE, position.x, position.z)).toBeLessThan(0);
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
    sim.queueInput(1, createInput(tick, 0, 0, 0, PlayerButton.Interact));
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

  it('grows back where it stood, a few minutes later, with a fresh few', () => {
    const sim = worldWithGatherer();
    gatherFor(sim, first.id, 120);
    const bare = reedPatchView(sim, first.id);
    expect(bare.remaining).toBe(0);
    sim.drainPatchChanges();

    const saved = sim.persistedPatch(first.id)!;
    const dueAt = saved.emptiedAtMs + patchRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, 0);
    sim.regrowPatches(dueAt - 1);
    expect(reedPatchView(sim, first.id).remaining).toBe(0);

    sim.regrowPatches(dueAt);
    const grown = reedPatchView(sim, first.id);
    expect(grown.remaining).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
    expect(grown.remaining).toBeLessThanOrEqual(GATHER_PATCH_MAX_COUNT);
    expect(grown.x).toBe(bare.x);
    expect(grown.z).toBe(bare.z);
    expect(sim.persistedPatch(first.id)?.generation).toBe(1);
    expect(sim.drainPatchChanges()).toEqual([first.id]);
  });

  it('never wanders, however many times it is cut and grows back', () => {
    const sim = worldWithGatherer();
    const home = reedPatchView(sim, first.id);
    for (let generation = 0; generation < 8; generation++) {
      const emptiedAtMs = tickClock();
      sim.restorePatches([
        { ...sim.persistedPatch(first.id)!, remaining: 0, generation, emptiedAtMs },
      ]);
      sim.regrowPatches(emptiedAtMs + patchRegrowDelayMs(DEFAULT_WORLD_SEED, first.id, generation));
      const grown = reedPatchView(sim, first.id);
      expect(grown.remaining).toBeGreaterThan(0);
      expect(grown.x).toBe(home.x);
      expect(grown.z).toBe(home.z);
    }
  });

  it('is remembered across a restart', () => {
    const sim = worldWithGatherer();
    gatherFor(sim, first.id, 10);
    const saved = REED_PATCHES.map((spot) => sim.persistedPatch(spot.id)!);

    const later = worldWithGatherer();
    later.restorePatches(saved);
    expect(later.gatherPatchesList()).toEqual(sim.gatherPatchesList());
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
