/**
 * What a left click on the world is pointing at.
 *
 * A click turns the character to face whatever is under the cursor (see
 * decision 0051) - never the camera, which only a right-button drag turns.
 * Worked out from the ray under the cursor: the first tree or animal it passes
 * through wins, so clicking a tree's canopy faces that tree's trunk rather
 * than some patch of ground behind it; failing that, the patch of ground it
 * lands on, which covers the water too.
 *
 * Plain numbers in and out, no Three.js, so it can be tested on its own.
 */

import type { Vec3 } from '@acorn/shared';

/** The ray under the cursor. `direction` must be normalised. */
export interface ClickRay {
  readonly origin: Readonly<Vec3>;
  readonly direction: Readonly<Vec3>;
}

/**
 * Something a click can land on, as an upright cylinder. A tree is two - a
 * narrow trunk and a wide canopy - both pointing at the same spot.
 */
export interface ClickCandidate {
  /** Where to face if this is what was clicked: a trunk's middle, an animal's. */
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly bottom: number;
  readonly top: number;
}

/**
 * Closer than this and a click is on the character's own feet: there is no
 * sensible way to face it, so the character keeps whatever heading it had.
 */
export const MIN_CLICK_DISTANCE = 0.3;

/**
 * How far along the ray it first enters this upright cylinder, or null if it
 * misses. Zero if the ray starts inside.
 */
export function rayEntersCylinder(ray: ClickRay, cylinder: ClickCandidate): number | null {
  let enter = 0;
  let exit = Number.POSITIVE_INFINITY;

  // Between the bottom and the top.
  const { origin, direction } = ray;
  if (Math.abs(direction.y) < 1e-9) {
    if (origin.y < cylinder.bottom || origin.y > cylinder.top) return null;
  } else {
    let near = (cylinder.bottom - origin.y) / direction.y;
    let far = (cylinder.top - origin.y) / direction.y;
    if (near > far) [near, far] = [far, near];
    enter = Math.max(enter, near);
    exit = Math.min(exit, far);
  }

  // Within the radius, looking straight down on it.
  const offsetX = origin.x - cylinder.x;
  const offsetZ = origin.z - cylinder.z;
  const a = direction.x * direction.x + direction.z * direction.z;
  const radiusSquared = cylinder.radius * cylinder.radius;
  const startsWithin = offsetX * offsetX + offsetZ * offsetZ - radiusSquared;
  if (a < 1e-12) {
    if (startsWithin > 0) return null;
  } else {
    const b = 2 * (offsetX * direction.x + offsetZ * direction.z);
    const discriminant = b * b - 4 * a * startsWithin;
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    enter = Math.max(enter, (-b - root) / (2 * a));
    exit = Math.min(exit, (-b + root) / (2 * a));
  }

  return enter <= exit ? enter : null;
}

/**
 * Which way to face for a click along this ray, or null to keep facing
 * whichever way the character already does.
 *
 * `groundY` is the height of the flat ground the click falls back to - the
 * player's own, which is exact in the clearing and close enough out in the
 * hills for picking a direction.
 */
export function clickAimYaw(
  ray: ClickRay,
  player: Readonly<Vec3>,
  groundY: number,
  candidates: readonly ClickCandidate[],
): number | null {
  // Anything past where the ray meets the ground is hidden behind it.
  const groundDistance =
    ray.direction.y < -1e-9 ? (groundY - ray.origin.y) / ray.direction.y : Number.POSITIVE_INFINITY;

  let nearest: ClickCandidate | null = null;
  let nearestDistance = groundDistance;
  for (const candidate of candidates) {
    const distance = rayEntersCylinder(ray, candidate);
    if (distance !== null && distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  const target =
    nearest ??
    (Number.isFinite(groundDistance)
      ? {
          x: ray.origin.x + ray.direction.x * groundDistance,
          z: ray.origin.z + ray.direction.z * groundDistance,
        }
      : null);
  if (target === null) return null;
  return yawTowards(player, target);
}

/**
 * The heading that faces `to` from `from`, or null if they are too close
 * together for that to mean anything. Yaw 0 looks down -Z, the same as
 * walking and chopping read it.
 */
export function yawTowards(
  from: Readonly<{ x: number; z: number }>,
  to: Readonly<{ x: number; z: number }>,
): number | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.hypot(dx, dz) < MIN_CLICK_DISTANCE) return null;
  return Math.atan2(-dx, -dz);
}
