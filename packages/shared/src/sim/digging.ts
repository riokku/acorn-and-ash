/**
 * The rules for a swing of the shovel (decision 0114, step 4).
 *
 * Pure functions, no server state, so the client can ask the same questions to
 * show a hint and the server can check the answer.
 */

import { CLEARING_HALF, CLEARING_TREE_LINE_OUTER } from '../constants';
import type { ItemId } from '../data/items';
import { hashSeed, createRng } from '../rng';
import {
  CUBE_DIG,
  DIG_CUBE,
  DIG_DIRECTIONS,
  digDirectionFromYaw,
  VOXEL,
  voxelIndex,
  type Dig,
  type DugGrid,
} from '../world/digging';
import { mountainWeight } from '../world/mountains';
import type { Terrain } from '../world/terrain';

/** The deepest anyone may dig below the ground above them, in metres. */
export const DIG_MAX_DEPTH = 12;
/** Most digs a world will ever hold: bounds the save, the join message and the collision cost. */
export const DIG_MAX_COUNT = 20000;
/** How far from a built piece nobody digs, in metres, so a cabin can never be undermined. */
export const DIG_BUILT_CLEARANCE = 6;
/** How far from water nobody digs, in metres, so a tunnel never runs under a lake or the stream. */
export const DIG_WATER_CLEARANCE = 3;
/** How many 0.5 m cubes of ground make one stone. A full one-metre dig (8 cubes) is one. */
export const CUBES_PER_STONE = 8;

/** Whether this spot is inside the home clearing and the ring of trees round it. */
export function inHomeClearing(x: number, z: number): boolean {
  const reach = CLEARING_HALF + (CLEARING_TREE_LINE_OUTER - CLEARING_HALF);
  return Math.abs(x) <= reach && Math.abs(z) <= reach;
}

/**
 * The one-metre cube a swing from here carves: the whole-metre square next to
 * the one the feet are in, along whichever of the four ways the aim is
 * nearest. A digging-down swing starts half a metre lower, so repeated swings
 * make a ramp down. A level swing digs at foot level; once that cube is open,
 * the next swing takes the cube above it for head room, so a tunnel you can
 * walk takes two swings a metre.
 */
export function planDig(
  position: { readonly x: number; readonly y: number; readonly z: number },
  aimYaw: number,
  down: boolean,
  grid: DugGrid,
): Dig {
  // Yaw 0 looks down -Z, matching the way movement reads it.
  const forwardX = -Math.sin(aimYaw);
  const forwardZ = -Math.cos(aimYaw);
  const way = DIG_DIRECTIONS[digDirectionFromYaw(forwardX, forwardZ)];
  const feet: Dig = {
    ix: (Math.floor(position.x) + way.x) * DIG_CUBE,
    iy: voxelIndex(position.y + 0.01) - (down ? 1 : 0),
    iz: (Math.floor(position.z) + way.z) * DIG_CUBE,
    dir: CUBE_DIG,
  };
  if (down || grid.solidCubes(feet).length > 0) return feet;
  const head: Dig = { ...feet, iy: feet.iy + DIG_CUBE };
  return grid.solidCubes(head).length > 0 ? head : feet;
}

export type DigRefusal = 'home' | 'water' | 'built' | 'deep' | 'full';

/** Why this slab may not be carved, or null if it may. */
export function digRefusal(
  dig: Dig,
  grid: DugGrid,
  terrain: Terrain,
  isNearWater: (x: number, z: number, margin: number) => boolean,
  builtPieces: readonly { readonly x: number; readonly z: number }[],
): DigRefusal | null {
  if (grid.digs.length >= DIG_MAX_COUNT) return 'full';
  const x = (dig.ix + 0.5) * VOXEL;
  const z = (dig.iz + 0.5) * VOXEL;
  if (inHomeClearing(x, z)) return 'home';
  if (isNearWater(x, z, DIG_WATER_CLEARANCE)) return 'water';
  if (builtPieces.some((piece) => Math.hypot(piece.x - x, piece.z - z) < DIG_BUILT_CLEARANCE))
    return 'built';
  if (terrain.heightAt(x, z) - dig.iy * VOXEL > DIG_MAX_DEPTH) return 'deep';
  return null;
}

/** What a swing turns up: mostly stone, sometimes ore high on the mountain, sometimes clay on low ground. */
export function digYield(
  worldSeed: number,
  dig: Dig,
  cubes: number,
  surface: number,
): Array<{ item: ItemId; count: number }> {
  const found: Array<{ item: ItemId; count: number }> = [];
  const stone = Math.max(1, Math.floor(cubes / CUBES_PER_STONE));
  found.push({ item: 'stone', count: stone });
  const rng = createRng(hashSeed(worldSeed, 'dig-yield', dig.ix, dig.iy, dig.iz, dig.dir));
  const x = (dig.ix + 0.5) * VOXEL;
  const z = (dig.iz + 0.5) * VOXEL;
  if (mountainWeight(x, z) > 0.3 && rng.nextRange(0, 1) < 0.2) {
    found.push({ item: 'ironOre', count: 1 });
  } else if (surface < 4 && rng.nextRange(0, 1) < 0.25) {
    found.push({ item: 'clay', count: 1 });
  }
  return found;
}
