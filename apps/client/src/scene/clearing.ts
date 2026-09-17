import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import {
  PLAYABLE_HALF_EXTENT,
  PROP_KINDS,
  type Clearing,
  type PlacedProp,
  type PropKind,
} from '@acorn/shared';

/** The scenery, plus an invisible mesh the camera uses to avoid clipping. */
export interface ClearingScene {
  readonly group: THREE.Group;
  /** A single merged mesh of every trunk and rock, for camera raycasts. */
  readonly cameraBlockers: THREE.Mesh;
  dispose(): void;
}

/**
 * The ground runs well past the tree line so its edge is never visible: it
 * disappears into the fog long before it stops.
 */
const GROUND_SIZE = PLAYABLE_HALF_EXTENT * 2 + 340;

/**
 * Build the clearing out of placeholder shapes.
 *
 * Every tree of the same kind is drawn with one instanced mesh, so a hundred and
 * fifty trees cost a handful of draw calls instead of three hundred.
 */
export function buildClearingScene(clearing: Clearing): ClearingScene {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  const ground = createGround();
  group.add(ground.mesh);
  disposables.push(ground);

  const byKind = new Map<string, PlacedProp[]>();
  for (const prop of clearing.props) {
    const existing = byKind.get(prop.kind);
    if (existing === undefined) byKind.set(prop.kind, [prop]);
    else existing.push(prop);
  }

  const blockerGeometries: THREE.BufferGeometry[] = [];

  for (const [kindId, props] of byKind) {
    const kind = PROP_KINDS[kindId as keyof typeof PROP_KINDS];
    const parts = createPropMeshes(kind, props.length);
    for (const part of parts) {
      group.add(part.mesh);
      disposables.push(part);
    }

    const matrix = new THREE.Matrix4();
    props.forEach((prop, index) => {
      matrix.compose(
        new THREE.Vector3(prop.x, 0, prop.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotationY),
        new THREE.Vector3(prop.scale, prop.scale, prop.scale),
      );
      for (const part of parts) {
        const local = part.offset.clone().premultiply(matrix);
        part.mesh.setMatrixAt(index, local);
      }
      blockerGeometries.push(blockerGeometry(kind, prop));
    });

    for (const part of parts) part.mesh.instanceMatrix.needsUpdate = true;
  }

  const cameraBlockers = createCameraBlockers(blockerGeometries);
  // Never drawn: it exists so the camera can feel the trees.
  cameraBlockers.visible = false;
  group.add(cameraBlockers);

  return {
    group,
    cameraBlockers,
    dispose: () => {
      for (const item of disposables) item.dispose();
      cameraBlockers.geometry.dispose();
    },
  };
}

interface PropPart {
  readonly mesh: THREE.InstancedMesh;
  /** Where this part sits inside its prop, before the prop is placed. */
  readonly offset: THREE.Matrix4;
  dispose(): void;
}

function createPropMeshes(kind: PropKind, count: number): PropPart[] {
  if (kind.shape.family === 'tree') {
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
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

function createGround(): { mesh: THREE.Mesh; dispose(): void } {
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x5f7c46, roughness: 1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

/** A cylinder standing where the prop does, matching what the server collides with. */
function blockerGeometry(kind: PropKind, prop: PlacedProp): THREE.BufferGeometry {
  const radius = kind.colliderRadius * prop.scale;
  const height =
    (kind.shape.family === 'tree'
      ? kind.shape.trunkHeight + kind.shape.canopyHeight
      : kind.shape.height) * prop.scale;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 6, 1);
  geometry.translate(prop.x, height / 2, prop.z);
  return geometry;
}

/**
 * Merge every blocker into one mesh and build a bounding volume hierarchy over
 * it, so the camera can ask "is there a tree between me and the player?" cheaply.
 */
function createCameraBlockers(geometries: THREE.BufferGeometry[]): THREE.Mesh {
  const merged = geometries.length > 0 ? mergeGeometries(geometries, false) : null;
  for (const geometry of geometries) geometry.dispose();

  const geometry = merged ?? new THREE.BufferGeometry();
  if (merged !== null) geometry.computeBoundsTree();

  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.matrixAutoUpdate = false;
  return mesh;
}
