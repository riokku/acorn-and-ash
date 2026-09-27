import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { seededRandom } from './noise';

/**
 * Building blocks for the game's own models (see decision 0053): logs with
 * bark and a cut end, planks whose grain runs the long way, rough stones -
 * each with its texture laid on at a real-world size, so every plank's grain
 * and every log's bark comes out the same scale however long it is.
 *
 * Seeded rather than random, so a model comes out exactly the same every
 * time and in every browser.
 */

/**
 * Collects a model's parts and merges everything that shares a material into
 * one mesh - a cabin of forty logs costs a handful of draw calls, not forty.
 */
export class ModelBuilder {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  /** Add a part, moved into place by `matrix` if given. Takes ownership of `geometry`. */
  add(material: THREE.Material, geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): this {
    let part = geometry.index === null ? geometry : geometry.toNonIndexed();
    if (part !== geometry) geometry.dispose();
    for (const name of Object.keys(part.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') part.deleteAttribute(name);
    }
    if (part.attributes.uv === undefined) {
      const count = part.attributes.position?.count ?? 0;
      part.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (part.attributes.normal === undefined) part.computeVertexNormals();
    if (matrix !== undefined) part = part.applyMatrix4(matrix);
    const list = this.parts.get(material);
    if (list === undefined) this.parts.set(material, [part]);
    else list.push(part);
    return this;
  }

  /**
   * One mesh per material, casting and catching shadows. The materials are
   * shared, painted ones (see materials.ts), so disposing the model only
   * ever frees its own geometry.
   */
  build(): { group: THREE.Group; dispose(): void } {
    const group = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];
    for (const [material, parts] of this.parts) {
      const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
      if (merged === undefined || merged === null) continue;
      if (merged !== parts[0]) for (const part of parts) part.dispose();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      geometries.push(merged);
    }
    this.parts.clear();
    return {
      group,
      dispose: () => {
        for (const geometry of geometries) geometry.dispose();
      },
    };
  }
}

/** A place and turn for a part, without writing out a whole matrix each time. */
export function placed(
  x: number,
  y: number,
  z: number,
  rotation: { x?: number; y?: number; z?: number } = {},
  scale: number | { x: number; y: number; z: number } = 1,
): THREE.Matrix4 {
  const size = typeof scale === 'number' ? { x: scale, y: scale, z: scale } : scale;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0, 'YXZ'),
    ),
    new THREE.Vector3(size.x, size.y, size.z),
  );
}

export interface LogOptions {
  readonly sides?: number;
  /** How much thinner the far end is, as a fraction of the radius. */
  readonly taper?: number;
  /** How lumpy the log is, as a fraction of the radius. */
  readonly wobble?: number;
  readonly seed?: number;
  /** How many metres one copy of the bark texture covers. */
  readonly tile?: number;
  /** Leave off the cut end at each end (a post sunk in the ground has only a top). */
  readonly caps?: 'both' | 'end' | 'none';
  /** How far apart its rings of corners are: further apart is fewer triangles, and less lumpy. */
  readonly ringEvery?: number;
}

/**
 * A log lying along X, centred on the origin: a slightly lumpy, tapering
 * many-sided tube with bark on it (`side`, grain running along its length)
 * and a round cut face at each end (`ends`, for the log-end picture).
 */
