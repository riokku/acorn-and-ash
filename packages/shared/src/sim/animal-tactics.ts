import type { Point2D, Direction2D } from './animals';

/** A tangential stalk with a gentle radial correction; every caller gets a unit direction. */
export function stalkingDirection(
  from: Point2D,
  target: Point2D,
  radius: number,
  side: number,
): Direction2D {
  const dx = target.x - from.x,
    dz = target.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return { x: 0, z: 0 };
  const x = dx / distance,
    z = dz / distance;
  const inward = Math.max(-0.8, Math.min(0.9, (distance - radius) * 0.8));
  const vx = x * inward - z * side * 0.8,
    vz = z * inward + x * side * 0.8;
  const length = Math.hypot(vx, vz);
  return { x: vx / length, z: vz / length };
}
/** Direction is fixed when the wind-up begins; getting behind it is a valid defense. */
export function directionalBiteHits(
  from: Point2D,
  yaw: number,
  victim: Point2D,
  reach: number,
  cosine: number,
): boolean {
  const dx = victim.x - from.x,
    dz = victim.z - from.z;
  const distance = Math.hypot(dx, dz);
  return (
    distance <= reach &&
    (distance < 0.001 || (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / distance >= cosine)
  );
}
