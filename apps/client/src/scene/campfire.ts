import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS } from '@acorn/shared';

import { campfireModelParts } from './campfire-models';
import { createFlame } from './flame';
import { createFireGlow } from './fire-light';

/**
 * A campfire: real logs-and-base art once it has loaded (see
 * campfire-models.ts), or a placeholder cylinder-and-logs shape until then.
 * Lighting it adds an animated flame on top, playing for as long as it's lit;
 * putting it out (by hand, or once it burns down) removes the flame again.
 * A lit fire also casts real, flickering light on everything nearby - not
 * just an animated flame that looks lit without lighting anything.
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

/** Warm firelight - the biggest, brightest of the three (see also lantern.ts and character.ts). */
const FIRE_LIGHT_COLOR = 0xff8c42;
const FIRE_LIGHT_INTENSITY = 18;
const FIRE_LIGHT_DISTANCE = 9;
/** Roughly where the flame model's own fire actually is, above the logs. */
const FIRE_LIGHT_HEIGHT = 0.35;

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

  let flame: ReturnType<typeof createFlame> = null;
  let lit = false;
  // Made once and only ever shown or hidden: see fire-light.ts for why a
  // light coming and going is worth avoiding.
  const fireGlow = createFireGlow(FIRE_LIGHT_COLOR, FIRE_LIGHT_INTENSITY, FIRE_LIGHT_DISTANCE);
  fireGlow.anchor.position.set(0, FIRE_LIGHT_HEIGHT, 0);
  fireGlow.anchor.visible = false;
  group.add(fireGlow.anchor);

  function setLit(nextLit: boolean): void {
    if (nextLit === lit) return;
    lit = nextLit;

    fireGlow.anchor.visible = lit;
    if (lit) {
      flame = createFlame();
      if (flame) group.add(flame.root);
    } else {
      flame?.dispose();
      flame = null;
    }
  }

  return {
    group,
    setLit,
    update: (deltaSeconds) => {
      flame?.update(deltaSeconds);
      fireGlow.update(deltaSeconds);
    },
    dispose: () => {
      for (const disposable of disposables) disposable.dispose();
      flame?.dispose();
      fireGlow.dispose();
    },
  };
}