export function logGeometry(
  length: number,
  radius: number,
  options: LogOptions = {},
): { side: THREE.BufferGeometry; ends: THREE.BufferGeometry } {
  const sides = options.sides ?? 8;
  const taper = options.taper ?? 0.06;
  const wobble = options.wobble ?? 0.06;
  const tile = options.tile ?? 0.7;
  const random = seededRandom(options.seed ?? 1);
  const rings = Math.max(2, Math.ceil(length / (options.ringEvery ?? 0.6)) + 1);

  // Each ring of corners gets its own small bumps, so no two logs match.
  const radiusAt: number[][] = [];
  for (let ring = 0; ring < rings; ring++) {
    const along = ring / (rings - 1);
    const row: number[] = [];
    for (let corner = 0; corner < sides; corner++) {
      row.push(radius * (1 - taper * along) * (1 + (random() * 2 - 1) * wobble));
    }
    radiusAt.push(row);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const circumference = Math.PI * 2 * radius;
  for (let ring = 0; ring < rings; ring++) {
    const along = ring / (rings - 1);
    const x = -length / 2 + along * length;
    for (let corner = 0; corner <= sides; corner++) {
      const angle = (corner / sides) * Math.PI * 2;
      const r = radiusAt[ring]?.[corner % sides] ?? radius;
      positions.push(x, Math.cos(angle) * r, Math.sin(angle) * r);
      uvs.push(((corner / sides) * circumference) / tile, (along * length) / tile);
    }
  }
  const stride = sides + 1;
  for (let ring = 0; ring < rings - 1; ring++) {
    for (let corner = 0; corner < sides; corner++) {
      const a = ring * stride + corner;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  side.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  side.setIndex(indices);
  side.computeVertexNormals();

  const capPositions: number[] = [];
  const capUvs: number[] = [];
  const capIndices: number[] = [];
  const caps = options.caps ?? 'both';
  const endsWanted = caps === 'both' ? [0, rings - 1] : caps === 'end' ? [rings - 1] : [];
  // A little rotation of the picture per log, so every log end is not the same.
  const spin = random() * Math.PI * 2;
  for (const ring of endsWanted) {
    const x = -length / 2 + (ring / (rings - 1)) * length;
    const facing = ring === 0 ? -1 : 1;
    const centre = capPositions.length / 3;
    capPositions.push(x, 0, 0);
    capUvs.push(0.5, 0.5);
    for (let corner = 0; corner <= sides; corner++) {
      const angle = (corner / sides) * Math.PI * 2;
      const r = radiusAt[ring]?.[corner % sides] ?? radius;
      capPositions.push(x, Math.cos(angle) * r, Math.sin(angle) * r);
      capUvs.push(0.5 + Math.cos(angle + spin) * 0.45, 0.5 + Math.sin(angle + spin) * 0.45);
    }
    for (let corner = 0; corner < sides; corner++) {
      const a = centre + 1 + corner;
      const b = a + 1;
      if (facing > 0) capIndices.push(centre, a, b);
      else capIndices.push(centre, b, a);
    }
  }
  const ends = new THREE.BufferGeometry();
  ends.setAttribute('position', new THREE.Float32BufferAttribute(capPositions, 3));
  ends.setAttribute('uv', new THREE.Float32BufferAttribute(capUvs, 2));
  ends.setIndex(capIndices);
  ends.computeVertexNormals();
  return { side, ends };
}

/**
 * A board or beam, `width` along X, `height` along Y and `depth` along Z,
 * centred on the origin, with its texture laid on at `tile` metres a copy
 * and the grain running along whichever axis `grain` names.
 */
export function plankGeometry(
  width: number,
  height: number,
  depth: number,
  grain: 'x' | 'y' | 'z' = 'x',
  tile = 1,
  seed = 0,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  if (position === undefined || normal === undefined || uv === undefined) return geometry;
  // Each board starts somewhere different along the texture.
  const random = seededRandom(seed + 77);
  const offsetU = random();
  const offsetV = random();
  for (let i = 0; i < position.count; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)] as const;
    const faceAxis = Math.abs(normal.getX(i)) > 0.5 ? 0 : Math.abs(normal.getY(i)) > 0.5 ? 1 : 2;
    const grainAxis = grain === 'x' ? 0 : grain === 'y' ? 1 : 2;
    const inPlane = [0, 1, 2].filter((axis) => axis !== faceAxis);
    // Grain along V wherever it lies in this face; otherwise (the end grain)
    // any direction will do.
    const vAxis = inPlane.includes(grainAxis) ? grainAxis : (inPlane[1] ?? 1);
    const uAxis = inPlane.find((axis) => axis !== vAxis) ?? 0;
    uv.setXY(i, (p[uAxis] ?? 0) / tile + offsetU, (p[vAxis] ?? 0) / tile + offsetV);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * A rough stone: a lumpy, flattened ball with a flat underside, textured
 * from above at `tile` metres a copy. Faceted, like everything else in the
 * low-poly forest, once its material says so.
 */
export function stoneGeometry(
  radius: number,
  height: number,
  seed: number,
  tile = 0.8,
  detail = 1,
): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const position = geometry.attributes.position;
  if (position === undefined) return geometry;
  const random = seededRandom(seed);
  // The same corner appears several times in an icosahedron's mesh; keep
  // them together so the stone does not split open where they meet.
  const bumps = new Map<string, number>();
  const stretchX = 1 + (random() - 0.5) * 0.5;
  const stretchZ = 1 + (random() - 0.5) * 0.5;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let bump = bumps.get(key);
    if (bump === undefined) {
      bump = 1 + (random() - 0.5) * 0.35;
      bumps.set(key, bump);
    }
    const flatBottom = y < 0 ? 0.25 : 1;
    position.setXYZ(
      i,
      x * bump * stretchX,
      y * bump * (height / radius) * flatBottom + height * 0.25,
      z * bump * stretchZ,
    );
  }
  const uv = geometry.attributes.uv;
  if (uv !== undefined) {
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, position.getX(i) / tile + seed * 0.37, position.getZ(i) / tile + seed * 0.61);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Lays a texture on any shape straight down from above, `tile` metres a copy. */
export function uvFromAbove(geometry: THREE.BufferGeometry, tile: number, offset = 0): void {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (position === undefined || uv === undefined) return;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getX(i) / tile + offset, position.getZ(i) / tile + offset * 1.7);
  }
  uv.needsUpdate = true;
}

/** Lays a texture round any upright shape, like a label round a tin: U round it, V up it. */
export function uvAround(geometry: THREE.BufferGeometry, tile: number, radius: number): void {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (position === undefined || uv === undefined) return;
  const circumference = Math.PI * 2 * radius;
  for (let i = 0; i < position.count; i++) {
    const angle = Math.atan2(position.getZ(i), position.getX(i));
    uv.setXY(i, ((angle / (Math.PI * 2)) * circumference) / tile, position.getY(i) / tile);
  }
  uv.needsUpdate = true;
}

/** How many triangles a model is made of, for keeping to its budget. */
export function triangleCount(object: THREE.Object3D): number {
  let count = 0;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry as THREE.BufferGeometry;
    const vertices = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
    count += vertices / 3;
  });
  return count;
}
