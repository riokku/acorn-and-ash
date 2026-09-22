import { describe, expect, it } from 'vitest';

import { PLAYABLE_HALF_EXTENT, WILDERNESS } from '../src/constants';
import { PROP_KINDS } from '../src/data/props';
import { createFlatTerrain, createWildernessTerrain } from '../src/world/terrain';
import { buildWilderness } from '../src/world/wilderness';

const TREE_OR_ROCK_KINDS = new Set(['pine', 'birch', 'oak', 'boulder', 'mossyRock']);

describe('the generated wilderness', () => {
  it('is identical every time it is built from the same seed', () => {
    const terrain = createWildernessTerrain(4242);
    const a = buildWilderness(4242, terrain);
    const b = buildWilderness(4242, terrain);
    expect(a.props).toEqual(b.props);
  });

  it('changes when the seed changes', () => {
    const a = buildWilderness(1, createWildernessTerrain(1));
    const b = buildWilderness(2, createWildernessTerrain(2));
    expect(a.props).not.toEqual(b.props);
  });

  it('is a real forest, not an empty one, but does not run away with itself', () => {
    const { props } = buildWilderness(4242, createWildernessTerrain(4242));
    // A rough sanity band: dense enough to explore, not so dense it threatens
    // the collision loop's "cheap array scan" budget (see docs/decisions/0003).
    expect(props.length).toBeGreaterThan(200);
    expect(props.length).toBeLessThan(4000);
  });

  it('never places anything inside the hand-built clearing or its tree line', () => {
    const { props } = buildWilderness(4242, createWildernessTerrain(4242));
    for (const prop of props) {
      expect(Math.hypot(prop.x, prop.z)).toBeGreaterThanOrEqual(WILDERNESS.flatRadius);
    }
  });

  it('never places anything far past the wall at the edge of the world', () => {
    const { props } = buildWilderness(4242, createWildernessTerrain(4242));
    const outerRadius = PLAYABLE_HALF_EXTENT + WILDERNESS.scatterMargin;
    for (const prop of props) {
      expect(Math.hypot(prop.x, prop.z)).toBeLessThanOrEqual(outerRadius);
    }
  });

  it('only ever places trees and rocks the game already knows how to draw', () => {
    const { props } = buildWilderness(4242, createWildernessTerrain(4242));
    for (const prop of props) {
      expect(TREE_OR_ROCK_KINDS.has(prop.kind)).toBe(true);
      expect(PROP_KINDS[prop.kind]).toBeDefined();
    }
  });

  it('gives every prop a unique id and a matching collider', () => {
    const { props, colliders } = buildWilderness(4242, createWildernessTerrain(4242));
    expect(colliders).toHaveLength(props.length);
    expect(new Set(props.map((prop) => prop.id)).size).toBe(props.length);
  });

  it('sits on the terrain it was built with', () => {
    const terrain = createWildernessTerrain(4242);
    const { props } = buildWilderness(4242, terrain);
    for (const prop of props.slice(0, 25)) {
      expect(prop.y).toBe(terrain.heightAt(prop.x, prop.z));
    }
  });

  it('sits flat when built with flat terrain', () => {
    const { props } = buildWilderness(4242, createFlatTerrain(0));
    expect(props.length).toBeGreaterThan(0);
    for (const prop of props) expect(prop.y).toBe(0);
  });
});
