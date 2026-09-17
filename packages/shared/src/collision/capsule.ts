import { PLAYABLE_HALF_EXTENT } from '../constants';
import { clamp, type Vec3 } from '../math/vec3';
import {
  colliderFootprintRadius,
  colliderVerticalSpan,
  type BoxCollider,
  type Collider,
  type CylinderCollider,
} from '../world/colliders';
import type { Terrain } from '../world/terrain';

/** Everything the movement code needs to know about the world around it. */
export interface CollisionWorld {
  readonly terrain: Terrain;
  readonly colliders: readonly Collider[];
  /** Players are held inside this square, measured from the origin. */
  readonly boundsHalfExtent: number;
}

export function createCollisionWorld(
  terrain: Terrain,
  colliders: readonly Collider[],
  boundsHalfExtent: number = PLAYABLE_HALF_EXTENT,
): CollisionWorld {
  return { terrain, colliders, boundsHalfExtent };
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
    for (const collider of world.colliders) {
      const span = colliderVerticalSpan(collider);
      // A capsule only collides with something it overlaps vertically.
      if (head <= span.min || feet >= span.max) continue;
      if (!isWithinReach(position, radius, collider)) continue;

      const pushed =
        collider.shape === 'cylinder'
          ? pushOutOfCylinder(position, radius, collider)
          : pushOutOfBox(position, radius, collider);
      if (pushed) {
        movedThisPass = true;
        touched = true;
      }
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
