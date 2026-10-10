import { PLAYABLE_HALF_EXTENT } from '../constants';
import { clamp, type Vec3 } from '../math/vec3';
import {
  colliderFootprintRadius,
  colliderVerticalSpan,
  type BoxCollider,
  type Collider,
  type CylinderCollider,
} from '../world/colliders';
import {
  basinDepthAt,
  isNearLake,
  lakeIceHeight,
  lakeSlopeAt,
  type Lake,
  type LakeSlope,
} from '../world/lake';
import { voxelIndex, type DugGrid } from '../world/digging';
import type { Terrain } from '../world/terrain';
import {
  isInStream,
  nearestOnStream,
  sloughSurfaceAt,
  streamSurfaceAt,
  streamWaterDepthAt,
  streamWaterHalfWidthAt,
  signedStreamAcross,
  streamPointAt,
  STREAM_WADING_DEPTH,
  type Stream,
} from '../world/stream';

/**
 * The invisible wall along the lake's shore: it keeps anyone on foot out of
 * the water, and off the islands, while it is up.
 *
 * It is a switch rather than a set of cylinders because the lake is not one
 * round shape, and because the wall is not always there: a boat can cross the
 * water, and in winter the lake freezes and can be walked on.
 */
export interface LakeWall {
  readonly lake: Lake;
  /** Is the wall up? Down, the water can be walked into. */
  up: boolean;
}

/**
 * A coarse grid over the colliders a world starts with, so a player only
 * checks the trunks and rocks near them instead of every one in the world
 * (see decision 0114: the world grew and so did the forest).
 *
 * It covers the first `count` colliders only - the ones that never move or go
 * away, apart from a tree being swapped for its stump. Anything added after
 * those (a cabin, a campfire) is not in the grid and is always checked.
 */
interface Broadphase {
  readonly count: number;
  readonly cells: Map<number, number[]>;
}

/** Metres along a grid square. Bigger than a player, so a player touches at most four. */
const BROADPHASE_CELL = 16;

function broadphaseKey(cellX: number, cellZ: number): number {
  return (cellX + 4096) * 8192 + (cellZ + 4096);
}

function addToBroadphase(broadphase: Broadphase, index: number, collider: Collider): void {
  const reach = colliderFootprintRadius(collider);
  const fromX = Math.floor((collider.x - reach) / BROADPHASE_CELL);
  const toX = Math.floor((collider.x + reach) / BROADPHASE_CELL);
  const fromZ = Math.floor((collider.z - reach) / BROADPHASE_CELL);
  const toZ = Math.floor((collider.z + reach) / BROADPHASE_CELL);
  for (let cellX = fromX; cellX <= toX; cellX++) {
    for (let cellZ = fromZ; cellZ <= toZ; cellZ++) {
      const key = broadphaseKey(cellX, cellZ);
      const cell = broadphase.cells.get(key);
      if (cell === undefined) broadphase.cells.set(key, [index]);
      else if (!cell.includes(index)) cell.push(index);
    }
  }
}

function buildBroadphase(colliders: readonly Collider[]): Broadphase {
  const broadphase: Broadphase = { count: colliders.length, cells: new Map() };
  colliders.forEach((collider, index) => addToBroadphase(broadphase, index, collider));
  return broadphase;
}

/** Everything the movement code needs to know about the world around it. */
export interface CollisionWorld {
  /** Set when the world was built with `indexStatic`; see `Broadphase`. */
  broadphase?: Broadphase | null;
  /** Shared outdoor weather slowdown; rooms keep normal walking speed. */
  movementScale?: number;
  readonly terrain: Terrain;
  /**
   * What the player bumps into.
   *
   * Not frozen, because the world changes: felling a tree swaps its trunk for
   * the much smaller stump it leaves behind. Use `replaceCollider` rather than
   * writing to this directly, so the client and the server change it the same
   * way.
   */
  readonly colliders: Collider[];
  /** Players are held inside this square, measured from the origin. */
  readonly boundsHalfExtent: number;
  /** The shore of the lake, or null where there is no lake. */
  readonly lakeWall: LakeWall | null;
  /** Shared deep-water barriers; shallow river water remains passable. */
  readonly stream?: Stream | null;
  /** Ground dug out below the surface (decision 0114), or null/undefined where nothing can be dug. */
  dug?: DugGrid | null;
}

