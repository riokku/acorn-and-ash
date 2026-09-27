import type * as THREE from 'three/webgpu';

import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, placed } from '../art/shapes';
import { ellipsoid } from './critter';

/**
 * The masked raccoon (see decision 0053): a stout, grizzled grey body on
 * short dark legs, a pale face with the black bandit mask it is named for,
 * rounded ears, a pointed snout with a black nose, and a big bushy tail in
 * dark and light rings. Chunkier than the rabbit, and a little mischievous.
 *
 * Faces -Z, the way every character and creature in the game faces before
 * it is turned (yaw 0 walks towards -Z).
 */
export interface Raccoon {
  readonly group: THREE.Group;
  dispose(): void;
}

export function createRaccoon(): Raccoon {
  const grey = paintedMaterial('fur', { tint: 0x8d857c, roughness: 1, flatShading: true });
  const pale = paintedMaterial('fur', { tint: 0xe9e2d6, roughness: 1, flatShading: true });
  const dark = paintedMaterial('fur', { tint: 0x3a332e, roughness: 1, flatShading: true });
  const nose = plainMaterial(0x161311, { roughness: 0.35 });
  const eye = plainMaterial(0x0f0c0a, { roughness: 0.15 });
  const glint = plainMaterial(0xffffff, {
    roughness: 0.2,
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
  });

  const builder = new ModelBuilder()
    // A stout, round-backed body, and a paler belly beneath it.
    .add(grey, ellipsoid(0.17, 0.16, 0.25), placed(0, 0.25, 0.03, { x: 0.12 }))
    .add(pale, ellipsoid(0.12, 0.08, 0.19), placed(0, 0.17, 0))
    // A big head for its size: grey crown, pale face, pointed snout, black nose.
    .add(grey, ellipsoid(0.14, 0.12, 0.12), placed(0, 0.35, -0.25))
    .add(pale, ellipsoid(0.125, 0.085, 0.09), placed(0, 0.32, -0.3))
    .add(pale, ellipsoid(0.05, 0.045, 0.075), placed(0, 0.3, -0.39))
    .add(nose, ellipsoid(0.022, 0.018, 0.018, 6, 4), placed(0, 0.315, -0.46))
    // The bandit mask: one dark band right across the eyes, wrapping round
    // to the sides of the head, with a pale stripe above it.
    .add(dark, ellipsoid(0.135, 0.04, 0.07), placed(0, 0.345, -0.33))
    .add(pale, ellipsoid(0.1, 0.022, 0.05), placed(0, 0.39, -0.33));

  for (const side of [-1, 1]) {
    builder
      // Rounded ears, dark behind with pale rims.
      .add(
        dark,
        ellipsoid(0.045, 0.05, 0.02),
        placed(side * 0.09, 0.45, -0.22, { z: side * -0.35 }),
      )
      .add(
        pale,
        ellipsoid(0.033, 0.038, 0.012),
        placed(side * 0.09, 0.455, -0.232, { z: side * -0.35 }),
      )
      .add(eye, ellipsoid(0.019, 0.021, 0.014, 8, 6), placed(side * 0.055, 0.35, -0.39))
      .add(glint, ellipsoid(0.006, 0.006, 0.004, 5, 4), placed(side * 0.059, 0.358, -0.403))
      // Legs: dark and slim, the front pair a little forward.
      .add(dark, ellipsoid(0.035, 0.1, 0.04), placed(side * 0.1, 0.09, -0.14))
      .add(dark, ellipsoid(0.04, 0.1, 0.045), placed(side * 0.1, 0.09, 0.17))
      .add(dark, ellipsoid(0.04, 0.02, 0.055), placed(side * 0.1, 0.012, -0.16))
      .add(dark, ellipsoid(0.042, 0.02, 0.06), placed(side * 0.1, 0.012, 0.16));
  }

  // A bushy tail curling up behind, in dark and grey rings.
  const rings = 6;
  for (let ring = 0; ring < rings; ring++) {
    const along = ring / (rings - 1);
    const z = 0.26 + along * 0.3;
    const y = 0.24 + along * along * 0.16;
    const radius = 0.075 - along * 0.018;
    builder.add(
      ring % 2 === 0 ? grey : dark,
      ellipsoid(radius, radius, 0.06, 8, 6),
      placed(0, y, z, { x: -0.5 * along }),
    );
  }
  return builder.build();
}
