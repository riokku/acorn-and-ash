/**
 * The simple shapes the world is built from.
 *
 * We deliberately do not use a physics engine. Trees are cylinders, rocks and
 * walls are boxes, and the player is a capsule pushed out of whatever it ends up
 * inside. See docs/decisions/0003-kinematic-collision.md.
 */

export interface CylinderCollider {
  readonly shape: 'cylinder';
  readonly x: number;
  readonly z: number;
  /** Bottom of the cylinder in world space. */
  readonly baseY: number;
  readonly height: number;
  readonly radius: number;
}

export interface BoxCollider {
  readonly shape: 'box';
  /** Centre of the box. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfY: number;
  readonly halfZ: number;
  /** Rotation about the Y axis, in radians. */
  readonly rotationY: number;
}

export type Collider = CylinderCollider | BoxCollider;

export function cylinder(
  x: number,
  z: number,
  radius: number,
  height: number,
  baseY = 0,
): CylinderCollider {
  return { shape: 'cylinder', x, z, radius, height, baseY };
}

export function box(
  x: number,
  y: number,
  z: number,
  halfX: number,
  halfY: number,
  halfZ: number,
  rotationY = 0,
): BoxCollider {
  return { shape: 'box', x, y, z, halfX, halfY, halfZ, rotationY };
}

/** Lowest and highest point of a collider, used for the vertical overlap test. */
export function colliderVerticalSpan(collider: Collider): { min: number; max: number } {
  if (collider.shape === 'cylinder') {
    return { min: collider.baseY, max: collider.baseY + collider.height };
  }
  return { min: collider.y - collider.halfY, max: collider.y + collider.halfY };
}

/** A cheap circle that contains the collider when seen from above. */
export function colliderFootprintRadius(collider: Collider): number {
  if (collider.shape === 'cylinder') return collider.radius;
  return Math.sqrt(collider.halfX * collider.halfX + collider.halfZ * collider.halfZ);
}