/**
 * The floor under a body with its feet at `feetY`: the surface, or the floor of
 * a dug tunnel it is standing in. Where nothing has been dug it is exactly the
 * height map, at the cost of one map lookup.
 */
export function groundHeightAt(world: CollisionWorld, x: number, z: number, feetY: number): number {
  const dug = world.dug;
  if (dug == null || !dug.hasColumn(voxelIndex(x), voxelIndex(z))) {
    return world.terrain.heightAt(x, z);
  }
  return dug.floorAt(x, z, feetY);
}

export function createCollisionWorld(
  terrain: Terrain,
  colliders: readonly Collider[],
  boundsHalfExtent: number = PLAYABLE_HALF_EXTENT,
  lake: Lake | null = null,
  /**
   * Index the colliders given here in a grid. Only for a world whose first
   * colliders stay where they are for good (the outdoors); a room that is
   * rewritten wholesale should leave it off.
   */
  indexStatic = false,
  stream: Stream | null = null,
): CollisionWorld {
  const broadphase = indexStatic ? buildBroadphase(colliders) : null;
  if (lake === null) {
    return {
      terrain,
      colliders: [...colliders],
      boundsHalfExtent,
      lakeWall: null,
      broadphase,
      stream,
    };
  }
  const wall: LakeWall = { lake, up: true };
  return {
    terrain: withLakeIce(terrain, wall, stream),
    colliders: [...colliders],
    boundsHalfExtent,
    lakeWall: wall,
    stream,
    broadphase,
  };
}

/**
 * The ground, with the ice on it while the lake is frozen: wherever the lake
 * is, the ground is the top of the ice (or the island, where that is higher).
 * Everywhere else, and whenever the wall is up, it is the ground as it was.
 */
function withLakeIce(ground: Terrain, wall: LakeWall, stream: Stream | null): Terrain {
  return {
    kind: ground.kind,
    heightAt: (x, z) => {
      const height = ground.heightAt(x, z);
      if (wall.up) return height;
      if (stream !== null) {
        for (const slough of stream.sloughs) {
          if (basinDepthAt(slough, x, z) > 0)
            return Math.max(height, sloughSurfaceAt(stream, slough, x, z) + 0.05);
        }
        if (isInStream(stream, x, z)) {
          const spot = nearestOnStream(stream, x, z, 6)!;
          return Math.max(height, streamSurfaceAt(stream, spot.along) + 0.05);
        }
      }
      if (!isNearLake(wall.lake, x, z)) return height;
      if (basinDepthAt(wall.lake, x, z) <= 0) return height;
      return Math.max(height, lakeIceHeight(wall.lake));
    },
  };
}

/** Freeze or thaw the lake: frozen, the wall comes down and the water can be walked on. */
export function setLakeFrozen(world: CollisionWorld, frozen: boolean): void {
  if (world.lakeWall !== null) world.lakeWall.up = !frozen;
}

/** Is the lake frozen over right now? */
export function isLakeFrozen(world: CollisionWorld): boolean {
  return world.lakeWall !== null && !world.lakeWall.up;
}

/** Swap one collider out, for when a tree comes down. */
export function replaceCollider(world: CollisionWorld, index: number, collider: Collider): void {
  if (index < 0 || index >= world.colliders.length) return;
  world.colliders[index] = collider;
  // A stump or a regrown tree can reach a different distance than the one it
  // replaces. Squares it no longer touches keep its number, which is harmless:
  // the collider is read fresh and tested by distance either way.
  if (world.broadphase != null && index < world.broadphase.count) {
    addToBroadphase(world.broadphase, index, collider);
  }
}

/** Reused so asking what is near a player makes no garbage. */
const nearby: number[] = [];

/** The numbers of the grid's colliders that could touch a capsule at this spot, in order. */
function nearbyStaticColliders(
  broadphase: Broadphase,
  x: number,
  z: number,
  radius: number,
): number[] {
  nearby.length = 0;
  const fromX = Math.floor((x - radius) / BROADPHASE_CELL);
  const toX = Math.floor((x + radius) / BROADPHASE_CELL);
  const fromZ = Math.floor((z - radius) / BROADPHASE_CELL);
  const toZ = Math.floor((z + radius) / BROADPHASE_CELL);
  for (let cellX = fromX; cellX <= toX; cellX++) {
    for (let cellZ = fromZ; cellZ <= toZ; cellZ++) {
      const cell = broadphase.cells.get(broadphaseKey(cellX, cellZ));
      if (cell === undefined) continue;
      for (const index of cell) {
        if (!nearby.includes(index)) nearby.push(index);
      }
    }
  }
  // The same order an unindexed world would check them in.
  return nearby.sort((a, b) => a - b);
}

