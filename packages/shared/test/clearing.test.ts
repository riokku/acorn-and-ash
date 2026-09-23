import { describe, expect, it } from 'vitest';

import {
  CLEARING_HALF,
  CLEARING_TREE_LINE_OUTER,
  SPAWN_POSITION,
  PLAYER_RADIUS,
} from '../src/constants';
import { FLOWER_PATCHES, STICK_PATCHES, buildTestClearing } from '../src/world/clearing';

describe('the test clearing', () => {
  it('is identical every time it is built from the same seed', () => {
    const a = buildTestClearing(4242);
    const b = buildTestClearing(4242);
    expect(a.props).toEqual(b.props);
  });

  it('changes when the seed changes', () => {
    const a = buildTestClearing(1);
    const b = buildTestClearing(2);
    expect(a.props).not.toEqual(b.props);
  });

  it('leaves the spawn point clear', () => {
    const { colliders } = buildTestClearing(4242);
    for (const collider of colliders) {
      const dx = collider.x - SPAWN_POSITION.x;
      const dz = collider.z - SPAWN_POSITION.z;
      const gap = Math.sqrt(dx * dx + dz * dz);
      const footprint = collider.shape === 'cylinder' ? collider.radius : 0;
      expect(gap - footprint).toBeGreaterThan(PLAYER_RADIUS);
    }
  });

  it('gives every prop a collider and a unique id, and walls the water', () => {
    const { props, colliders, water } = buildTestClearing(4242);
    expect(colliders).toHaveLength(props.length + water.length);
    expect(new Set(props.map((prop) => prop.id)).size).toBe(props.length);
  });

  it('keeps every prop inside the hand-built clearing, whatever the wilderness beyond it does', () => {
    const { props } = buildTestClearing(4242);
    expect(props.length).toBeGreaterThan(100);
    for (const prop of props) {
      expect(Math.hypot(prop.x, prop.z)).toBeLessThanOrEqual(CLEARING_TREE_LINE_OUTER + 3);
    }
  });

  it('rings the edge of the 64 m clearing with trees', () => {
    const { props } = buildTestClearing(4242);
    const onTheEdge = props.filter((prop) => Math.hypot(prop.x, prop.z) > CLEARING_HALF - 5);
    expect(onTheEdge.length).toBeGreaterThan(100);
  });
});

describe('the gather spots', () => {
  const expectedSpots = [
    ...STICK_PATCHES.map((spot) => ({ ...spot, item: 'stick' })),
    ...FLOWER_PATCHES.map((spot) => ({ ...spot, item: 'flower' })),
  ];

  it('carries the stick and flower patches, so every client agrees where they are', () => {
    const { gatherSpots } = buildTestClearing(4242);
    expect(gatherSpots).toEqual(expectedSpots);
  });

  it('is in the same place for every seed, so it can always be found', () => {
    for (const seed of [1, 99, 0x4143_4f52]) {
      expect(buildTestClearing(seed).gatherSpots).toEqual(expectedSpots);
    }
  });

  it('keeps a scattered rock from landing on top of one', () => {
    const { props, gatherSpots } = buildTestClearing(4242);
    for (const spot of gatherSpots) {
      const onTopOfIt = props.some((prop) => Math.hypot(prop.x - spot.x, prop.z - spot.z) < 0.5);
      expect(onTopOfIt).toBe(false);
    }
  });
});
