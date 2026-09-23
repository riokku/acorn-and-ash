/**
 * Catching wildlife.
 *
 * The same swing that fells a tree catches whatever animal is in reach, so
 * this reuses chopping's own reach and facing rule rather than inventing a
 * second one. The rule lives here so the client can hint which animal a
 * swing would land on; only the server decides whether it actually lands.
 */

import { CHOP_FACING_COSINE, CHOP_REACH } from '../constants';
import type { Vec3 } from '../math/vec3';

/** A point a swing could land on: an animal's id and where it is right now. */
export interface CatchCandidate {
  readonly id: number;
  readonly x: number;
  readonly z: number;
}

/**
 * The animal this swing would land on, or null.
 *
 * Judged the same way as a tree: roughly in front of where the camera is
 * looking, and close enough to hit. Unlike a tree there is no trunk to
 * measure to the surface of - an animal has no collider yet - so reach is
 * measured straight to wherever it is standing.
 */
export function animalInReach<T extends CatchCandidate>(
  position: Readonly<Vec3>,
  aimYaw: number,
  animals: readonly T[],
): T | null {
  // Yaw 0 looks down -Z, matching the way movement reads it.
  const forwardX = -Math.sin(aimYaw);
  const forwardZ = -Math.cos(aimYaw);

  let best: T | null = null;
  let bestDistance = CHOP_REACH;

  for (const animal of animals) {
    const dx = animal.x - position.x;
    const dz = animal.z - position.z;
    const distance = Math.hypot(dx, dz);
    // Standing right on top of it is not a reach worth judging the facing of.
    if (distance < 1e-6 || distance > bestDistance) continue;

    const facing = (dx / distance) * forwardX + (dz / distance) * forwardZ;
    if (facing < CHOP_FACING_COSINE) continue;

    best = animal;
    bestDistance = distance;
  }

  return best;
}