/**
 * How many times we re-check after pushing.
 *
 * Being wedged between two trunks needs several passes: each push puts the
 * player on the surface of one trunk and slightly back inside the other, and the
 * pair converges on the gap between them. The loop stops as soon as a pass moves
 * nothing, so open ground still costs a single pass.
 */
const RESOLVE_PASSES = 6;

/**
 * Overlaps smaller than this are left alone, so a player leaning on a trunk does
 * not jitter forever. A tenth of a millimetre is far below anything visible.
 */
export const COLLISION_SKIN_WIDTH = 1e-4;

/**
 * Push a capsule out of anything it is standing inside, then hold it inside the
 * playable area. The capsule is described by the position of its feet, its
 * radius and its total height.
 *
 * Mutates `position` in place and reports whether anything was touched.
 */
export function resolveCapsule(
  position: Vec3,
  radius: number,
  height: number,
  world: CollisionWorld,
): boolean {
  let touched = false;
  const feet = position.y;
  const head = position.y + height;

  for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
    let movedThisPass = false;
    const broadphase = world.broadphase;
    const firstUnindexed = broadphase == null ? 0 : broadphase.count;
    if (broadphase != null) {
      for (const index of nearbyStaticColliders(broadphase, position.x, position.z, radius)) {
        const collider = world.colliders[index];
        if (collider === undefined) continue;
        if (pushOutOfCollider(position, radius, feet, head, collider)) {
          movedThisPass = true;
          touched = true;
        }
      }
    }
    for (let index = firstUnindexed; index < world.colliders.length; index++) {
      if (pushOutOfCollider(position, radius, feet, head, world.colliders[index]!)) {
        movedThisPass = true;
        touched = true;
      }
    }
    const wall = world.lakeWall;
    if (wall !== null && wall.up && pushOutOfLake(position, radius, wall.lake)) {
      movedThisPass = true;
      touched = true;
    }
    if (
      world.stream != null &&
      !isLakeFrozen(world) &&
      pushOutOfDeepStream(position, radius, world.stream)
    ) {
      movedThisPass = true;
      touched = true;
    }
    if (!movedThisPass) break;
  }

  const limit = world.boundsHalfExtent;
  const clampedX = clamp(position.x, -limit, limit);
  const clampedZ = clamp(position.z, -limit, limit);
  if (clampedX !== position.x || clampedZ !== position.z) {
    position.x = clampedX;
    position.z = clampedZ;
    touched = true;
  }

  return touched;
}

/** Push a capsule out of one collider, if it is touching it. */
function pushOutOfCollider(
  position: Vec3,
  radius: number,
  feet: number,
  head: number,
  collider: Collider,
): boolean {
  const span = colliderVerticalSpan(collider);
  // A capsule only collides with something it overlaps vertically.
  if (head <= span.min || feet >= span.max) return false;
  if (!isWithinReach(position, radius, collider)) return false;
  return collider.shape === 'cylinder'
    ? pushOutOfCylinder(position, radius, collider)
    : pushOutOfBox(position, radius, collider);
}

/** Reused so checking the shore makes no garbage; nothing here is kept between calls. */
const shoreScratch: LakeSlope = { depth: 0, towardX: 0, towardZ: 0 };

/**
 * Walk a capsule back from the water until it is just clear of it, straight
 * away from the nearest shore - so someone pressing into the lake slides
 * along the bank instead of sticking to it.
 */
function pushOutOfLake(position: Vec3, radius: number, lake: Lake): boolean {
  if (!isNearLake(lake, position.x, position.z, radius + 1)) return false;
  const shore = lakeSlopeAt(lake, position.x, position.z, shoreScratch);
  // `depth` is how far in from the water's edge the centre is, so the body
  // reaches the water until the centre is a full radius out on dry land.
  const overlap = shore.depth + radius;
  if (overlap <= COLLISION_SKIN_WIDTH) return false;
  position.x -= shore.towardX * overlap;
  position.z -= shore.towardZ * overlap;
  return true;
}

