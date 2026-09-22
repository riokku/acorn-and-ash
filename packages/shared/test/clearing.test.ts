import { describe, expect, it } from 'vitest';

import {
  CLEARING_HALF,
  PLAYABLE_HALF_EXTENT,
  SPAWN_POSITION,
  PLAYER_RADIUS,
} from '../src/constants';
import { buildTestClearing } from '../src/world/clearing';

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

  it('keeps every prop inside the walled-off area', () => {
    const { props } = buildTestClearing(4242);
    expect(props.length).toBeGreaterThan(100);
    for (const prop of props) {
      expect(Math.hypot(prop.x, prop.z)).toBeLessThanOrEqual(PLAYABLE_HALF_EXTENT + 3);
    }
  });

  it('rings the edge of the 64 m clearing with trees', () => {
    const { props } = buildTestClearing(4242);
    const onTheEdge = props.filter((prop) => Math.hypot(prop.x, prop.z) > CLEARING_HALF - 5);
    expect(onTheEdge.length).toBeGreaterThan(100);
  });
});
