import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { smoothstep, type PlacedProp, type PropKind, type Terrain } from '@acorn/shared';
import { attribute, positionLocal, vec3 } from 'three/tsl';

import { paintedMaterial } from '../art/materials';
import { stumpGeometries } from './pickup-models';
import { realModelPartsFor } from './prop-models';
import {
  groundWeights,
  propBurialDepth,
  propFootprint,
  type PropFootprint,
} from './prop-grounding';

/**
 * Instanced placeholder scenery.
 *
 * Both the clearing and the wilderness are a great many trees and rocks of a
 * handful of kinds, so both draw them the same way: one instanced mesh per
 * part per kind, so a thousand trees cost a handful of draw calls instead of
 * a thousand meshes.
 */

/** A matrix that draws nothing, used to take an instance out of the world. */
export const HIDDEN_INSTANCE = new THREE.Matrix4().makeScale(0, 0, 0);

export interface PropPart {
  readonly mesh: THREE.InstancedMesh;
  /** Where this part sits inside its prop, before the prop is placed. */
  readonly offset: THREE.Matrix4;
  /** Update the buried base when an instance is packed, regrown or tipped. */
  ground?(index: number, prop: PlacedProp, tilt?: THREE.Quaternion): void;
  dispose(): void;
}

export function createPropMeshes(
  kind: PropKind,
  count: number,
  distant = false,
  terrain?: Terrain,
): PropPart[] {
  const parts = propMeshes(kind, count, distant);
  // The detailed footprint grounds both versions identically at the LOD switch.
  const detailed = realModelPartsFor(kind.id);
  const bases =
    detailed?.map((part) => ({ geometry: part.geometry, offsetY: 0 })) ??
    parts.map((part) => ({ geometry: part.mesh.geometry, offsetY: part.offset.elements[13]! }));
  const band =
    kind.shape.family === 'tree' ? kind.shape.trunkHeight * 0.18 : kind.shape.height * 0.35;
  const footprint = propFootprint(bases, band);
  return parts.map((part) => groundPart(part, footprint, terrain));
}

function propMeshes(kind: PropKind, count: number, distant: boolean): PropPart[] {
  if (kind.shape.family === 'tree') {
    const realParts = realModelPartsFor(kind.id, distant);
    if (realParts !== undefined) {
      // Already scaled and grounded to this kind's design height (see
      // prop-models.ts), so it needs no offset beyond the usual placement.
      return realParts.map((part) => instanced(part.geometry, part.material, count, 0, false));
    }

    const { trunkRadius, trunkHeight, canopyRadius, canopyHeight } = kind.shape;

    const trunk = instanced(
      new THREE.CylinderGeometry(trunkRadius * 0.82, trunkRadius, trunkHeight, 7),
      new THREE.MeshStandardNodeMaterial({ color: 0x6b4c33, roughness: 0.95, flatShading: true }),
      count,
      trunkHeight / 2,
    );
    const canopy = instanced(
      new THREE.ConeGeometry(canopyRadius, canopyHeight, 8),
      new THREE.MeshStandardNodeMaterial({
        color: kind.placeholderColor,
        roughness: 0.9,
        flatShading: true,
      }),
      count,
      trunkHeight + canopyHeight / 2,
    );
    return [trunk, canopy];
  }

  if (kind.shape.family === 'stump') {
    // Bark sides flaring into roots, and a sawn top showing its rings (see
    // pickup-models.ts), wearing the shared painted materials.
    const { bark, top } = stumpGeometries(kind.shape.radius, kind.shape.height);
    return [
      instanced(bark, paintedMaterial('bark', { roughness: 1 }), count, 0, 'geometry'),
      instanced(top, paintedMaterial('logEnd', { roughness: 0.95 }), count, 0, 'geometry'),
    ];
  }

  const realParts = realModelPartsFor(kind.id, distant);
  if (realParts !== undefined) {
    return realParts.map((part) => instanced(part.geometry, part.material, count, 0, false));
  }

  const { radius, height } = kind.shape;
  return [
    instanced(
      new THREE.IcosahedronGeometry(radius, 0),
      new THREE.MeshStandardNodeMaterial({
        color: kind.placeholderColor,
        roughness: 1,
        flatShading: true,
      }),
      count,
      height / 2,
    ),
  ];
}