/** Cheap rejection before doing the real shape test. */
function isWithinReach(position: Readonly<Vec3>, radius: number, collider: Collider): boolean {
  const reach = radius + colliderFootprintRadius(collider);
  const dx = position.x - collider.x;
  const dz = position.z - collider.z;
  return dx * dx + dz * dz < reach * reach;
}

function pushOutOfCylinder(position: Vec3, radius: number, collider: CylinderCollider): boolean {
  const dx = position.x - collider.x;
  const dz = position.z - collider.z;
  const minDistance = radius + collider.radius;
  const distanceSquared = dx * dx + dz * dz;
  const settled = minDistance - COLLISION_SKIN_WIDTH;
  if (distanceSquared >= settled * settled) return false;

  const distance = Math.sqrt(distanceSquared);
  if (distance < 1e-6) {
    // Dead centre: pick a fixed direction so the result stays deterministic.
    position.x = collider.x + minDistance;
    return true;
  }
  const scale = minDistance / distance;
  position.x = collider.x + dx * scale;
  position.z = collider.z + dz * scale;
  return true;
}

function pushOutOfBox(position: Vec3, radius: number, collider: BoxCollider): boolean {
  // Work in the box's own frame, where it is axis aligned.
  const sin = Math.sin(-collider.rotationY);
  const cos = Math.cos(-collider.rotationY);
  const worldX = position.x - collider.x;
  const worldZ = position.z - collider.z;
  const localX = worldX * cos - worldZ * sin;
  const localZ = worldX * sin + worldZ * cos;

  const clampedX = clamp(localX, -collider.halfX, collider.halfX);
  const clampedZ = clamp(localZ, -collider.halfZ, collider.halfZ);
  const offsetX = localX - clampedX;
  const offsetZ = localZ - clampedZ;
  const outsideSquared = offsetX * offsetX + offsetZ * offsetZ;

  let targetX = localX;
  let targetZ = localZ;

  if (outsideSquared > COLLISION_SKIN_WIDTH * COLLISION_SKIN_WIDTH) {
    // The capsule centre is outside the box: push along the nearest face or corner.
    const settled = radius - COLLISION_SKIN_WIDTH;
    if (outsideSquared >= settled * settled) return false;
    const outside = Math.sqrt(outsideSquared);
    const scale = radius / outside;
    targetX = clampedX + offsetX * scale;
    targetZ = clampedZ + offsetZ * scale;
  } else {
    // The centre is inside the box: leave by the closest face.
    const gapX = collider.halfX - Math.abs(localX);
    const gapZ = collider.halfZ - Math.abs(localZ);
    if (gapX < gapZ) {
      targetX = Math.sign(localX || 1) * (collider.halfX + radius);
    } else {
      targetZ = Math.sign(localZ || 1) * (collider.halfZ + radius);
    }
  }

  // Back into world space.
  const backSin = Math.sin(collider.rotationY);
  const backCos = Math.cos(collider.rotationY);
  position.x = collider.x + (targetX * backCos - targetZ * backSin);
  position.z = collider.z + (targetX * backSin + targetZ * backCos);
  return true;
}

/** Slide along the wading-depth contour, leaving the banks open as a way round each pool. */
function pushOutOfDeepStream(position: Vec3, radius: number, stream: Stream): boolean {
  const spot = nearestOnStream(stream, position.x, position.z, 6);
  if (spot === null) return false;
  const across = signedStreamAcross(stream, spot, position.x, position.z);
  const side = across < 0 ? -1 : 1;
  const row = Math.round(spot.along / (stream.length / (stream.count - 1)));
  const before = streamPointAt(stream, Math.max(0, row - 1));
  const after = streamPointAt(stream, Math.min(stream.count - 1, row + 1));
  const dx = after.x - before.x,
    dz = after.z - before.z;
  const length = Math.hypot(dx, dz) || 1;
  const nx = (-dz / length) * side,
    nz = (dx / length) * side;
  const depthAt = (reach: number) =>
    streamWaterDepthAt(stream, position.x + nx * reach, position.z + nz * reach);
  if (depthAt(-radius) <= STREAM_WADING_DEPTH) return false;
  let low = -radius,
    high = streamWaterHalfWidthAt(stream, spot.along) + radius;
  for (let pass = 0; pass < 12; pass++) {
    const middle = (low + high) / 2;
    if (depthAt(middle) > STREAM_WADING_DEPTH) low = middle;
    else high = middle;
  }
  position.x += nx * (high + radius + 0.005);
  position.z += nz * (high + radius + 0.005);
  return true;
}
