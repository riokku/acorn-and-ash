/**
 * How wildlife moves.
 *
 * A rabbit does two things: amble between a few points near its den, and
 * bolt from anyone who gets close. The wander target comes from the world
 * seed the same way a tree's regrowth does, so the server and every browser
 * would agree even if a client ever needed to predict it; fleeing needs no
 * randomness at all, since "away from the nearest player" is decided by
 * state both ends already share.
 */

import type { AnimalKind } from '../data/animals';
import { ANIMAL_TARGET_REACHED_DISTANCE } from '../constants';
import { createRng, hashSeed } from '../rng';
import { TAU } from '../math/angles';

export interface Direction2D {
  readonly x: number;
  readonly z: number;
}

/** A ground position, ignoring height. */
export interface Point2D {
  readonly x: number;
  readonly z: number;
}

/**
 * Whether a rabbit should be fleeing right now.
 *
 * Hysteresis: getting close startles it at `alertRadius`, but it only calms
 * down once a player has fallen back to `safeRadius`, further out. Without
 * the gap, standing right at the edge of noticing it would flicker between
 * the two every tick.
 */
export function shouldFlee(
  currentlyFleeing: boolean,
  nearestPlayerDistance: number,
  kind: Pick<AnimalKind, 'alertRadius' | 'safeRadius'>,
): boolean {
  return currentlyFleeing
    ? nearestPlayerDistance < kind.safeRadius
    : nearestPlayerDistance < kind.alertRadius;
}

/**
 * Straight away from whatever startled it, as a unit vector.
 *
 * Recomputed fresh every tick rather than fixed at the moment it started
 * fleeing, so it keeps curving away as a chase closes in from a new angle
 * instead of running an arrow-straight line that stops making sense.
 */
export function fleeDirection(x: number, z: number, threatX: number, threatZ: number): Direction2D {
  const dx = x - threatX;
  const dz = z - threatZ;
  const distance = Math.hypot(dx, dz);
  // Standing exactly on top of it has no "away" to compute; picking a fixed
  // direction is as good as any other and keeps this pure.
  if (distance < 1e-6) return { x: 0, z: 1 };
  return { x: dx / distance, z: dz / distance };
}

/** Toward a point, as a unit vector, or standing still once there is nowhere left to go. */
export function towardDirection(
  x: number,
  z: number,
  targetX: number,
  targetZ: number,
): Direction2D {
  const dx = targetX - x;
  const dz = targetZ - z;
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-6) return { x: 0, z: 0 };
  return { x: dx / distance, z: dz / distance };
}

/** Close enough to a wander target to call it arrived and pick a new one. */
export function hasReachedTarget(x: number, z: number, targetX: number, targetZ: number): boolean {
  return Math.hypot(targetX - x, targetZ - z) <= ANIMAL_TARGET_REACHED_DISTANCE;
}

/**
 * The next point to amble toward.
 *
 * Drawn fresh from the world seed, this animal's id and how many wander
 * decisions it has made before - the same "hash the seed and a growing
 * count" trick `regrowDueAtMs` uses for trees - so nothing about a rabbit's
 * path has to be stored or sent, only replayed.
 */
export function wanderTarget(
  worldSeed: number,
  animalId: number,
  decisionSeq: number,
  denX: number,
  denZ: number,
  leashRadius: number,
): Point2D {
  const rng = createRng(hashSeed('wander', worldSeed, animalId, decisionSeq));
  const angle = rng.nextRange(0, TAU);
  const radius = rng.nextRange(0, leashRadius);
  return { x: denX + Math.cos(angle) * radius, z: denZ + Math.sin(angle) * radius };
}
