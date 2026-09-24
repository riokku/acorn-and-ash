import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { type PlacedProp, type PropKind } from '@acorn/shared';

import { realModelPartsFor } from './tree-models';

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
  dispose(): void;
}

export function createPropMeshes(kind: PropKind, count: number): PropPart[] {
  if (kind.shape.family === 'tree') {
    const realParts = realModelPartsFor(kind.id);
    if (realParts !== undefined) {
      // Already scaled and grounded to this kind's design height (see
      // tree-models.ts), so it needs no offset beyond the usual placement.
      return realParts.map((part) => instanced(part.geometry, part.material, count, 0, false));
    }

    const { trunkRadius, trunkHeight, canopyRadius, canopyHeight } = kind.shape;

    const trunk = instanced(
      new THREE.CylinderGeometry(trunkRadius * 0.82, trunkRadius, trunkHeight, 7),
      new THREE.MeshStandardMaterial({ color: 0x6b4c33, roughness: 0.95, flatShading: true }),
      count,
      trunkHeight / 2,
    );
    const canopy = instanced(
      new THREE.ConeGeometry(canopyRadius, canopyHeight, 8),
      new THREE.MeshStandardMaterial({
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
    const { radius, height } = kind.shape;
    return [
      instanced(
        // Wider at the base than the cut, like a tree that was felled here.
        new THREE.CylinderGeometry(radius * 0.92, radius * 1.15, height, 9),
        new THREE.MeshStandardMaterial({
          color: kind.placeholderColor,
          roughness: 1,
          flatShading: true,
        }),
        count,
        height / 2,
      ),
    ];
  }

  const { radius, height } = kind.shape;
  return [
    instanced(
      new THREE.IcosahedronGeometry(radius, 0),
      new THREE.MeshStandardMaterial({
        color: kind.placeholderColor,
        roughness: 1,
        flatShading: true,
      }),
      count,
      height / 2,
    ),
  ];
}

function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  centreHeight: number,
  // False for real models: the clearing and the wilderness each build their
  // own instanced mesh for the same kind, sharing one geometry and material
  // loaded once (see tree-models.ts), so neither owns it to dispose.
  ownsResources = true,
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
      if (ownsResources) {
        geometry.dispose();
        material.dispose();
      }
      mesh.dispose();
    },
  };
}

/** Put one prop into every part of its instanced mesh. */
export function placeInstance(parts: PropPart[], index: number, prop: PlacedProp): void {
  for (const part of parts) placeOneInstance(part, index, prop);
}

export function placeOneInstance(part: PropPart, index: number, prop: PlacedProp): void {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(prop.x, prop.y ?? 0, prop.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotationY),
    new THREE.Vector3(prop.scale, prop.scale, prop.scale),
  );
  part.mesh.setMatrixAt(index, part.offset.clone().premultiply(matrix));
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
