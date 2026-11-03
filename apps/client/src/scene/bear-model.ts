import type * as THREE from 'three/webgpu';

import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, placed } from '../art/shapes';
import { ellipsoid } from './critter';
import { polyforkAnimal } from './polyfork-animal';

/**
 * Polyfork's free Black Bear (decision 0272) is 2.1 m nose to tail and 1.4 m
 * to the ears: shrunk a little, to a big black bear about 1.9 m long.
 */
const BEAR_SCALE = 0.9;
const blackBear = polyforkAnimal('black-bear', {
  walkSpeed: 1 * BEAR_SCALE,
  runSpeed: 4 * BEAR_SCALE,
  scale: BEAR_SCALE,
});

/** Fetches the bear up front. Idempotent, like the other model preloads. */
export function preloadBearModel(): Promise<void> {
  return blackBear.preload();
}

/**
 * A living copy of Polyfork's bear, or, if it didn't download, a placeholder
 * of soft shapes the same size: a heavy dark body on thick legs, a
 * shoulder hump, a pale muzzle and round ears. Faces -Z, like every creature.
 */
export function createBearModel(): {
  group: THREE.Group;
  animate?(deltaSeconds: number, speed: number): void;
  dispose(): void;
} {
  const real = blackBear.create();
  if (real !== undefined) return real;

  const fur = paintedMaterial('fur', { tint: 0x2a2420, roughness: 1, flatShading: true });
  const muzzle = paintedMaterial('fur', { tint: 0x8a6a4c, roughness: 1, flatShading: true });
  const nose = plainMaterial(0x111010, { roughness: 0.35 });
  const builder = new ModelBuilder()
    .add(fur, ellipsoid(0.42, 0.4, 0.78), placed(0, 0.78, 0.05))
    .add(fur, ellipsoid(0.36, 0.3, 0.32), placed(0, 1.02, -0.32))
    .add(fur, ellipsoid(0.24, 0.22, 0.25), placed(0, 0.92, -0.78))
    .add(muzzle, ellipsoid(0.11, 0.1, 0.14), placed(0, 0.86, -1.0))
    .add(nose, ellipsoid(0.045, 0.035, 0.03, 6, 4), placed(0, 0.89, -1.13));
  for (const side of [-1, 1]) {
    builder
      .add(fur, ellipsoid(0.07, 0.07, 0.04), placed(side * 0.16, 1.12, -0.74))
      .add(fur, ellipsoid(0.12, 0.34, 0.13), placed(side * 0.24, 0.34, -0.42))
      .add(fur, ellipsoid(0.13, 0.36, 0.15), placed(side * 0.24, 0.36, 0.5));
  }
  return builder.build();
}
