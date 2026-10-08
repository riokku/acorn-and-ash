import { describe, expect, it } from 'vitest';

import { PLAYER_RADIUS } from '../src/constants';
import { createCollisionWorld } from '../src/collision/capsule';
import {
  MAX_WALKABLE_GRADIENT,
  MOUNTAINS,
  PLAYABLE_HALF_EXTENT,
  WILDERNESS,
} from '../src/constants';
import { createInput, createPlayerMotion, PlayerButton, stepPlayer } from '../src/sim/player';
import { buildWilderness } from '../src/world/wilderness';
import { createWildernessTerrain, type Terrain } from '../src/world/terrain';
import { mountainHeightAt, mountainWeight } from '../src/world/mountains';

const SEED = 1234;
const terrain = createWildernessTerrain(SEED);

/** The highest ground that can be reached on foot from the hills below the range, by a flood fill. */
function highestWalkableGround(ground: Terrain, from: { x: number; z: number }): number {
  const step = 2;
  const key = (i: number, j: number): number => i * 1000 + j;
  const start: [number, number] = [Math.round(from.x / step), Math.round(from.z / step)];
  const seen = new Set<number>([key(...start)]);
  const open: [number, number][] = [start];
  let best = 0;
  while (open.length > 0) {
    const [i, j] = open.pop()!;
    const here = ground.heightAt(i * step, j * step);
    best = Math.max(best, here);
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const ni = i + di;
      const nj = j + dj;
      const x = ni * step;
      const z = nj * step;
      if (Math.abs(x) > PLAYABLE_HALF_EXTENT || Math.abs(z) > PLAYABLE_HALF_EXTENT) continue;
      if (seen.has(key(ni, nj))) continue;
      if (ground.heightAt(x, z) - here > MAX_WALKABLE_GRADIENT * step) continue;
      seen.add(key(ni, nj));
      open.push([ni, nj]);
    }
  }
  return best;
}

describe('the mountain range', () => {
  it('leaves the ground outside its foot exactly as the hills made it', () => {
    expect(mountainWeight(0, 0)).toBe(0);
    expect(mountainHeightAt(SEED, 0, 0)).toBe(0);
    expect(mountainHeightAt(SEED, 88, -88)).toBe(0);
  });

  it('stands far from the home clearing, in the south-west', () => {
    const { ridgeStart, ridgeEnd } = MOUNTAINS;
    for (const end of [ridgeStart, ridgeEnd]) {
      expect(end.x).toBeLessThan(0);
      expect(end.z).toBeGreaterThan(0);
    }
    // Nowhere near the clearing's own 64 m square.
    expect(mountainWeight(40, 40)).toBe(0);
    expect(Math.hypot(ridgeStart.x, ridgeStart.z)).toBeGreaterThan(150);
  });

  it('rises tall enough to be a mountain, with snow on the top', () => {
    let tallest = 0;
    for (let x = -300; x <= 0; x += 4) {
      for (let z = 0; z <= 300; z += 4) tallest = Math.max(tallest, terrain.heightAt(x, z));
    }
    expect(tallest).toBeGreaterThan(MOUNTAINS.snowLine + 10);
  });

  it('is the same ground every time for the same seed', () => {
    expect(mountainHeightAt(SEED, -150, 150)).toBe(mountainHeightAt(SEED, -150, 150));
    expect(mountainHeightAt(SEED, -150, 150)).not.toBe(mountainHeightAt(SEED + 1, -150, 150));
  });

  it('has gentle slopes that can be walked most of the way up', () => {
    const highest = highestWalkableGround(terrain, { x: -60, z: 60 });
    expect(highest).toBeGreaterThan(MOUNTAINS.snowLine);
  });

  it('has cliffs too, steeper than anyone can walk', () => {
    let cliffs = 0;
    for (let x = -300; x <= -60; x += 2) {
      for (let z = 60; z <= 300; z += 2) {
        const here = terrain.heightAt(x, z);
        if (terrain.heightAt(x + 2, z) - here > MAX_WALKABLE_GRADIENT * 2 * 2) cliffs++;
      }
    }
    expect(cliffs).toBeGreaterThan(20);
  });

  it('grows no trees above the tree line', () => {
    const { props } = buildWilderness(SEED, terrain);
    const trees = props.filter(
      (prop) => prop.kind === 'pine' || prop.kind === 'birch' || prop.kind === 'oak',
    );
    expect(trees.length).toBeGreaterThan(0);
    for (const tree of trees) expect(tree.y ?? 0).toBeLessThanOrEqual(MOUNTAINS.treeLine);
  });

  it('sets nothing on a steep face', () => {
    const { props } = buildWilderness(SEED, terrain);
    for (const prop of props) {
      if (mountainWeight(prop.x, prop.z) === 0) continue;
      for (const [dx, dz] of [
        [1.5, 0],
        [-1.5, 0],
        [0, 1.5],
        [0, -1.5],
      ] as const) {
        const rise = Math.abs(terrain.heightAt(prop.x + dx, prop.z + dz) - (prop.y ?? 0)) / 1.5;
        expect(rise).toBeLessThanOrEqual(0.6 + 1e-9);
      }
    }
  });

  it('puts only pines and rocks on the high ground', () => {
    const { props } = buildWilderness(SEED, terrain);
    const high = props.filter((prop) => (prop.y ?? 0) > 14);
    expect(high.length).toBeGreaterThan(0);
    for (const prop of high) expect(['pine', 'boulder', 'mossyRock']).toContain(prop.kind);
  });

  it('scatters the forest right out to the corners of the square world', () => {
    const { props } = buildWilderness(SEED, terrain);
    const edge = PLAYABLE_HALF_EXTENT - WILDERNESS.edgeFlat - 40;
    expect(props.some((prop) => prop.x > edge && prop.z > edge)).toBe(true);
  });
});

