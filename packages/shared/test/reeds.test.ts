import { afterEach, describe, expect, it } from 'vitest';

import { createCollisionWorld, resolveCapsule } from '../src/collision/capsule';
import {
  DEFAULT_WORLD_SEED,
  GATHER_PATCH_MAX_COUNT,
  GATHER_PATCH_MIN_COUNT,
  PICKUP_REACH,
  PLAYABLE_HALF_EXTENT,
  REED_REGROW_MAX_SECONDS,
  REED_REGROW_MIN_SECONDS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
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
import { STICK_PATCHES, FLOWER_PATCHES } from '../src/world/clearing';
import {
  REED_BED_SPACING,
  REED_MIN_MOVE,
  REED_PATCHES,
  REED_PATCH_DEPTH,
  REED_PATCH_FIRST_ID,
  REED_PATCH_SPACING,
  REED_SHORE_SPOTS,
  buildReedPatchSpots,
  isReedPatch,
  isReedSpot,
  reedRegrowDelayMs,
  reedRegrowSpot,
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

describe('everywhere a bed of mature reeds can come back to', () => {
  it('is a good many places, all along the bank', () => {
    expect(REED_SHORE_SPOTS.length).toBeGreaterThan(REED_PATCHES.length * 3);
  });

  it('stands them all in the shallows at the water edge, never out on an island', () => {
    for (const spot of REED_SHORE_SPOTS) {
      expect(lakeDepthAt(LAKE, spot.x, spot.z)).toBeGreaterThan(REED_PATCH_DEPTH - 0.05);
      expect(lakeDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(REED_PATCH_DEPTH + 0.05);
      expect(nearestIslandDepthAt(LAKE, spot.x, spot.z)).toBeLessThan(-5);
      expect(Math.abs(spot.x)).toBeLessThan(PLAYABLE_HALF_EXTENT - 2);
      expect(Math.abs(spot.z)).toBeLessThan(PLAYABLE_HALF_EXTENT - 2);
    }
  });

  it('can all be reached from the bank without wading in', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const world = createCollisionWorld(terrain, [], PLAYABLE_HALF_EXTENT, LAKE);
    for (const spot of REED_SHORE_SPOTS) {
      const position = { x: spot.x, y: terrain.heightAt(spot.x, spot.z), z: spot.z };
      resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
      expect(Math.hypot(position.x - spot.x, position.z - spot.z)).toBeLessThan(PICKUP_REACH);
      expect(lakeDepthAt(LAKE, position.x, position.z)).toBeLessThan(0);
    }
  });

  it('knows its own places, and nothing inland', () => {
    for (const spot of REED_SHORE_SPOTS) expect(isReedSpot(spot.x, spot.z)).toBe(true);
    for (const spot of REED_PATCHES) expect(isReedSpot(spot.x, spot.z)).toBe(true);
    expect(isReedSpot(0, 0)).toBe(false);
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
    expect(Math.hypot(grown.x - bare.x, grown.z - bare.z)).toBeGreaterThanOrEqual(REED_MIN_MOVE);
    expect(isReedSpot(grown.x, grown.z)).toBe(true);
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
      expect(Math.hypot(grown.x - last.x, grown.z - last.z)).toBeGreaterThanOrEqual(REED_MIN_MOVE);
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
          REED_BED_SPACING,
        );
      }
    }
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
