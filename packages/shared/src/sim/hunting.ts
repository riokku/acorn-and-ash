/**
 * Catching wildlife.
 *
 * The same swing that fells a tree catches whatever animal is in reach, so
 * this reuses chopping's own reach and facing rule rather than inventing a
 * second one. The rule lives here so the client can hint which animal a
 * swing would land on; only the server decides whether it actually lands.
 */

import { CHOP_FACING_COSINE, CHOP_REACH } from '../constants';
import { STRIKE, whirlwindTurn } from '../data/moves';
import { wrapAngle } from '../math/angles';
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

/** One target in a whirlwind, including height so a ledge stays safe. */
export interface WhirlwindCandidate extends CatchCandidate {
  readonly y: number;
  /** Trees measure reach to the trunk surface. Creatures retain their usual centre reach. */
  readonly radius?: number;
}

export interface WhirlwindSweep {
  readonly age: number;
  readonly yaw: number;
  readonly previousYaw?: number;
}

/** Targets crossed by this slice of the visible axe's turn, deduplicating history samples. */
export function whirlwindTargets<T extends WhirlwindCandidate>(
  position: Readonly<Vec3>,
  candidates: readonly T[],
  sweep?: WhirlwindSweep,
  alreadyHit?: ReadonlySet<number>,
): T[] {
  const found = new Map<number, T>();
  for (const candidate of candidates) {
    if (alreadyHit?.has(candidate.id)) continue;
    if (Math.abs(candidate.y - position.y) > STRIKE.height) continue;
    const dx = candidate.x - position.x,
      dz = candidate.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance - (candidate.radius ?? 0) > CHOP_REACH + 1e-6) continue;
    if (sweep !== undefined) {
      const turn = Math.PI * 2;
      // The extended right hand starts on the rider's right; positive model
      // rotation sweeps through the front, left and back. Cover the whole
      // interval between ticks so a fast blade cannot skip a narrow target.
      const previousYaw = sweep.previousYaw ?? sweep.yaw;
      const from = previousYaw - Math.PI / 2 + whirlwindTurn(sweep.age - 1) * turn;
      const travel =
        (whirlwindTurn(sweep.age) - whirlwindTurn(sweep.age - 1)) * turn +
        wrapAngle(sweep.yaw - previousYaw);
      const slack = Math.asin(
        Math.min(1, Math.max(0.3, candidate.radius ?? 0) / Math.max(1e-6, distance)),
      );
      const offset =
        ((((Math.atan2(-dx, -dz) - from) * (travel < 0 ? -1 : 1) + slack) % turn) + turn) % turn;
      if (offset > Math.abs(travel) + 2 * slack) continue;
    }
    found.set(candidate.id, candidate);
  }
  return [...found.values()];
}