describe('walking on the mountain', () => {
  const world = createCollisionWorld(terrain, []);

  /** Where a walker ends up after holding a direction for a while. */
  function walk(
    from: { x: number; z: number },
    moveX: number,
    moveZ: number,
    yaw: number,
    ticks: number,
    buttons = 0,
  ): { x: number; y: number; z: number } {
    const motion = createPlayerMotion({
      x: from.x,
      y: terrain.heightAt(from.x, from.z),
      z: from.z,
    });
    for (let tick = 0; tick < ticks; tick++) {
      stepPlayer(motion, createInput(tick, moveX, moveZ, yaw, buttons), 0.05, world);
    }
    return motion.position;
  }

  it('lets a walker climb a gentle slope', () => {
    // Walk from the foot toward the ridge across ordinary hillside: heading toward -X.
    const end = walk({ x: -60, z: 120 }, 0, 1, Math.PI / 2, 40);
    expect(end.x).toBeLessThan(-60 - 5);
    expect(end.y).toBeGreaterThan(terrain.heightAt(-60, 120));
  });

  it('stops a walker at a cliff instead of letting them climb it', () => {
    // Find a cliff face: the steepest rise along +X anywhere on the range.
    let spot: { x: number; z: number } | null = null;
    let steepest = 0;
    for (let x = -300; x <= -60; x += 1) {
      for (let z = 60; z <= 300; z += 4) {
        const rise = terrain.heightAt(x + 1, z) - terrain.heightAt(x, z);
        if (rise > steepest) {
          steepest = rise;
          spot = { x, z };
        }
      }
    }
    expect(steepest).toBeGreaterThan(MAX_WALKABLE_GRADIENT * 3);
    const start = { x: spot!.x - 1, z: spot!.z };
    const end = walk(start, 0, 1, -Math.PI / 2, 60); // yaw -90 deg: forward is +X
    const climbed = end.y - terrain.heightAt(start.x, start.z);
    expect(climbed).toBeLessThan(steepest);
    expect(end.x).toBeLessThan(spot!.x + 1.5);
  });

  it('does not let a jump carry a walker up a cliff face', () => {
    let spot: { x: number; z: number } | null = null;
    let steepest = 0;
    for (let x = -300; x <= -60; x += 1) {
      for (let z = 60; z <= 300; z += 4) {
        const rise = terrain.heightAt(x + 1, z) - terrain.heightAt(x, z);
        if (rise > steepest) {
          steepest = rise;
          spot = { x, z };
        }
      }
    }
    const start = { x: spot!.x - 1, z: spot!.z };
    const startHeight = terrain.heightAt(start.x, start.z);
    const end = walk(start, 0, 1, -Math.PI / 2, 60, PlayerButton.Jump);
    // A jump peaks at about a metre and a quarter; the cliff is far taller.
    expect(end.y - startHeight).toBeLessThan(steepest - 1);
  });

  it('keeps the whole body clear of a cliff face, not just the feet', () => {
    let spot: { x: number; z: number } | null = null;
    let steepest = 0;
    for (let x = -300; x <= -60; x += 1) {
      for (let z = 60; z <= 300; z += 4) {
        const rise = terrain.heightAt(x + 1, z) - terrain.heightAt(x, z);
        if (rise > steepest) {
          steepest = rise;
          spot = { x, z };
        }
      }
    }
    const end = walk({ x: spot!.x - 3, z: spot!.z }, 0, 1, -Math.PI / 2, 80);
    // Every point round the body's edge is no higher than a stride above the feet.
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const edgeHeight = terrain.heightAt(
        end.x + Math.cos(angle) * PLAYER_RADIUS,
        end.z + Math.sin(angle) * PLAYER_RADIUS,
      );
      expect(edgeHeight - end.y).toBeLessThan(1);
    }
  });
});
