import * as THREE from 'three/webgpu';

import { paintedMaterial } from '../art/materials';
import { ModelBuilder, logGeometry, placed, stoneGeometry, uvFromAbove } from '../art/shapes';

/**
 * Where a knockout buried half of somebody's pack (see decision 0053): a
 * low heap of freshly turned soil, a few pebbles dug up with it, and two
 * sticks laid across each other on top - X marks the spot - so it reads as
 * "something is buried here" from a way off.
 */
export interface BuriedCacheMound {
  readonly group: THREE.Group;
  dispose(): void;
}

const RADIUS = 0.42;
const HEIGHT = 0.16;

export function createBuriedCacheMound(): BuriedCacheMound {
  const soil = paintedMaterial('soil', { roughness: 1 });
  const stone = paintedMaterial('stone', { roughness: 1, flatShading: true });
  const bark = paintedMaterial('bark', { roughness: 1 });
  const ends = paintedMaterial('logEnd', { roughness: 1 });

  const heap = new THREE.SphereGeometry(RADIUS, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  heap.scale(1, HEIGHT / RADIUS, 0.9);
  uvFromAbove(heap, 0.45);

  const builder = new ModelBuilder().add(soil, heap, placed(0, -0.01, 0));
  const pebbles = [
    { x: 0.36, z: 0.12, r: 0.06 },
    { x: -0.3, z: 0.24, r: 0.05 },
    { x: 0.05, z: -0.38, r: 0.07 },
  ];
  pebbles.forEach((pebble, index) => {
    builder.add(
      stone,
      stoneGeometry(pebble.r, pebble.r * 0.6, 500 + index, 0.3, 0),
      placed(pebble.x, 0, pebble.z),
    );
  });

  // Two sticks laid across each other on top: X marks the spot.
  const sticks = [0.7, -0.75].map((turn, index) => ({
    stick: logGeometry(0.5, 0.017, { sides: 5, seed: 510 + index, tile: 0.4, ringEvery: 0.5 }),
    matrix: placed(0, HEIGHT + 0.012 + index * 0.02, 0, { y: turn, z: index === 0 ? 0.04 : -0.03 }),
  }));
  for (const { stick, matrix } of sticks) {
    builder.add(bark, stick.side, matrix).add(ends, stick.ends, matrix);
  }

  return builder.build();
}
