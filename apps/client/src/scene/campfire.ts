import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS } from '@acorn/shared';

/**
 * A placeholder campfire: a few logs leaned together over a dark base. Art
 * replaces this once the mechanic around it is fun, the same as every other
 * placeholder.
 */
export interface Campfire {
  readonly group: THREE.Group;
  dispose(): void;
}

const LOG_RADIUS = 0.06;
const LOG_LENGTH = 0.62;
const LOG_COUNT = 4;
const BASE_RADIUS = 0.5;
const BASE_HEIGHT = 0.05;

export function createCampfire(): Campfire {
  const group = new THREE.Group();
  const logMaterial = new THREE.MeshStandardMaterial({
    color: BUILDABLE_KINDS.campfire.placeholderColor,
    roughness: 0.9,
  });
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 1 });

  const baseGeometry = new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS, BASE_HEIGHT, 12);
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = BASE_HEIGHT / 2;
  base.receiveShadow = true;
  group.add(base);

  // Logs leaned together over the middle, fanned out like the spokes of a
  // wheel: tip each one over from vertical, then spin it to its own compass
  // point round the shared pivot.
  const logGeometry = new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 6);
  for (let i = 0; i < LOG_COUNT; i++) {
    const log = new THREE.Mesh(logGeometry, logMaterial);
    log.position.y = LOG_LENGTH * 0.32;
    log.rotation.z = Math.PI / 2.4;
    log.rotation.y = (i / LOG_COUNT) * Math.PI * 2;
    log.castShadow = true;
    group.add(log);
  }

  return {
    group,
    dispose: () => {
      baseGeometry.dispose();
      logGeometry.dispose();
      logMaterial.dispose();
      baseMaterial.dispose();
    },
  };
}
