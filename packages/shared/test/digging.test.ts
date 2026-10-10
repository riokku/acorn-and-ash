import { describe, expect, it } from 'vitest';
import { createCollisionWorld } from '../src/collision/capsule';
import { PLAYER_HEIGHT } from '../src/constants';
import { planDig } from '../src/sim/digging';
import {
  CUBE_DIG,
  DIG_CUBE,
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

describe('one-metre cube digs', () => {
  it('covers a metre cube: two half-metre cubes each way, all different', () => {
    const cubes = digVoxels({ ix: 10, iy: 3, iz: -4, dir: CUBE_DIG });
    expect(cubes).toHaveLength(DIG_CUBE ** 3);
    expect(new Set(cubes.map((c) => `${c.ix},${c.iy},${c.iz}`)).size).toBe(8);
    expect(Math.max(...cubes.map((c) => c.ix)) - Math.min(...cubes.map((c) => c.ix))).toBe(1);
    expect(Math.max(...cubes.map((c) => c.iy)) - Math.min(...cubes.map((c) => c.iy))).toBe(1);
    expect(Math.max(...cubes.map((c) => c.iz)) - Math.min(...cubes.map((c) => c.iz))).toBe(1);
  });

  it('keeps old slabs the shape they always were', () => {
    expect(digVoxels({ ix: 10, iy: 2, iz: -3, dir: 1 })).toHaveLength(24);
  });

  it('sits on the whole-metre grid, next to the one the feet are in', () => {
    const grid = new DugGrid(hillside);
    const dig = planDig({ x: 3.3, y: 1.3, z: 0.4 }, -Math.PI / 2, false, grid);
    // Yaw -PI/2 looks down +X: the square after x = 3 is x = 4..5, on z = 0..1.
    expect(dig).toEqual({ ix: 8, iy: 2, iz: 0, dir: CUBE_DIG });
    expect(dig.ix % 2).toBe(0);
    expect(dig.iz % 2).toBe(0);
  });

  it('takes the head room above on the next swing, then stops', () => {
    const grid = new DugGrid(hillside);
    const standing = { x: 7.3, y: 1.3, z: 0.4 };
    const aim = -Math.PI / 2;
    const first = planDig(standing, aim, false, grid);
    grid.apply(first);
    const second = planDig(standing, aim, false, grid);
    expect(second).toEqual({ ...first, iy: first.iy + DIG_CUBE });
    grid.apply(second);
    // The pocket is two metres tall: tall enough to walk in.
    const x = (first.ix + 1) * VOXEL;
    const z = (first.iz + 1) * VOXEL;
    const floor = first.iy * VOXEL;
    expect(
      grid.openSpans(x, z).some((s) => s.floor === floor && s.ceiling - s.floor >= PLAYER_HEIGHT),
    ).toBe(true);
  });

  it('digs a half-metre lower when digging down', () => {
    const grid = new DugGrid(hillside);
    const level = planDig({ x: 3.3, y: 1.3, z: 0.4 }, -Math.PI / 2, false, grid);
    const down = planDig({ x: 3.3, y: 1.3, z: 0.4 }, -Math.PI / 2, true, grid);
    expect(down.iy).toBe(level.iy - 1);
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

describe('being shut away underground', () => {
  const flat: Terrain = { kind: 'flat', heightAt: () => 10 };

  it('is true in a tunnel with ground over the head, and false in the open', () => {
    const grid = new DugGrid(flat);
    // A tunnel a metre wide and two metres tall, three metres down: floor at 7 m.
    grid.apply({ ix: 0, iy: 14, iz: 0, dir: CUBE_DIG });
    grid.apply({ ix: 0, iy: 16, iz: 0, dir: CUBE_DIG });
    expect(grid.isSheltered(0.5, 7, 0.5)).toBe(true);
    // Not in a column anything was dug in.
    expect(grid.isSheltered(30.5, 10, 0.5)).toBe(false);
  });

  it('is false at the foot of a shallow pit open to the sky, and true deep down one', () => {
    const grid = new DugGrid(flat);
    // A pit one metre deep, open to the sky.
    grid.apply({ ix: 0, iy: 19, iz: 0, dir: CUBE_DIG });
    expect(grid.isSheltered(0.5, 9, 0.5)).toBe(false);
    // The same shaft dug down to 4 m below the ground: too deep for anything at the rim to see into.
    for (let iy = 17; iy >= 11; iy -= 2) grid.apply({ ix: 0, iy, iz: 0, dir: CUBE_DIG });
    expect(grid.isSheltered(0.5, 6, 0.5)).toBe(true);
  });
});
