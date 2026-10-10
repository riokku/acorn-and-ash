import type { Terrain, Vec3 } from '@acorn/shared';

/**
 * Intersect the actual rolling ground rather than the old clearing's y=0 plane.
 *
 * With a `floor`, anything lower than it counts as that high: a boat is aimed
 * at the lake's surface, not at the bed under it.
 */
export function groundAlongRay(
  origin: Readonly<Vec3>,
  direction: Readonly<Vec3>,
  terrain: Terrain,
  floor: number | ((x: number, z: number) => number) = Number.NEGATIVE_INFINITY,
): { x: number; z: number } | null {
  const clearance = (distance: number): number =>
    origin.y +
    direction.y * distance -
    Math.max(
      typeof floor === 'number'
        ? floor
        : floor(origin.x + direction.x * distance, origin.z + direction.z * distance),
      terrain.heightAt(origin.x + direction.x * distance, origin.z + direction.z * distance),
    );
  if (clearance(0) < 0) return null;
  for (let distance = 2; distance <= 300; distance += 2) {
    if (clearance(distance) > 0) continue;
    let low = distance - 2,
      high = distance;
    for (let step = 0; step < 10; step++) {
      const mid = (low + high) / 2;
      if (clearance(mid) > 0) low = mid;
      else high = mid;
    }
    return { x: origin.x + direction.x * high, z: origin.z + direction.z * high };
  }
  return null;
}