/** Stretch the buried vertices per instance; keep the shared source models untouched. */
function groundPart(part: PropPart, footprint: PropFootprint, terrain?: Terrain): PropPart {
  const weights = groundWeights(part.mesh.geometry, part.offset.elements[13]!, footprint);
  if (!weights.some((weight) => weight > 0)) return part;
  const source = part.mesh.material;
  if (
    !(source instanceof THREE.MeshStandardNodeMaterial) &&
    !(source instanceof THREE.MeshStandardMaterial)
  )
    return part;
  const geometry = part.mesh.geometry.clone();
  geometry.setAttribute('propGroundWeight', new THREE.BufferAttribute(weights, 1));
  const depth = new THREE.InstancedBufferAttribute(new Float32Array(part.mesh.count), 1);
  depth.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('propGroundDepth', depth);
  const material =
    source instanceof THREE.MeshStandardNodeMaterial
      ? source.clone()
      : new THREE.MeshStandardNodeMaterial({
          name: source.name,
          color: source.color,
          map: source.map,
          normalMap: source.normalMap,
          normalScale: source.normalScale,
          roughness: source.roughness,
          roughnessMap: source.roughnessMap,
          metalness: source.metalness,
          metalnessMap: source.metalnessMap,
          flatShading: source.flatShading,
          side: source.side,
          transparent: source.transparent,
          opacity: source.opacity,
          alphaTest: source.alphaTest,
        });
  material.positionNode = positionLocal.sub(
    vec3(0, attribute('propGroundDepth', 'float').mul(attribute('propGroundWeight', 'float')), 0),
  );
  part.mesh.geometry = geometry;
  part.mesh.material = material;
  const cached = new Map<
    number,
    { scale: number; x: number; y: number; z: number; depth: number }
  >();
  return {
    ...part,
    ground(index, prop, tilt) {
      let known = cached.get(prop.id);
      if (
        known === undefined ||
        known.scale !== prop.scale ||
        known.x !== prop.x ||
        known.z !== prop.z ||
        known.y !== (prop.y ?? 0)
      ) {
        known = {
          scale: prop.scale,
          x: prop.x,
          y: prop.y ?? 0,
          z: prop.z,
          depth: propBurialDepth(prop, footprint, terrain),
        };
        cached.set(prop.id, known);
      }
      // Leave uprooted trees free of the ground as they fall; small shakes
      // keep their roots embedded. Stumps have their own buried bases.
      const angle = tilt === undefined ? 0 : 2 * Math.acos(Math.min(1, Math.abs(tilt.w)));
      const burial = known.depth * (1 - smoothstep(angle, 0.08, 0.3));
      if (depth.getX(index) !== burial) {
        depth.setX(index, burial);
        depth.needsUpdate = true;
      }
      // Culling must include the vertices moved by the shader.
      geometry.boundingBox!.min.y = Math.min(
        geometry.boundingBox!.min.y,
        footprint.bottom - known.depth / prop.scale - part.offset.elements[13]!,
      );
      geometry.boundingSphere ??= new THREE.Sphere();
      geometry.boundingBox!.getBoundingSphere(geometry.boundingSphere);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      part.dispose();
    },
  };
}

function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  centreHeight: number,
  // False for real models: the clearing and the wilderness each build their
  // own instanced mesh for the same kind, sharing one geometry and material
  // loaded once (see prop-models.ts), so neither owns it to dispose.
  // 'geometry' for a shape built here that wears a shared painted material
  // (see materials.ts): the geometry is this mesh's own, the material not.
  ownsResources: boolean | 'geometry' = true,
): PropPart {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Trees never move, so let the renderer stop re-reading their matrices.
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  return {
    mesh,
    offset: new THREE.Matrix4().makeTranslation(0, centreHeight, 0),
    dispose: () => {
      if (ownsResources !== false) geometry.dispose();
      if (ownsResources === true) material.dispose();
      mesh.dispose();
    },
  };
}

/** Put one prop into every part of its instanced mesh. */
export function placeInstance(parts: PropPart[], index: number, prop: PlacedProp): void {
  for (const part of parts) placeOneInstance(part, index, prop);
}

/** Put one prop into one part, tipped over by `tilt` about its own foot if given - a tree shaking from a blow. */
export function placeOneInstance(
  part: PropPart,
  index: number,
  prop: PlacedProp,
  tilt?: THREE.Quaternion,
): void {
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotationY);
  if (tilt !== undefined) turn.premultiply(tilt);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(prop.x, prop.y ?? 0, prop.z),
    turn,
    new THREE.Vector3(prop.scale, prop.scale, prop.scale),
  );
  part.mesh.setMatrixAt(index, part.offset.clone().premultiply(matrix));
  part.ground?.(index, prop, tilt);
}

/** A cylinder standing where the prop does, matching what the server collides with. */
export function blockerGeometry(kind: PropKind, prop: PlacedProp): THREE.BufferGeometry {
  const radius = kind.colliderRadius * prop.scale;
  const height =
    (kind.shape.family === 'tree'
      ? kind.shape.trunkHeight + kind.shape.canopyHeight
      : kind.shape.height) * prop.scale;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 6, 1);
  geometry.translate(prop.x, (prop.y ?? 0) + height / 2, prop.z);
  return geometry;
}

/**
 * Merge blocker geometries into one mesh with a bounding volume hierarchy, so
 * the camera can ask "is there something between me and the player?" cheaply.
 */
export function createCameraBlockers(geometries: THREE.BufferGeometry[]): THREE.Mesh {
  const merged = geometries.length > 0 ? mergeGeometries(geometries, false) : null;
  for (const geometry of geometries) geometry.dispose();

  const geometry = merged ?? new THREE.BufferGeometry();
  if (merged !== null) geometry.computeBoundsTree();

  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.matrixAutoUpdate = false;
  return mesh;
}
