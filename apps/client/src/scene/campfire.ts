import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS } from '@acorn/shared';

import { campfireModelParts, flameModelTemplate } from './campfire-models';
import { instantiateAnimatedModel } from './model-loading';

/**
 * A campfire: real logs-and-base art once it has loaded (see
 * campfire-models.ts), or a placeholder cylinder-and-logs shape until then.
 * Lighting it adds an animated flame on top, playing for as long as it's lit;
 * putting it out (by hand, or once it burns down) removes the flame again.
 */
export interface Campfire {
  readonly group: THREE.Group;
  setLit(lit: boolean): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const LOG_RADIUS = 0.06;
const LOG_LENGTH = 0.62;
const LOG_COUNT = 4;
const BASE_RADIUS = 0.5;
const BASE_HEIGHT = 0.05;

export function createCampfire(): Campfire {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  const realParts = campfireModelParts();
  if (realParts !== undefined) {
    // Shared geometry and material loaded once for every campfire in the
    // world, so this group never owns them to dispose.
    for (const part of realParts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  } else {
    const logMaterial = new THREE.MeshStandardMaterial({
      color: BUILDABLE_KINDS.campfire.placeholderColor,
      roughness: 0.9,
    });
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 1 });
    disposables.push(logMaterial, baseMaterial);

    const baseGeometry = new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS, BASE_HEIGHT, 12);
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = BASE_HEIGHT / 2;
    base.receiveShadow = true;
    group.add(base);
    disposables.push(baseGeometry);

    // Logs leaned together over the middle, fanned out like the spokes of a
    // wheel: tip each one over from vertical, then spin it to its own compass
    // point round the shared pivot.
    const logGeometry = new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 6);
    disposables.push(logGeometry);
    for (let i = 0; i < LOG_COUNT; i++) {
      const log = new THREE.Mesh(logGeometry, logMaterial);
      log.position.y = LOG_LENGTH * 0.32;
      log.rotation.z = Math.PI / 2.4;
      log.rotation.y = (i / LOG_COUNT) * Math.PI * 2;
      log.castShadow = true;
      group.add(log);
    }
  }

  let mixer: THREE.AnimationMixer | undefined;
  let flameGroup: THREE.Group | undefined;
  let lit = false;

  function setLit(nextLit: boolean): void {
    if (nextLit === lit) return;
    lit = nextLit;

    if (lit) {
      const template = flameModelTemplate();
      if (template === undefined) return; // No flame model loaded; stays a lit-less fire.
      const instance = instantiateAnimatedModel(template);
      flameGroup = instance.root;
      mixer = instance.mixer;
      for (const action of instance.actions) action.play();
      group.add(flameGroup);
    } else if (flameGroup !== undefined) {
      group.remove(flameGroup);
      mixer?.stopAllAction();
      flameGroup = undefined;
      mixer = undefined;
    }
  }

  return {
    group,
    setLit,
    update: (deltaSeconds) => mixer?.update(deltaSeconds),
    dispose: () => {
      for (const disposable of disposables) disposable.dispose();
      mixer?.stopAllAction();
    },
  };
}
