import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import {
  ITEM_KINDS,
  PLAYABLE_HALF_EXTENT,
  PROP_KINDS,
  type Clearing,
  type PlacedPickup,
  type PlacedProp,
  type PropKind,
} from '@acorn/shared';

/** The scenery, plus an invisible mesh the camera uses to avoid clipping. */
export interface ClearingScene {
  readonly group: THREE.Group;
  /** A single merged mesh of every trunk and rock, for camera raycasts. */
  readonly cameraBlockers: THREE.Mesh;
  /** Hide whatever the server says has already been picked up. */
  setTakenPickups(taken: ReadonlySet<number>): void;
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

  const pickups = new Map<number, THREE.Object3D>();
  for (const pickup of clearing.pickups) {
    const model = createPickup(pickup, disposables);
    pickups.set(pickup.id, model);
    group.add(model);
  }

  return {
    group,
    cameraBlockers,
    setTakenPickups: (taken) => {
      for (const [id, model] of pickups) model.visible = !taken.has(id);
    },
    dispose: () => {
      for (const item of disposables) item.dispose();
      cameraBlockers.geometry.dispose();
    },
  };
}

/**
 * An axe standing in a stump, as two placeholder blocks.
 *
 * It is tilted and pale against the dark stump so you can pick it out from
 * across the clearing, which is the whole point of it being there.
 */
function createPickup(
  pickup: PlacedPickup,
  disposables: Array<{ dispose(): void }>,
): THREE.Object3D {
  const group = new THREE.Group();
  const kind = ITEM_KINDS[pickup.item];

  const handleGeometry = new THREE.CylinderGeometry(0.035, 0.03, 0.7, 6);
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: kind.placeholderColor,
    roughness: 0.9,
    flatShading: true,
  });
  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  handle.position.y = 0.3;
  handle.castShadow = true;

  const headGeometry = new THREE.BoxGeometry(0.1, 0.22, 0.3);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8ccd2,
    roughness: 0.45,
    metalness: 0.35,
    flatShading: true,
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.set(0, 0.6, 0.08);
  head.castShadow = true;

  group.add(handle, head);
  group.position.set(pickup.x, pickup.y, pickup.z);
  // Sunk into the stump at an angle, the way somebody would have left it.
  group.rotation.set(0.38, 0.9, 0.1);

  disposables.push({
    dispose: () => {
      handleGeometry.dispose();
      handleMaterial.dispose();
      headGeometry.dispose();
      headMaterial.dispose();
    },
  });
  return group;
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
