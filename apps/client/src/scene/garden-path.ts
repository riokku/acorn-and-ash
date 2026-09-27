import type * as THREE from 'three/webgpu';

import { paintedMaterial } from '../art/materials';
import { ModelBuilder, placed, stoneGeometry } from '../art/shapes';

/**
 * A garden path stone (see decision 0053): one flat, lumpy fieldstone set
 * into the grass, the same small piece a player lays over and over to trace
 * out a trail. No two come out quite the same shape, size or turn, so a
 * whole trail never reads as one stone stamped down again and again.
 */
export interface GardenPath {
  readonly group: THREE.Group;
  dispose(): void;
}

const STONE_RADIUS = 0.22;
const STONE_HEIGHT = 0.07;

export function createGardenPath(): GardenPath {
  const material = paintedMaterial('stone', { tint: 0xf0ece4, roughness: 1, flatShading: true });
  const seed = Math.floor(Math.random() * 1_000_000);
  const scale = 0.85 + Math.random() * 0.3;
  const geometry = stoneGeometry(STONE_RADIUS, STONE_HEIGHT, seed, 0.7, 1);
  // Set a little way into the ground, the way a laid stone beds in.
  return new ModelBuilder()
    .add(
      material,
      geometry,
      placed(0, -0.02, 0, { y: Math.random() * Math.PI * 2 }, { x: scale, y: 1, z: scale }),
    )
    .build();
}
