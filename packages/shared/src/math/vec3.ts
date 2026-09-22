/** A point or direction in world space. 1 unit = 1 metre, Y is up. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function copyVec3(target: Vec3, source: Readonly<Vec3>): Vec3 {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  return target;
}

export function cloneVec3(source: Readonly<Vec3>): Vec3 {
  return { x: source.x, y: source.y, z: source.z };
}

/** Distance ignoring height, which is what most gameplay checks care about. */
export function horizontalDistance(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function horizontalDistanceSquared(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function distance(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

/**
 * 0 at and before `edge0`, 1 at and after `edge1`, eased in between.
 *
 * The ease has zero slope at both ends, so terrain blended with this never
 * shows a crease where it meets flat ground.
 */
export function smoothstep(value: number, edge0: number, edge1: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Step `from` toward `to` by at most `maxDelta`. */
export function moveToward(from: number, to: number, maxDelta: number): number {
  const delta = to - from;
  if (Math.abs(delta) <= maxDelta) return to;
  return from + Math.sign(delta) * maxDelta;
}
