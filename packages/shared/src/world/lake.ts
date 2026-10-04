/**
 * The lake: a big stretch of water in the north-east corner of the world,
 * with islands in it (see decision 0090).
 *
 * Like the pond it is hand-placed, the same in every world. Unlike the pond it
 * is not a few cylinders you cannot walk into, because it has islands, and
 * later a boat that sails round them. So it is described as two fields:
 *
 * - the basin, a handful of overlapping circles that make the shape of the
 *   water's outline, and
 * - the islands, each a few overlapping circles of its own.
 *
 * Every question about the lake - is this spot on the water, how deep is it,
 * which way is the shore - is answered from those, with plain numbers in and
 * out, so the server, every browser and the tests all agree. Nothing about
 * the lake travels over the wire.
 */

import { lerp, smoothstep } from '../math/vec3';
import type { WaterCircle } from './water';

/** An island: a few overlapping circles, with a crown that stands this high above the water. */
export interface LakeIsland {
  /** Stable name, for whatever gets built on it later. */
  readonly id: string;
  readonly lobes: readonly WaterCircle[];
  /** How far the middle of the island stands above the water, in metres. */
  readonly rise: number;
}

/** A box on the ground, in metres. */
interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface Lake {
  /** Height of the water's surface, in metres. */
  readonly level: number;
  /** The outline of the water, islands included. */
  readonly basin: readonly WaterCircle[];
  readonly islands: readonly LakeIsland[];
  /** The box that holds the whole basin. */
  readonly bounds: Box;
  /** The box that holds the basin and the bank that eases down to it. */
  readonly reach: Box;
}

/** How far from the water's edge the hills ease down to meet it, in metres. */
export const LAKE_SHORE_WIDTH = 16;
/** How far below the surface the lake floor sinks, in metres. */
export const LAKE_BED_DEPTH = 2.4;
/** How far from the shore the floor takes to reach its full depth, in metres. */
const LAKE_BED_RUN = 6;
/** The shore sits a hair above the surface, so the water never washes over the land. */
const LAKE_SHORE_LIP = 0.05;
/** Trees and rocks stay this far back from the water's edge, in metres. */
export const LAKE_PROP_CLEARANCE = 1.2;

function boxAround(circles: readonly WaterCircle[], extra: number): Box {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const circle of circles) {
    minX = Math.min(minX, circle.x - circle.radius - extra);
    maxX = Math.max(maxX, circle.x + circle.radius + extra);
    minZ = Math.min(minZ, circle.z - circle.radius - extra);
    maxZ = Math.max(maxZ, circle.z + circle.radius + extra);
  }
  return { minX, maxX, minZ, maxZ };
}

export function defineLake(
  level: number,
  basin: readonly WaterCircle[],
  islands: readonly LakeIsland[],
): Lake {
  return {
    level,
    basin,
    islands,
    bounds: boxAround(basin, 0),
    reach: boxAround(basin, LAKE_SHORE_WIDTH),
  };
}

/**
 * The lake as built: five blobs of water that run together into one wide,
 * lobed lake about a hundred metres across, and five islands. Every island
 * stands well clear of every shore, so there is open water to row across.
 */
export const LAKE: Lake = defineLake(
  0,
  [
    { x: 88, z: -88, radius: 32 },
    { x: 66, z: -106, radius: 20 },
    { x: 110, z: -64, radius: 20 },
    { x: 108, z: -110, radius: 22 },
    { x: 68, z: -70, radius: 16 },
  ],
  [
    {
      id: 'heart',
      rise: 2.6,
      lobes: [
        { x: 88, z: -88, radius: 7.5 },
        { x: 94, z: -85, radius: 5 },
        { x: 83, z: -92, radius: 4.5 },
      ],
    },
    {
      id: 'north',
      rise: 1.8,
      lobes: [
        { x: 104, z: -106, radius: 5.5 },
        { x: 108.5, z: -103, radius: 3.5 },
      ],
    },
    {
      id: 'west',
      rise: 2,
      lobes: [
        { x: 66, z: -102, radius: 6 },
        { x: 61.5, z: -99, radius: 3.5 },
      ],
    },
    {
      id: 'east',
      rise: 1.6,
      lobes: [
        { x: 108, z: -72, radius: 5 },
        { x: 112, z: -75, radius: 3 },
      ],
    },
    {
      id: 'south',
      rise: 1.3,
      lobes: [
        { x: 71, z: -73, radius: 4.5 },
        { x: 73.5, z: -76, radius: 2.5 },
      ],
    },
  ],
);

function insideBox(box: Box, x: number, z: number, margin: number): boolean {
  return (
    x >= box.minX - margin &&
    x <= box.maxX + margin &&
    z >= box.minZ - margin &&
    z <= box.maxZ + margin
  );
}

/** Could this spot be on or beside the water? A cheap box test to skip the circle maths far away. */
export function isNearLake(lake: Lake, x: number, z: number, margin = 0): boolean {
  return insideBox(lake.bounds, x, z, margin);
}

/**
 * How far inside the lake's outline this spot is, in metres: negative on dry
 * land beyond it. Islands count as part of the outline here.
 */
export function basinDepthAt(lake: Lake, x: number, z: number): number {
  let deepest = -Infinity;
  for (const circle of lake.basin) {
    deepest = Math.max(deepest, circle.radius - Math.hypot(x - circle.x, z - circle.z));
  }
  return deepest;
}

