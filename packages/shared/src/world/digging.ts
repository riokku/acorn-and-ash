/**
 * Dug-out ground (decision 0114, step 4).
 *
 * The surface of the world stays a height map. What a shovel carves out below
 * it is kept apart, as a sparse set of small cubes ("voxels", half a metre on
 * a side) that have been removed from the solid ground under the surface.
 *
 * A player does not remember cubes, only *digs*: each swing of the shovel
 * removes one slab of ground, described by a handful of small numbers. The
 * server saves and sends the list of digs, and every browser replays them to
 * get exactly the same holes, so a tunnel costs a few bytes per metre.
 *
 * Which cubes are solid is never stored: a cube is solid when it lies under
 * the surface and has not been dug. So an untouched world has no dug data at
 * all, and `floorAt` answers straight from the height map for any spot nobody
 * has dug near.
 */

import { PLAYER_HEIGHT } from '../constants';

/** How far below the ground, in metres, somebody in a hole counts as out of sight even with the sky open above. */
const SHELTER_DEPTH = 2.5;
import type { Terrain } from './terrain';

/** Metres along one side of a cube. */
export const VOXEL = 0.5;

/**
 * A dig is one metre cube: this many 0.5 m cubes along each side, the same in
 * every direction. Horizontally a dig sits on the whole-metre grid (its
 * `ix` and `iz` are even) so neighbouring digs tile with no slivers between.
 */
export const DIG_CUBE = 2;

/**
 * The first digs ever made (decision 0114, step 4) were slabs, 1 m long, 1.5 m
 * wide and 2 m tall, in the way the player faced. Worlds saved with those keep
 * them exactly as they were: a dig whose `dir` is 0 to 3 is a slab.
 */
export const SLAB_LENGTH = 2;
export const SLAB_WIDTH = 3;
export const SLAB_HEIGHT = 4;

/** The four ways a tunnel can be aimed: +X, +Z, -X, -Z. */
export const DIG_DIRECTIONS = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
] as const;
/** 0 to 3 are the old slabs, running that way; 4 is a one-metre cube. */
export type AimDirection = 0 | 1 | 2 | 3;
export type DigDirection = AimDirection | 4;
/** The `dir` of a one-metre cube dig. */
export const CUBE_DIG = 4 as const;

/**
 * One swing of the shovel. A cube dig (`dir` 4) starts at its lowest, lowest
 * -X, lowest -Z cube. An old slab starts from the back-centre of its floor.
 */
export interface Dig {
  readonly ix: number;
  readonly iy: number;
  readonly iz: number;
  readonly dir: DigDirection;
}

/**
 * How far up a body can step onto a new floor. A little more than one cube, so
 * a tunnel that steps down or up by a cube at a time can be walked.
 */
export const FLOOR_STEP = 0.55;

function columnKey(ix: number, iz: number): number {
  return (ix + 4096) * 8192 + (iz + 4096);
}

/** Which cube holds this world position (on one axis). */
export function voxelIndex(metres: number): number {
  return Math.floor(metres / VOXEL);
}

/** The cube nearest facing direction `yaw` turned into one of the four ways. */
export function digDirectionFromYaw(forwardX: number, forwardZ: number): AimDirection {
  if (Math.abs(forwardX) >= Math.abs(forwardZ)) return forwardX >= 0 ? 0 : 2;
  return forwardZ >= 0 ? 1 : 3;
}

/** Every cube a dig covers, in a fixed order. */
export function digVoxels(dig: Dig): Array<{ ix: number; iy: number; iz: number }> {
  if (dig.dir === CUBE_DIG) {
    const cubes: Array<{ ix: number; iy: number; iz: number }> = [];
    for (let x = 0; x < DIG_CUBE; x++) {
      for (let z = 0; z < DIG_CUBE; z++) {
        for (let y = 0; y < DIG_CUBE; y++)
          cubes.push({ ix: dig.ix + x, iy: dig.iy + y, iz: dig.iz + z });
      }
    }
    return cubes;
  }
  const forward = DIG_DIRECTIONS[dig.dir];
  const sideX = -forward.z;
  const sideZ = forward.x;
  const half = (SLAB_WIDTH - 1) / 2;
  const cubes: Array<{ ix: number; iy: number; iz: number }> = [];
  for (let along = 0; along < SLAB_LENGTH; along++) {
    for (let across = -half; across <= half; across++) {
      for (let up = 0; up < SLAB_HEIGHT; up++) {
        cubes.push({
          ix: dig.ix + forward.x * along + sideX * across,
          iy: dig.iy + up,
          iz: dig.iz + forward.z * along + sideZ * across,
        });
      }
    }
  }
  return cubes;
}

/** A stretch of open air in one column, from a floor up to a ceiling. */
export interface OpenSpan {
  readonly floor: number;
  /** Metres. Infinity where the span opens to the sky. */
  readonly ceiling: number;
}

export class DugGrid {
  /** Every dig, in the order they were made: what is saved and sent. */
  readonly digs: Dig[] = [];
  /** Dug cube heights (layer numbers), sorted, for each column that has any. */
  private readonly columns = new Map<number, number[]>();

  constructor(private readonly terrain: Terrain) {}

  get isEmpty(): boolean {
    return this.digs.length === 0;
  }

  /** Whether any cube in this column has been dug out. */
  hasColumn(ix: number, iz: number): boolean {
    return this.columns.has(columnKey(ix, iz));
  }

  isDug(ix: number, iy: number, iz: number): boolean {
    const layers = this.columns.get(columnKey(ix, iz));
    return layers !== undefined && layers.includes(iy);
  }

