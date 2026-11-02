import { beforeAll, describe, expect, it } from 'vitest';

import { WILDERNESS } from '../src/constants';
import { PROP_KINDS } from '../src/data/props';
import { buildDeadwood, type DeadwoodPiece } from '../src/world/deadwood';
import { basinDepthAt, LAKE } from '../src/world/lake';
import { nearStream, STREAM } from '../src/world/stream';
import { createWildernessTerrain, type Terrain } from '../src/world/terrain';
import { buildWilderness, type Wilderness } from '../src/world/wilderness';

const SEED = 4242;
let terrain: Terrain;
let wilderness: Wilderness;
let pieces: DeadwoodPiece[];

beforeAll(() => {
  terrain = createWildernessTerrain(SEED);
  wilderness = buildWilderness(SEED, terrain);
  pieces = buildDeadwood(SEED, terrain, wilderness);
});

describe('dead wood in the wilderness', () => {
  it('is the same every time it is built from the same seed', () => {
    expect(buildDeadwood(SEED, terrain, wilderness)).toEqual(pieces);
  });

  it('scatters a modest amount of every kind', () => {
    expect(pieces.length).toBeGreaterThan(60);
    expect(pieces.length).toBeLessThan(600);
    for (const kind of ['deadTree', 'fallenLog', 'treeRoots'])
      expect(pieces.some((piece) => piece.kind === kind)).toBe(true);
  });

  it('stays out of the clearing, the water and every trunk and rock', () => {
    for (const piece of pieces) {
      expect(Math.hypot(piece.x, piece.z)).toBeGreaterThan(WILDERNESS.flatRadius);
      expect(basinDepthAt(LAKE, piece.x, piece.z)).toBeLessThan(0);
      expect(nearStream(STREAM, piece.x, piece.z, 1)).toBe(false);
    }
    const inside = pieces.filter((piece) =>
      wilderness.props.some(
        (prop) =>
          Math.hypot(piece.x - prop.x, piece.z - prop.z) <
          PROP_KINDS[prop.kind].colliderRadius * prop.scale,
      ),
    );
    expect(inside).toEqual([]);
  });

  it('sits on the ground where it lies', () => {
    for (const piece of pieces) expect(piece.y).toBeCloseTo(terrain.heightAt(piece.x, piece.z), 5);
  });

  it('keeps away from the places it is told to', () => {
    const site = { x: pieces[0]!.x, z: pieces[0]!.z, radius: 10 };
    const kept = buildDeadwood(SEED, terrain, wilderness, [site]);
    expect(kept.length).toBeLessThan(pieces.length);
    for (const piece of kept)
      expect(Math.hypot(piece.x - site.x, piece.z - site.z)).toBeGreaterThan(site.radius);
  });

  it('is quick enough to build while the world loads', () => {
    const start = performance.now();
    buildDeadwood(SEED, terrain, wilderness);
    expect(performance.now() - start).toBeLessThan(250);
  });
});