/** How far inside this island's shore a spot is, in metres: negative in the water round it. */
export function islandDepthAt(island: LakeIsland, x: number, z: number): number {
  let deepest = -Infinity;
  for (const lobe of island.lobes) {
    deepest = Math.max(deepest, lobe.radius - Math.hypot(x - lobe.x, z - lobe.z));
  }
  return deepest;
}

/** How far inside the nearest island's shore a spot is: negative in the water, or when there are no islands. */
export function nearestIslandDepthAt(lake: Lake, x: number, z: number): number {
  let deepest = -Infinity;
  for (const each of lake.islands) deepest = Math.max(deepest, islandDepthAt(each, x, z));
  return deepest;
}

/**
 * How deep the water is at a spot, in metres from the nearest shore: positive
 * on the water, negative on land - the shore of the mainland or of an
 * island, whichever is closer. Zero is the water's edge.
 */
export function lakeDepthAt(lake: Lake, x: number, z: number): number {
  const basin = basinDepthAt(lake, x, z);
  if (basin <= 0) return basin;
  return Math.min(basin, -nearestIslandDepthAt(lake, x, z));
}

/** Is this spot on the water, at least `margin` metres in from every shore? */
export function isOnLake(lake: Lake, x: number, z: number, margin = 0): boolean {
  if (!isNearLake(lake, x, z)) return false;
  return lakeDepthAt(lake, x, z) >= margin;
}

/** Does anything with this footprint touch the lake or its islands? */
export function overlapsLake(lake: Lake, x: number, z: number, footprintRadius: number): boolean {
  if (!isNearLake(lake, x, z, footprintRadius)) return false;
  return basinDepthAt(lake, x, z) > -footprintRadius;
}

/** How deep the water is, and which way it gets deeper. */
export interface LakeSlope {
  /** As `lakeDepthAt`. */
  depth: number;
  /** A direction, length one, pointing toward deeper water. */
  towardX: number;
  towardZ: number;
}

/**
 * Like `lakeDepthAt`, plus which way the water gets deeper, so something
 * standing in it knows which way the shore is: the other way.
 *
 * Writes into `out` so working this out for every player every tick makes no
 * garbage.
 */
export function lakeSlopeAt(lake: Lake, x: number, z: number, out: LakeSlope): LakeSlope {
  let basin = -Infinity;
  let basinX = 1;
  let basinZ = 0;
  for (const circle of lake.basin) {
    const dx = x - circle.x;
    const dz = z - circle.z;
    const distance = Math.hypot(dx, dz);
    const depth = circle.radius - distance;
    if (depth > basin) {
      basin = depth;
      // Deeper is toward the middle of the circle.
      basinX = distance < 1e-6 ? 1 : -dx / distance;
      basinZ = distance < 1e-6 ? 0 : -dz / distance;
    }
  }

  let island = -Infinity;
  let islandX = 1;
  let islandZ = 0;
  for (const each of lake.islands) {
    for (const lobe of each.lobes) {
      const dx = x - lobe.x;
      const dz = z - lobe.z;
      const distance = Math.hypot(dx, dz);
      const depth = lobe.radius - distance;
      if (depth > island) {
        island = depth;
        // The water gets deeper away from an island, so the way out is away from its middle.
        islandX = distance < 1e-6 ? 1 : dx / distance;
        islandZ = distance < 1e-6 ? 0 : dz / distance;
      }
    }
  }

  if (basin <= -island) {
    out.depth = basin;
    out.towardX = basinX;
    out.towardZ = basinZ;
  } else {
    out.depth = -island;
    out.towardX = islandX;
    out.towardZ = islandZ;
  }
  return out;
}

/**
 * The height of the ground at a spot, given what the hills alone would make
 * it: the bank eases down to a gentle beach at the water's edge, the floor
 * sinks away from the shore, and each island rises into a dome.
 *
 * Far from the lake it hands back `hills` untouched.
 */
export function lakeGroundHeight(lake: Lake, x: number, z: number, hills: number): number {
  if (!insideBox(lake.reach, x, z, 0)) return hills;
  const basin = basinDepthAt(lake, x, z);
  if (basin <= -LAKE_SHORE_WIDTH) return hills;
  const shore = lake.level + LAKE_SHORE_LIP;

  if (basin <= 0) {
    // On the bank: a beach that climbs a little way, then gives way to the hills.
    const away = -basin;
    const beach = shore + Math.min(away, 3) * 0.1;
    return lerp(beach, hills, smoothstep(away, 1.5, LAKE_SHORE_WIDTH));
  }

  let crown: LakeIsland | null = null;
  let island = -Infinity;
  for (const each of lake.islands) {
    const depth = islandDepthAt(each, x, z);
    if (depth > island) {
      island = depth;
      crown = each;
    }
  }
  if (crown !== null && island > 0) {
    // The middle of an island is a soft dome; its edge is a shallow beach.
    const run = Math.max(3.5, crown.rise * 2.4);
    return shore + crown.rise * smoothstep(island, 0, run);
  }

  // Open water, or the shallows round an island: the floor sinks with distance from the nearest shore.
  const fromShore = Math.min(basin, -island);
  return shore - LAKE_BED_DEPTH * smoothstep(fromShore, 0, LAKE_BED_RUN);
}
