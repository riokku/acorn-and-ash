import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/recipes';
import { ITEM_KINDS, ITEM_ORDER } from '../src/data/items';
import { MOUNTAINS } from '../src/constants';
import { createWildernessTerrain } from '../src/world/terrain';
import {
  buildMountainRockSpots,
  isMountainPatch,
  MOUNTAIN_ORE_PILES,
  MOUNTAIN_PATCH_LAST_ID,
  MOUNTAIN_STONE_PILES,
} from '../src/world/mountain-rocks';
import { mountainWeight } from '../src/world/mountains';
import { nearStream, STREAM } from '../src/world/stream';

const SEEDS = [1, 7, 12345];

describe('mountain stone and ore', () => {
  it('lays out every pile, stone then ore, with ids that fit in a byte', () => {
    for (const seed of SEEDS) {
      const spots = buildMountainRockSpots(seed, createWildernessTerrain(seed));
      expect(spots.filter((s) => s.item === 'stone')).toHaveLength(MOUNTAIN_STONE_PILES);
      expect(spots.filter((s) => s.item === 'ironOre')).toHaveLength(MOUNTAIN_ORE_PILES);
      expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
      for (const spot of spots) {
        expect(isMountainPatch(spot.id)).toBe(true);
        expect(spot.id).toBeLessThanOrEqual(MOUNTAIN_PATCH_LAST_ID);
      }
    }
  });

  it('is the same every time for one seed', () => {
    const terrain = createWildernessTerrain(7);
    expect(buildMountainRockSpots(7, terrain)).toEqual(buildMountainRockSpots(7, terrain));
  });

  it('keeps piles on the range, out of the stream, and ore above the stone', () => {
    for (const seed of SEEDS) {
      const terrain = createWildernessTerrain(seed);
      for (const spot of buildMountainRockSpots(seed, terrain)) {
        expect(mountainWeight(spot.x, spot.z)).toBeGreaterThan(0);
        expect(nearStream(STREAM, spot.x, spot.z, 2)).toBe(false);
        const height = terrain.heightAt(spot.x, spot.z);
        if (spot.item === 'ironOre') expect(height).toBeGreaterThan(MOUNTAINS.treeLine - 9);
        else expect(height).toBeLessThan(MOUNTAINS.treeLine);
      }
    }
  });

  it('adds stone, ore and the shovel at the end of the wire order', () => {
    expect(ITEM_ORDER.slice(-3)).toEqual(['stone', 'ironOre', 'shovel']);
  });

  it('makes a shovel from sticks and stone by hand', () => {
    expect(RECIPES.shovel).toEqual({
      result: 'shovel',
      costs: [
        { item: 'stick', amount: 2 },
        { item: 'stone', amount: 3 },
      ],
    });
    expect(ITEM_KINDS.shovel.maxCarry).toBe(1);
  });
});
