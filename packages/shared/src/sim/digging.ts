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
  if (grid.solidCubes(head).length > 0) return head;
  // On level ground the cube at the feet is all air, so a plain swing would do
  // nothing at all: start half a metre lower, a first scoop to step into.
  const scoop: Dig = { ...feet, iy: feet.iy - 1 };
  return grid.solidCubes(scoop).length > 0 ? scoop : feet;
}

/** Why a swing of the shovel made no hole; `nothing` is for ground with nothing solid in the way. Order is the wire order. */
export const DIG_REFUSALS = [
  'home',
  'water',
  'built',
  'deep',
  'full',
  'nothing',
  'packFull',
  'far',
  // Mine supports (decision 0119) share the wire: they are told the same way.
  'notTunnel',
  'supportTaken',
] as const;
export type DigRefusal = Exclude<
  (typeof DIG_REFUSALS)[number],
  'nothing' | 'packFull' | 'far' | 'notTunnel' | 'supportTaken'
>;
export type DigRefusalReason = (typeof DIG_REFUSALS)[number];

/** How far from your chest to the middle of a cube you can dig it, in metres. */
export const DIG_REACH_METERS = 3;
/** Extra reach the server allows, for a player who has walked on since the browser chose. */
export const DIG_REACH_SLACK = 0.9;
/** How high the chest is above the feet, in metres, for working out reach. */
const CHEST_HEIGHT = 0.9;

/**
 * The cube under a point of ground, wall, floor or roof the mouse is on.
 *
 * The point is pushed a little into the ground, against the way the surface
 * faces, to find the solid voxel just behind it. The cube is the whole-metre
 * square that voxel is in, and a metre tall: that voxel and whichever of its
 * upper or lower neighbours the point is nearer, so the cube is centred on
 * the point and a floor or roof loses half a metre, not a whole one.
 */
export function cubeAtHit(
  point: { readonly x: number; readonly y: number; readonly z: number },
  normal: { readonly x: number; readonly y: number; readonly z: number },
): Dig {
  const push = 0.12;
  const x = point.x - normal.x * push;
  const y = point.y - normal.y * push;
  const z = point.z - normal.z * push;
  const voxel = voxelIndex(y);
  const inside = y / VOXEL - voxel;
  return {
    ix: Math.floor(x) * DIG_CUBE,
    iy: inside < 0.5 ? voxel - 1 : voxel,
    iz: Math.floor(z) * DIG_CUBE,
    dir: CUBE_DIG,
  };
}

/** Whether this cube is near enough to a body with its feet here to be dug. */
export function digInReach(
  feet: { readonly x: number; readonly y: number; readonly z: number },
  dig: Dig,
  slack = 0,
): boolean {
  const middleX = (dig.ix + DIG_CUBE / 2) * VOXEL;
  const middleY = (dig.iy + DIG_CUBE / 2) * VOXEL;
  const middleZ = (dig.iz + DIG_CUBE / 2) * VOXEL;
  return (
    Math.hypot(middleX - feet.x, middleY - (feet.y + CHEST_HEIGHT), middleZ - feet.z) <=
    DIG_REACH_METERS + slack
  );
}

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

/** The share of digs that turn up anything at all. Most of the ground is just ground. */
export const DIG_LOOT_CHANCE = 0.03;

/**
 * What a swing turns up: usually nothing, about one dig in thirty a find. Mostly
 * stone, sometimes ore high on the mountain, sometimes clay on low ground.
 */
export function digYield(
  worldSeed: number,
  dig: Dig,
  surface: number,
): Array<{ item: ItemId; count: number }> {
  const rng = createRng(hashSeed(worldSeed, 'dig-yield', dig.ix, dig.iy, dig.iz, dig.dir));
  if (rng.nextRange(0, 1) >= DIG_LOOT_CHANCE) return [];
  const x = (dig.ix + 0.5) * VOXEL;
  const z = (dig.iz + 0.5) * VOXEL;
  if (mountainWeight(x, z) > 0.3 && rng.nextRange(0, 1) < 0.35)
    return [{ item: 'ironOre', count: 1 }];
  if (surface < 4 && rng.nextRange(0, 1) < 0.3) return [{ item: 'clay', count: 1 }];
  return [{ item: 'stone', count: 1 }];
}