  /** Whether this cube is under the surface, dug or not. */
  isUnderground(ix: number, iy: number, iz: number): boolean {
    const surface = this.terrain.heightAt((ix + 0.5) * VOXEL, (iz + 0.5) * VOXEL);
    return (iy + 0.5) * VOXEL < surface;
  }

  /**
   * Whether a body with its feet here is shut away underground: in a dug-out
   * space with solid ground over its head, or far enough down a hole that
   * nothing standing at its edge can see or reach it. Standing at the mouth of
   * a shallow hole, open to the sky, is not.
   */
  isSheltered(x: number, feetY: number, z: number): boolean {
    const ix = Math.floor(x / VOXEL);
    const iz = Math.floor(z / VOXEL);
    if (!this.hasColumn(ix, iz)) return false;
    const surface = this.terrain.heightAt(x, z);
    if (surface - feetY > SHELTER_DEPTH) return true;
    const above = voxelIndex(feetY + PLAYER_HEIGHT) + 1;
    for (let iy = above; (iy + 0.5) * VOXEL < surface; iy++)
      if (this.isSolid(ix, iy, iz)) return true;
    return false;
  }

  /** Whether this cube is still solid ground. */
  isSolid(ix: number, iy: number, iz: number): boolean {
    return this.isUnderground(ix, iy, iz) && !this.isDug(ix, iy, iz);
  }

  /** The cubes of a dig that are solid right now: what carving it would remove. */
  solidCubes(dig: Dig): Array<{ ix: number; iy: number; iz: number }> {
    return digVoxels(dig).filter((cube) => this.isSolid(cube.ix, cube.iy, cube.iz));
  }

  /**
   * Carve a slab out of the ground. Returns the cubes this removed - none if
   * it was all air or already dug, in which case nothing is recorded.
   */
  apply(dig: Dig): Array<{ ix: number; iy: number; iz: number }> {
    const removed = this.solidCubes(dig);
    if (removed.length === 0) return removed;
    this.digs.push(dig);
    for (const cube of removed) {
      const key = columnKey(cube.ix, cube.iz);
      const layers = this.columns.get(key);
      if (layers === undefined) this.columns.set(key, [cube.iy]);
      else {
        // Keep sorted: columns are short, so inserting is cheap.
        let at = layers.length;
        while (at > 0 && layers[at - 1]! > cube.iy) at--;
        layers.splice(at, 0, cube.iy);
      }
    }
    return removed;
  }

  /** Every dug cube in the world, for drawing. */
  forEachDugCube(visit: (ix: number, iy: number, iz: number) => void): void {
    for (const [key, layers] of this.columns) {
      const ix = Math.floor(key / 8192) - 4096;
      const iz = (key % 8192) - 4096;
      for (const iy of layers) visit(ix, iy, iz);
    }
  }

  /**
   * Where a body at this spot could stand, lowest first: the floor of every
   * dug pocket tall enough to stand in, with its ceiling, plus the surface
   * itself unless a pocket opens straight up to it.
   */
  openSpans(x: number, z: number): OpenSpan[] {
    const ix = voxelIndex(x);
    const iz = voxelIndex(z);
    const surface = this.terrain.heightAt(x, z);
    const layers = this.columns.get(columnKey(ix, iz));
    if (layers === undefined) return [{ floor: surface, ceiling: Infinity }];

    const spans: OpenSpan[] = [];
    let opensToSky = false;
    let start = 0;
    while (start < layers.length) {
      let end = start;
      while (end + 1 < layers.length && layers[end + 1] === layers[end]! + 1) end++;
      const floor = layers[start]! * VOXEL;
      const top = (layers[end]! + 1) * VOXEL;
      // The run opens to the sky when the cube above it is air, not solid ground.
      const reachesSky = !this.isUnderground(ix, layers[end]! + 1, iz);
      if (reachesSky) opensToSky = true;
      const ceiling = reachesSky ? Infinity : top;
      if (ceiling - floor >= PLAYER_HEIGHT) spans.push({ floor, ceiling });
      start = end + 1;
    }
    if (!opensToSky) spans.push({ floor: surface, ceiling: Infinity });
    return spans;
  }

  /**
   * The floor a body with its feet at `feetY` stands on here: the highest one
   * it can step up to. If every floor is out of reach above it - a wall of
   * solid ground - the lowest of those, so the climb reads as too steep.
   */
  floorAt(x: number, z: number, feetY: number): number {
    const spans = this.openSpans(x, z);
    let best = -Infinity;
    let lowestAbove = Infinity;
    for (const span of spans) {
      if (span.floor <= feetY + FLOOR_STEP) {
        // Not through a ceiling: a pocket whose roof is lower than the body.
        if (span.floor > best && span.ceiling >= span.floor + PLAYER_HEIGHT) best = span.floor;
      } else if (span.floor < lowestAbove) lowestAbove = span.floor;
    }
    if (best > -Infinity) return best;
    if (lowestAbove < Infinity) return lowestAbove;
    return this.terrain.heightAt(x, z);
  }

  /** The ceiling over a body standing here, or Infinity in the open. */
  ceilingAt(x: number, z: number, feetY: number): number {
    for (const span of this.openSpans(x, z)) {
      if (span.floor <= feetY + FLOOR_STEP && span.floor >= feetY - FLOOR_STEP * 4) {
        if (span.ceiling >= span.floor + PLAYER_HEIGHT) return span.ceiling;
      }
    }
    return Infinity;
  }
}
