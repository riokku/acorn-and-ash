import { describe, expect, it } from 'vitest';
import { PROP_KINDS, propHeight, propKindIndex } from '../src/data/props';
import { buildTestClearing } from '../src/world/clearing';
import { buildWilderness } from '../src/world/wilderness';
import { createFlatTerrain } from '../src/world/terrain';
import {
  treeFallTimes,
  treeFallAngle,
  treeLogSpots,
  TREE_FALL_SECONDS,
  TREE_BREAK_SECONDS,
} from '../src/sim/tree-fall';

describe('Pacific Northwest tree stature', () => {
  it('keeps saved kind indices while replacing the visible species', () => {
    expect([
      PROP_KINDS.pine.displayName,
      PROP_KINDS.birch.displayName,
      PROP_KINDS.oak.displayName,
    ]).toEqual(['Douglas-fir', 'Western redcedar', 'Sitka spruce']);
    expect(
      ['pine', 'birch', 'oak'].map((id) => propKindIndex(id as 'pine' | 'birch' | 'oak')),
    ).toEqual([0, 1, 2]);
  });
  it('mixes mature giants with ordinary trees in both the ring and deeper woods', () => {
    const clearing = buildTestClearing(4242);
    const wilderness = buildWilderness(4242, createFlatTerrain());
    for (const props of [clearing.props, wilderness.props]) {
      const trees = props.filter((p) => PROP_KINDS[p.kind].shape.family === 'tree');
      const heights = trees.map((p) => propHeight(PROP_KINDS[p.kind]) * p.scale);
      expect(Math.max(...heights)).toBeGreaterThan(28);
      expect(heights.filter((h) => h < 20).length).toBeGreaterThan(trees.length / 2);
    }
    expect(buildTestClearing(4242).props).toEqual(clearing.props);
    expect(buildWilderness(4242, createFlatTerrain()).props).toEqual(wilderness.props);
  });
  it('shares slower mature falls while keeping collectible wood close to the trunk', () => {
    const tree = { id: 1, kind: 'oak' as const, x: 0, z: 0, scale: 2, rotationY: 0 };
    const times = treeFallTimes(tree);
    expect(times.fall).toBeGreaterThan(TREE_FALL_SECONDS);
    expect(times.break - times.fall).toBeCloseTo(0.4);
    expect(treeFallAngle(times.fall, times.fall)).toBeCloseTo(Math.PI / 2);
    expect(treeFallAngle(times.break, times.fall)).toBeCloseTo(Math.PI / 2);
    const spots = treeLogSpots(tree, Math.PI / 3);
    expect(spots).toHaveLength(PROP_KINDS.oak.chopping.logs);
    expect(spots.every((p) => Math.hypot(p.x, p.z) < 7)).toBe(true);
    expect(treeFallTimes({ ...tree, scale: 1 })).toEqual({
      fall: TREE_FALL_SECONDS,
      break: TREE_BREAK_SECONDS,
    });
  });
});
