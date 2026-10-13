import { clamp, type Vec3 } from '../math/vec3';
import type { Collider, CylinderCollider } from '../world/colliders';

interface Point {
  x: number;
  z: number;
}
export interface SolidSurface {
  /** Triangle soup relative to the collider's x/baseY/z, already rotated and scaled. */
  readonly triangles: Float32Array;
  readonly footprint: readonly Point[];
}

const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
function hull(points: Point[]): Point[] {
  points.sort((a, b) => a.x - b.x || a.z - b.z);
  const outline: Point[] = [];
  for (const point of points) {
    while (
      outline.length > 1 &&
      cross(outline[outline.length - 2]!, outline[outline.length - 1]!, point) <= 0
    )
      outline.pop();
    outline.push(point);
  }
  const lower = outline.length;
  for (let i = points.length - 2; i >= 0; i--) {
    const point = points[i]!;
    while (
      outline.length > lower &&
      cross(outline[outline.length - 2]!, outline[outline.length - 1]!, point) <= 0
    )
      outline.pop();
    outline.push(point);
  }
  outline.pop();
  return outline;
}

/** Build a static, bounded collider from the very triangles used to draw a rock. */
export function surfaceCollider(
  x: number,
  y: number,
  z: number,
  positions: ArrayLike<number>,
  yaw = 0,
  scale = 1,
): CylinderCollider {
  let bottom = Infinity,
    top = -Infinity,
    radius = 0;
  const triangles = new Float32Array(positions.length);
  const points: Point[] = [];
  const sin = Math.sin(yaw),
    cos = Math.cos(yaw);
  for (let i = 0; i < positions.length; i += 3) {
    const px = positions[i]! * scale,
      pz = positions[i + 2]! * scale;
    triangles[i] = px * cos + pz * sin;
    triangles[i + 1] = positions[i + 1]! * scale;
    triangles[i + 2] = -px * sin + pz * cos;
    bottom = Math.min(bottom, triangles[i + 1]!);
    top = Math.max(top, triangles[i + 1]!);
    radius = Math.max(radius, Math.hypot(triangles[i]!, triangles[i + 2]!));
    points.push({ x: triangles[i]!, z: triangles[i + 2]! });
  }
  for (let i = 1; i < triangles.length; i += 3) triangles[i] = triangles[i]! - bottom;
  return {
    shape: 'cylinder',
    x,
    z,
    baseY: y + bottom,
    height: top - bottom,
    radius,
    standable: true,
    surface: { triangles, footprint: hull(points) },
  };
}

/** Height directly under the feet; null beyond the actual surface, including its corners. */
export function colliderTopAt(collider: Collider, x: number, z: number): number | null {
  if (!collider.standable) return null;
  if (collider.shape === 'box') {
    const dx = x - collider.x,
      dz = z - collider.z,
      sin = Math.sin(collider.rotationY),
      cos = Math.cos(collider.rotationY);
    if (
      Math.abs(dx * cos + dz * sin) > collider.halfX ||
      Math.abs(-dx * sin + dz * cos) > collider.halfZ
    )
      return null;
    return collider.y + collider.halfY;
  }
  const px = x - collider.x,
    pz = z - collider.z;
  if (px * px + pz * pz > collider.radius * collider.radius) return null;
  if (!collider.surface) return collider.baseY + collider.height;
  let highest = -Infinity;
  const vertices = collider.surface.triangles;
  for (let i = 0; i < vertices.length; i += 9) {
    const ax = vertices[i]!,
      az = vertices[i + 2]!,
      bx = vertices[i + 3]!,
      bz = vertices[i + 5]!,
      cx = vertices[i + 6]!,
      cz = vertices[i + 8]!;
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 1e-10) continue;
    const a = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / denominator;
    const b = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / denominator;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    highest = Math.max(highest, a * vertices[i + 1]! + b * vertices[i + 4]! + c * vertices[i + 7]!);
  }
  return highest === -Infinity ? null : collider.baseY + highest;
}

/** Resolve against the stone's outline at the body's height, rather than an oversized cylinder. */
export function pushOutOfSurface(
  position: Vec3,
  radius: number,
  head: number,
  collider: CylinderCollider,
  skin: number,
): boolean {
  const surface = collider.surface!;
  const top = colliderTopAt(collider, position.x, position.z);
  // Standing on the roof must not be pushed sideways by the roof's own slope.
  if (top !== null && position.y >= top - skin) return false;
  const low = position.y - collider.baseY,
    high = head - collider.baseY;
  let outline = surface.footprint;
  if (low > 0 || high < collider.height) {
    const points: Point[] = [];
    const vertices = surface.triangles;
    for (let i = 0; i < vertices.length; i += 9) {
      for (let j = 0; j < 3; j++) {
        const a = i + j * 3,
          b = i + ((j + 1) % 3) * 3;
        const ay = vertices[a + 1]!,
          by = vertices[b + 1]!;
        if (ay >= low && ay <= high) points.push({ x: vertices[a]!, z: vertices[a + 2]! });
        for (const plane of [low, high]) {
          if ((ay < plane && by > plane) || (ay > plane && by < plane)) {
            const t = (plane - ay) / (by - ay);
            points.push({
              x: vertices[a]! + (vertices[b]! - vertices[a]!) * t,
              z: vertices[a + 2]! + (vertices[b + 2]! - vertices[a + 2]!) * t,
            });
          }
        }
      }
    }
    outline = hull(points);
  }
  if (outline.length < 3) return false;
  const point = { x: position.x - collider.x, z: position.z - collider.z };
  let inside = true,
    distanceSquared = Infinity,
    closestX = 0,
    closestZ = 0,
    normalX = 1,
    normalZ = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!;
    if (cross(a, b, point) < 0) inside = false;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      lengthSquared = dx * dx + dz * dz;
    const t = clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared, 0, 1);
    const x = a.x + t * dx,
      z = a.z + t * dz;
    const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (distance < distanceSquared) {
      distanceSquared = distance;
      closestX = x;
      closestZ = z;
      const length = Math.sqrt(lengthSquared);
      normalX = dz / length;
      normalZ = -dx / length;
    }
  }
  if (!inside && distanceSquared >= (radius - skin) ** 2) return false;
  if (!inside && distanceSquared > 1e-12) {
    const distance = Math.sqrt(distanceSquared);
    normalX = (point.x - closestX) / distance;
    normalZ = (point.z - closestZ) / distance;
  }
  position.x = collider.x + closestX + normalX * radius;
  position.z = collider.z + closestZ + normalZ * radius;
  return true;
}
