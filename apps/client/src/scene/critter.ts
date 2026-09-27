import * as THREE from 'three/webgpu';

import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, placed } from '../art/shapes';

/**
 * A rabbit (see decision 0053): a round, soft-furred body sitting on big
 * hind feet, a head with long ears laid back, dark bright eyes, a pink nose
 * and a white powder-puff tail. Low to the ground, so it reads as something
 * that scurries rather than walks.
 *
 * Faces -Z, the way every character and creature in the game faces before
 * it is turned (yaw 0 walks towards -Z).
 */
export interface Critter {
  readonly group: THREE.Group;
  dispose(): void;
}

/** A soft ball stretched to these three radii, faceted like the rest of the forest. */
export function ellipsoid(
  rx: number,
  ry: number,
  rz: number,
  across = 9,
  down = 6,
): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, across, down);
  geometry.scale(rx, ry, rz);
  return geometry;
}

export function createCritter(): Critter {
  const fur = paintedMaterial('fur', { tint: 0xb89470, roughness: 1, flatShading: true });
  const cream = paintedMaterial('fur', { tint: 0xf3eadb, roughness: 1, flatShading: true });
  const innerEar = plainMaterial(0xe8b4a8, { roughness: 0.9, flatShading: true });
  const nose = plainMaterial(0xd98a8a, { roughness: 0.6 });
  const eye = plainMaterial(0x1c1714, { roughness: 0.2 });
  const glint = plainMaterial(0xffffff, {
    roughness: 0.2,
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
  });

  const builder = new ModelBuilder()
    // Body, heavier at the back, and the two big haunches either side.
    .add(fur, ellipsoid(0.15, 0.13, 0.19), placed(0, 0.15, 0.03, { x: -0.25 }))
    .add(fur, ellipsoid(0.08, 0.09, 0.11), placed(-0.09, 0.11, 0.07))
    .add(fur, ellipsoid(0.08, 0.09, 0.11), placed(0.09, 0.11, 0.07))
    // A pale chest.
    .add(cream, ellipsoid(0.09, 0.09, 0.07), placed(0, 0.14, -0.1))
    // Head, cheeks and nose.
    .add(fur, ellipsoid(0.085, 0.08, 0.095), placed(0, 0.26, -0.14))
    .add(cream, ellipsoid(0.05, 0.035, 0.04), placed(0, 0.225, -0.215))
    .add(nose, ellipsoid(0.014, 0.011, 0.01, 6, 4), placed(0, 0.245, -0.235))
    // Long ears, laid back.
    .add(fur, ellipsoid(0.03, 0.13, 0.017), placed(-0.035, 0.37, -0.1, { x: 0.45, z: 0.18 }))
    .add(fur, ellipsoid(0.03, 0.13, 0.017), placed(0.035, 0.37, -0.1, { x: 0.45, z: -0.18 }))
    .add(innerEar, ellipsoid(0.018, 0.1, 0.01), placed(-0.036, 0.37, -0.113, { x: 0.45, z: 0.18 }))
    .add(innerEar, ellipsoid(0.018, 0.1, 0.01), placed(0.036, 0.37, -0.113, { x: 0.45, z: -0.18 }))
    // Front paws, and long hind feet.
    .add(cream, ellipsoid(0.028, 0.03, 0.04), placed(-0.05, 0.025, -0.13))
    .add(cream, ellipsoid(0.028, 0.03, 0.04), placed(0.05, 0.025, -0.13))
    .add(fur, ellipsoid(0.035, 0.025, 0.09), placed(-0.09, 0.022, 0.04))
    .add(fur, ellipsoid(0.035, 0.025, 0.09), placed(0.09, 0.022, 0.04))
    // A white powder-puff tail.
    .add(cream, ellipsoid(0.05, 0.048, 0.045), placed(0, 0.17, 0.21));

  for (const side of [-1, 1]) {
    builder
      .add(eye, ellipsoid(0.019, 0.022, 0.017, 8, 6), placed(side * 0.06, 0.28, -0.19))
      .add(glint, ellipsoid(0.006, 0.006, 0.004, 5, 4), placed(side * 0.064, 0.29, -0.205));
  }
  return builder.build();
}
