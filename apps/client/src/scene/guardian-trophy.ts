import * as THREE from 'three/webgpu';
import { ModelBuilder, placed } from '../art/shapes';
import { ellipsoid } from './critter';
import { paintedMaterial } from '../art/materials';

/** A small branch crown on a carved timber plinth, earned through the encounter. */
export function createGuardianTrophy() {
  const wood = paintedMaterial('wood', { tint: 0xb59873, roughness: 1 });
  const bark = paintedMaterial('bark', { tint: 0x71573d, roughness: 1 });
  const moss = paintedMaterial('grass', { tint: 0x83a85c, roughness: 1 });
  const builder = new ModelBuilder()
    .add(wood, new THREE.CylinderGeometry(0.3, 0.36, 0.14, 8), placed(0, 0.07, 0))
    .add(wood, new THREE.CylinderGeometry(0.16, 0.23, 0.48, 8), placed(0, 0.37, 0))
    .add(bark, ellipsoid(0.18, 0.22, 0.13, 8, 5), placed(0, 0.75, 0))
    .add(moss, ellipsoid(0.21, 0.06, 0.15, 8, 4), placed(0, 0.9, 0));
  for (const side of [-1, 1]) {
    builder.add(
      bark,
      new THREE.CylinderGeometry(0.025, 0.045, 0.4, 6),
      placed(side * 0.2, 1.04, 0, { z: -side * 0.45 }),
    );
    builder.add(
      bark,
      new THREE.CylinderGeometry(0.012, 0.025, 0.21, 5),
      placed(side * 0.31, 1.16, 0, { z: -side * 0.9 }),
    );
  }
  return builder.build();
}
