import { describe, expect, it } from 'vitest';
import { createCollisionWorld } from '../src/collision/capsule';
import { PLAYER_HEIGHT } from '../src/constants';
import {
  DugGrid,
  digDirectionFromYaw,
  digVoxels,
  FLOOR_STEP,
  SLAB_HEIGHT,
  SLAB_LENGTH,
  SLAB_WIDTH,
  VOXEL,
  type Dig,
} from '../src/world/digging';
import { createInput, createPlayerMotion, stepPlayer } from '../src/sim/player';
import type { Terrain } from '../src/world/terrain';

/** A hillside rising 0.4 m for every metre east of x = 0, levelling off at 12 m. */
const hillside: Terrain = {
  kind: 'hillside',
  heightAt: (x) => Math.min(12, Math.max(0, x * 0.4)),
};

function tunnel(grid: DugGrid, slabs: number, fromIx = 4): void {
  for (let slab = 0; slab < slabs; slab++) {
    grid.apply({ ix: fromIx + slab * SLAB_LENGTH, iy: 0, iz: 0, dir: 0 });
  }
}

describe('digging', () => {
  it('covers a slab of the shape it says, in a fixed order', () => {
    const cubes = digVoxels({ ix: 10, iy: 2, iz: -3, dir: 1 });
    expect(cubes).toHaveLength(SLAB_LENGTH * SLAB_WIDTH * SLAB_HEIGHT);
    expect(new Set(cubes.map((c) => `${c.ix},${c.iy},${c.iz}`)).size).toBe(cubes.length);
    expect(digVoxels({ ix: 10, iy: 2, iz: -3, dir: 1 })).toEqual(cubes);
  });

  it('turns a facing into one of four ways', () => {
    expect(digDirectionFromYaw(1, 0.2)).toBe(0);
    expect(digDirectionFromYaw(0.1, 1)).toBe(1);
    expect(digDirectionFromYaw(-1, 0)).toBe(2);
    expect(digDirectionFromYaw(0, -1)).toBe(3);
  });

  it('removes only ground under the surface, and nothing twice', () => {
    const grid = new DugGrid(hillside);
    const dig: Dig = { ix: 4, iy: 0, iz: 0, dir: 0 };
    const removed = grid.apply(dig);
    expect(removed.length).toBeGreaterThan(0);
    for (const cube of removed) expect(grid.isUnderground(cube.ix, cube.iy, cube.iz)).toBe(true);
    expect(grid.apply(dig)).toHaveLength(0);
    expect(grid.digs).toEqual([dig]);
  });

  it('records nothing for a swing into open air', () => {
    const grid = new DugGrid(hillside);
    expect(grid.apply({ ix: -10, iy: 0, iz: 0, dir: 0 })).toHaveLength(0);
    expect(grid.isEmpty).toBe(true);
  });

  it('gives the same holes whatever order the digs are replayed in', () => {
    const digs: Dig[] = [0, 1, 2, 3].map((k) => ({ ix: 4 + k * 2, iy: 0, iz: 0, dir: 0 }));
    const a = new DugGrid(hillside);
    const b = new DugGrid(hillside);
    for (const dig of digs) a.apply(dig);
    for (const dig of [...digs].reverse()) b.apply(dig);
    const keys = (grid: DugGrid): string[] => {
      const out: string[] = [];
      grid.forEachDugCube((x, y, z) => out.push(`${x},${y},${z}`));
      return out.sort();
    };
    expect(keys(a)).toEqual(keys(b));
  });

  it('leaves the ground exactly as it was where nothing is dug', () => {
    const grid = new DugGrid(hillside);
    tunnel(grid, 2);
    expect(grid.floorAt(-5, 20, 0)).toBe(hillside.heightAt(-5, 20));
    expect(grid.openSpans(30, 30)).toEqual([
      { floor: hillside.heightAt(30, 30), ceiling: Infinity },
    ]);
  });

  it('gives a floor and a roof inside a tunnel', () => {
    const grid = new DugGrid(hillside);
    tunnel(grid, 6);
    // Seven metres in, the tunnel floor is at 0 and the surface is 2.9 m up.
    const x = 7.25;
    const z = 0.25;
    expect(grid.floorAt(x, z, 0)).toBe(0);
    expect(grid.ceilingAt(x, z, 0)).toBeGreaterThanOrEqual(PLAYER_HEIGHT);
    // Standing on the hill above it, the floor is the surface.
    expect(grid.floorAt(x, z, hillside.heightAt(x, z))).toBe(hillside.heightAt(x, z));
  });

  it('treats a pocket too low to stand in as solid', () => {
    const grid = new DugGrid(hillside);
    // Only the bottom two cubes are dug: a crawl space.
    grid.apply({ ix: 40, iy: 0, iz: 0, dir: 0 });
    const x = 40 * VOXEL + 0.25;
    const spans = grid.openSpans(x, 0.25);
    expect(spans.every((s) => s.ceiling - s.floor >= PLAYER_HEIGHT)).toBe(true);
  });
});

describe('walking through a dug tunnel', () => {
  it('walks in and stays on the tunnel floor', () => {
    const grid = new DugGrid(hillside);
    tunnel(grid, 6);
    const world = createCollisionWorld(hillside, [], 300);
    world.dug = grid;
    const motion = createPlayerMotion({ x: 5.25, y: 0, z: 0.25 });
    motion.grounded = true;
    for (let tick = 0; tick < 20; tick++) {
      stepPlayer(motion, createInput(tick), 0.05, world);
    }
    expect(motion.position.y).toBeCloseTo(0, 5);
    expect(motion.position.y).toBeLessThan(hillside.heightAt(5.25, 0.25) - FLOOR_STEP);
  });

  it('is stopped by the solid wall at the end of the tunnel', () => {
    const grid = new DugGrid(hillside);
    tunnel(grid, 3); // runs from x = 2 to x = 5
    const world = createCollisionWorld(hillside, [], 300);
    world.dug = grid;
    const motion = createPlayerMotion({ x: 3.5, y: 0, z: 0.25 });
    motion.grounded = true;
    // Camera yaw of PI/2 turns "forward" into +X.
    for (let tick = 0; tick < 100; tick++) {
      stepPlayer(motion, createInput(tick, 0, -1, Math.PI / 2), 0.05, world);
    }
    expect(motion.position.x).toBeGreaterThan(4);
    expect(motion.position.x).toBeLessThan(5.1);
    expect(motion.position.y).toBeCloseTo(0, 5);
  });

  it('walks in from the hillside outside', () => {
    const grid = new DugGrid(hillside);
    tunnel(grid, 6);
    const world = createCollisionWorld(hillside, [], 300);
    world.dug = grid;
    const motion = createPlayerMotion({ x: 0, y: 0, z: 0.25 });
    motion.grounded = true;
    for (let tick = 0; tick < 160; tick++) {
      stepPlayer(motion, createInput(tick, 0, -1, Math.PI / 2), 0.05, world);
    }
    expect(motion.position.x).toBeGreaterThan(6);
    expect(motion.position.x).toBeLessThan(8.1);
    expect(motion.position.y).toBeLessThan(hillside.heightAt(motion.position.x, 0.25) - 1);
  });
});
