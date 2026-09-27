import { wrapAngle, type BuriedCacheView } from '@acorn/shared';

/**
 * A way back to a buried stash, whichever way the camera currently happens
 * to be looking.
 *
 * There is no true north in this game - the world has never defined one -
 * so this is relative to wherever the camera is pointed right now, the same
 * way an aimed swing or a cast already is.
 */

/** A flat point, ignoring height. */
export interface FlatPoint {
  readonly x: number;
  readonly z: number;
}

export interface Compass {
  readonly distanceMeters: number;
  /**
   * Degrees to rotate an arrow that points straight up when this is 0.
   * Positive turns it clockwise (to the right), matching CSS's own
   * `rotate()`, so a compass built on this never needs its own sign flipped.
   */
  readonly bearingDegrees: number;
}

/**
 * A compass reading from `from` toward `to`, relative to `cameraYaw`.
 *
 * `cameraYaw` uses the same convention facing does everywhere else in this
 * game: 0 looks down -Z (see `FollowCamera` and `stepAnimals`).
 */
export function compassTo(from: FlatPoint, to: FlatPoint, cameraYaw: number): Compass {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  // The world yaw that would look straight at `to` - the same atan2(-dx,
  // -dz) shape the server already uses to turn a direction into a yaw.
  const worldYaw = Math.atan2(-dx, -dz);
  return {
    distanceMeters: Math.hypot(dx, dz),
    bearingDegrees: (wrapAngle(cameraYaw - worldYaw) * 180) / Math.PI,
  };
}

/**
 * A compass toward the nearest cache this player owns, or null while they
 * do not have one buried anywhere in the world right now.
 */
export function compassToOwnCache(
  from: FlatPoint,
  caches: readonly BuriedCacheView[],
  selfNetId: number,
  cameraYaw: number,
): Compass | null {
  let nearest: BuriedCacheView | null = null;
  let nearestDistanceSquared = Infinity;
  for (const cache of caches) {
    if (cache.ownerNetId !== selfNetId) continue;
    const dx = cache.x - from.x;
    const dz = cache.z - from.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearest = cache;
    }
  }
  return nearest === null ? null : compassTo(from, nearest, cameraYaw);
}
