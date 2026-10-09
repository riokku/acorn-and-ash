import * as THREE from 'three';
import { SUPPORT_MAX_COUNT, VOXEL, type Support } from '@acorn/shared';

import { loadNamedGeometries } from './model-loading';

import mineSupportUrl from '@assets/buildables/mine-support.glb?url';

/**
 * Mine supports (decision 0119): two wooden posts on sills, a cap beam and two
 * corner braces, modelled in Blender (tools/art/mine_support.py). One support
 * fills a metre of tunnel along it, two across and two tall.
 *
 * Every support is drawn from one shared mesh, so a long mine costs one draw
 * however many supports it has.
 */

/** How far along the tunnel the model reaches, in metres: it is authored for a tunnel running along X. */
const ALONG = 1;

let supportGeometry: THREE.BufferGeometry | undefined;
let preloadPromise: Promise<void> | null = null;

/** Fetch the support model. Resolves at once if already loaded. */
export function preloadMineSupport(): Promise<void> {
  preloadPromise ??= loadNamedGeometries(mineSupportUrl).then((pieces) => {
    supportGeometry = pieces.get('mine_support') ?? [...pieces.values()][0];
  });
  return preloadPromise;
}

/** Where a support goes, and which way it is turned, for a tunnel running along this axis. */
function placement(
  cell: { readonly ix: number; readonly iy: number; readonly iz: number },
  axis: 0 | 1,
): { position: THREE.Vector3; yaw: number } {
  // Along Z instead: a quarter turn swings the model's far end to -Z, so shift it back.
  return {
    position: new THREE.Vector3(
      cell.ix * VOXEL,
      cell.iy * VOXEL,
      cell.iz * VOXEL + (axis === 1 ? ALONG : 0),
    ),
    yaw: axis === 1 ? Math.PI / 2 : 0,
  };
}

export interface MineSupports {
  readonly group: THREE.Group;
  /** Draw these. With `replace` the list is every support there is, otherwise only new ones. */
  apply(supports: readonly Support[], replace: boolean): void;
  dispose(): void;
}

export function createMineSupports(): MineSupports {
  const group = new THREE.Group();
  group.name = 'mine-supports';
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    flatShading: true,
  });
  const mesh =
    supportGeometry === undefined
      ? null
      : new THREE.InstancedMesh(supportGeometry, material, SUPPORT_MAX_COUNT);
  if (mesh !== null) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const seen = new Set<string>();
  const all: Support[] = [];
  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);

  const rebuild = (): void => {
    if (mesh === null) return;
    all.forEach((support, i) => {
      const { position, yaw } = placement(support, support.axis);
      matrix.compose(position, turn.setFromAxisAngle(up, yaw), one);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.count = all.length;
    mesh.instanceMatrix.needsUpdate = true;
  };

  return {
    group,
    apply(supports, replace) {
      if (replace) {
        seen.clear();
        all.length = 0;
      }
      for (const support of supports) {
        const key = `${support.ix},${support.iy},${support.iz}`;
        if (seen.has(key) || all.length >= SUPPORT_MAX_COUNT) continue;
        seen.add(key);
        all.push(support);
      }
      rebuild();
    },
    dispose() {
      material.dispose();
      group.removeFromParent();
    },
  };
}

/** A see-through support showing where the next one would stand: green if it can, red if not. */
export interface SupportPreview {
  readonly group: THREE.Group;
  show(cell: { ix: number; iy: number; iz: number } | null, axis: 0 | 1, allowed: boolean): void;
  dispose(): void;
}

export function createSupportPreview(): SupportPreview {
  const group = new THREE.Group();
  group.visible = false;
  group.renderOrder = 10;
  const material = new THREE.MeshBasicMaterial({
    color: 0x9be39b,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  if (supportGeometry !== undefined) group.add(new THREE.Mesh(supportGeometry, material));
  return {
    group,
    show(cell, axis, allowed) {
      group.visible = cell !== null;
      if (cell === null) return;
      const { position, yaw } = placement(cell, axis);
      group.position.copy(position);
      group.rotation.set(0, yaw, 0);
      material.color.set(allowed ? 0x9be39b : 0xff6a5a);
    },
    dispose() {
      material.dispose();
      group.removeFromParent();
    },
  };
}
