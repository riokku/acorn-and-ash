import * as THREE from 'three/webgpu';
import { WOODSHED } from '@acorn/shared';

import { plainMaterial } from '../art/materials';
import type { Cabin } from './cabin';
import { createLogsModel } from './ground-items';
import { polyforkGroup, polyforkPiece } from './polyfork-piece';

/**
 * The woodshed (decision 0281): Polyfork's free Open Woodshed, with the
 * logs its owner has stored stacked under the roof, ten to a row, filling
 * up as they are brought home. The file is 4 m wide; it is shrunk to the
 * woodshed's footprint and turned so its open side faces +Z, the same way
 * the placement preview points.
 */
const SCALE = (WOODSHED.halfX * 2) / 4;
const shed = polyforkPiece('open-woodshed', new THREE.Matrix4().makeScale(SCALE, SCALE, SCALE));

/** Where the stack sits inside: on the shed's floor, against the back wall. */
const STACK = { y: 0.22, z: -0.1 };

export function createWoodshed(): Cabin {
  const group = new THREE.Group();
  group.name = 'woodshed';
  const parts = shed.parts();
  const model =
    parts === undefined ? placeholderShed() : polyforkGroup('woodshed-frame', parts.values());
  const logs = createLogsModel(WOODSHED.capacity, true);
  // The stack's rows run along the shed's width, each log pointing out of its open front.
  logs.group.rotation.y = Math.PI / 2;
  logs.group.position.set(0, STACK.y, STACK.z);
  logs.show(0);
  const storage = new THREE.Group();
  storage.name = 'woodshed-log-storage';
  storage.userData.logStorage = true;
  storage.add(model.group, logs.group);
  group.add(storage);
  return {
    group,
    setStoredLogs: (count) => logs.show(count),
    dispose() {
      model.dispose();
      logs.dispose();
    },
  };
}

/** Until the download arrives: a back wall, two sides and a roof in plain wood. */
function placeholderShed(): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const wood = plainMaterial(0x8a6642);
  const { halfX, halfZ, height } = WOODSHED;
  const boards: Array<[number, number, number, number, number, number]> = [
    [halfX * 2, height * 0.85, 0.08, 0, height * 0.425, -halfZ + 0.04],
    [0.08, height * 0.85, halfZ * 2, -halfX + 0.04, height * 0.425, 0],
    [0.08, height * 0.85, halfZ * 2, halfX - 0.04, height * 0.425, 0],
    [halfX * 2 + 0.2, 0.08, halfZ * 2 + 0.3, 0, height - 0.04, 0.1],
  ];
  const geometries: THREE.BufferGeometry[] = [];
  for (const [w, h, d, x, y, z] of boards) {
    const geometry = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, wood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group, dispose: () => geometries.forEach((geometry) => geometry.dispose()) };
}
