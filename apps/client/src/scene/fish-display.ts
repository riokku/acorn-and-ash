import * as THREE from 'three/webgpu';
import { ModelBuilder, placed } from '../art/shapes';
import { paintedMaterial } from '../art/materials';
/** Original carved cedar fish on a river-stone and driftwood stand. */
export function createFishDisplay(golden = false) {
  const wood = paintedMaterial('wood', { tint: 0x947350, roughness: 1 }),
    scales = paintedMaterial('wood', { tint: golden ? 0xd7ad54 : 0x849686, roughness: 0.7 }),
    dark = paintedMaterial('wood', { tint: 0x394938, roughness: 1 }),
    stone = paintedMaterial('stone', { tint: 0x71817a, roughness: 1 });
  const b = new ModelBuilder();
  b.add(stone, new THREE.CylinderGeometry(0.27, 0.35, 0.12, 8), placed(0, 0.06, 0));
  b.add(wood, new THREE.BoxGeometry(0.09, 0.45, 0.1), placed(0, 0.32, 0));
  b.add(wood, new THREE.BoxGeometry(0.65, 0.07, 0.25), placed(0, 0.13, 0));
  b.add(
    scales,
    new THREE.SphereGeometry(1, 10, 6),
    placed(0, 0.63, 0, {}, { x: 0.35, y: 0.14, z: 0.1 }),
  );
  b.add(
    scales,
    new THREE.ConeGeometry(0.16, 0.23, 3),
    placed(0.39, 0.63, 0, { z: Math.PI / 2 }, { x: 1, y: 1, z: 0.45 }),
  );
  b.add(
    scales,
    new THREE.ConeGeometry(0.12, 0.15, 3),
    placed(0.02, 0.79, 0, {}, { x: 1, y: 1, z: 0.25 }),
  );
  for (const side of [-1, 1]) {
    b.add(dark, new THREE.SphereGeometry(0.02, 6, 4), placed(-0.24, 0.66, side * 0.08));
    b.add(
      wood,
      new THREE.BoxGeometry(0.016, 0.16, 0.005),
      placed(-0.13, 0.63, side * 0.098, { z: -0.2 }),
    );
    for (let i = 0; i < 3; i++)
      b.add(
        wood,
        new THREE.BoxGeometry(0.013, 0.12, 0.005),
        placed(0.02 + i * 0.065, 0.63, side * 0.095, { z: -0.3 }),
      );
  }
  if (golden)
    for (const side of [-1, 1]) {
      b.add(
        scales,
        new THREE.TorusGeometry(0.16, 0.022, 4, 10, Math.PI * 0.8),
        placed(side * 0.12, 0.28, 0, { z: side * 0.7 }),
      );
    }
  return b.build();
}
