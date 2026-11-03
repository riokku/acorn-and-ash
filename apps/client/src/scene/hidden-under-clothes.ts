import * as THREE from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';

/**
 * Hides the parts of a body that clothes cover completely (decision 0284), so
 * nothing underneath can poke through the cloth however the body bends.
 *
 * Every corner of a body triangle looks straight out from the skin. If each one
 * meets the inside of the cloth within `REACH`, or sits just outside it, the
 * whole triangle is under it and is not drawn. Triangles at a cuff, collar or
 * hem keep at least one corner in the open, so the body still meets the cloth
 * there with no gap.
 */

/** How far out from the skin cloth can sit and still cover it, in metres. */
const REACH = 0.07;
/** How far the body can stand proud of the cloth and still count as under it. */
const THROUGH = 0.03;
/** The look starts this far inside the skin, so cloth touching the skin still counts. */
const START_INSIDE = 0.003;

/**
 * A skinned mesh's geometry, and what takes it to one bone's frame as it stood
 * when bound. Every piece measured against the same bone of the same skeleton
 * lines up, whichever way its file packed its vertices.
 */
export interface BoundGeometry {
  readonly geometry: THREE.BufferGeometry;
  readonly toBone: THREE.Matrix4;
}

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * The body's geometry without the triangles `covers` hide: the same vertices,
 * fewer triangles. It is shared by every body wearing the same thing, so it is
 * never freed while the game runs.
 */
export function bodyUnderClothes(
  body: BoundGeometry,
  covers: readonly BoundGeometry[],
): THREE.BufferGeometry {
  const key = [body.geometry.uuid, ...covers.map((cover) => cover.geometry.uuid).sort()].join('|');
  let masked = cache.get(key);
  if (masked === undefined) {
    masked = withTriangles(body.geometry, uncoveredTriangles(body, covers));
    cache.set(key, masked);
  }
  return masked;
}

/** The corners of every body triangle left in view, as an index. */
export function uncoveredTriangles(
  body: BoundGeometry,
  covers: readonly BoundGeometry[],
): number[] {
  const corners = trianglesOf(body.geometry);
  if (covers.length === 0) return corners;
  const cloth = new MeshBVH(restShape(covers));
  const position = body.geometry.getAttribute('position');
  const normal = body.geometry.getAttribute('normal');
  const toRest = body.toBone;
  const normalToRest = new THREE.Matrix3().getNormalMatrix(toRest);
  const ray = new THREE.Ray();
  const covered = new Uint8Array(position.count);
  const skin = new THREE.Vector3();
  const out = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex++) {
    skin.fromBufferAttribute(position, vertex).applyMatrix4(toRest);
    out.fromBufferAttribute(normal, vertex).applyMatrix3(normalToRest).normalize();
    // Under the cloth: looking out, it meets the cloth's inside, which faces the same way.
    // Its outside, met from beyond it (under a chin, say), faces back, and covers nothing.
    ray.set(skin.clone().addScaledVector(out, -START_INSIDE), out);
    const over = cloth.raycastFirst(ray, THREE.DoubleSide, 0, REACH + START_INSIDE);
    // Through the cloth: a bulge of the body standing just proud of it, which looking back
    // in meets the cloth's outside.
    ray.set(skin.clone().addScaledVector(out, START_INSIDE), out.clone().negate());
    const under = cloth.raycastFirst(ray, THREE.DoubleSide, 0, THROUGH + START_INSIDE);
    covered[vertex] =
      (over?.face && over.face.normal.dot(out) > 0) ||
      (under?.face && under.face.normal.dot(out) > 0)
        ? 1
        : 0;
  }
  const kept: number[] = [];
  for (let at = 0; at < corners.length; at += 3) {
    const [a, b, c] = [corners[at]!, corners[at + 1]!, corners[at + 2]!];
    if (covered[a] === 0 || covered[b] === 0 || covered[c] === 0) kept.push(a, b, c);
  }
  return kept;
}

/** Every cover's triangles where they sat when bound, as one plain mesh to look against. */
function restShape(covers: readonly BoundGeometry[]): THREE.BufferGeometry {
  const points: number[] = [];
  const corner = new THREE.Vector3();
  for (const cover of covers) {
    const position = cover.geometry.getAttribute('position');
    for (const vertex of trianglesOf(cover.geometry)) {
      corner.fromBufferAttribute(position, vertex).applyMatrix4(cover.toBone);
      points.push(corner.x, corner.y, corner.z);
    }
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return shape;
}

function trianglesOf(geometry: THREE.BufferGeometry): number[] {
  const index = geometry.getIndex();
  if (index !== null) return Array.from(index.array);
  return Array.from({ length: geometry.getAttribute('position').count }, (_, at) => at);
}

/** The same vertices (shared, not copied) drawn as just these triangles. */
function withTriangles(source: THREE.BufferGeometry, corners: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes))
    geometry.setAttribute(name, attribute);
  geometry.morphAttributes = source.morphAttributes;
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.setIndex(corners);
  geometry.boundingBox = source.boundingBox;
  geometry.boundingSphere = source.boundingSphere;
  geometry.name = source.name;
  return geometry;
}
