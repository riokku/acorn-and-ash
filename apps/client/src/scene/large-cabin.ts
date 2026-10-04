import * as THREE from 'three/webgpu';
import { paintedMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';
import { createCabin, type Cabin } from './cabin';

/** A modest expansion of the established cabin, with a sheltered porch and timber rails. */
export function createLargeCabin(): Cabin {
  const cabin = createCabin();
  cabin.group.scale.set(1.2, 1, 1.2);
  const group = new THREE.Group();
  group.name = 'large-cabin';
  group.add(cabin.group);
  const builder = new ModelBuilder();
  const boards = paintedMaterial('wood', { tint: 0xd2b18b, roughness: 0.9 });
  const trim = paintedMaterial('wood', { tint: 0xf2dfc3, roughness: 0.85 });
  const shingles = paintedMaterial('shingles', { roughness: 0.95 });
  for (let i = 0; i < 10; i++)
    builder.add(
      boards,
      plankGeometry(3.5, 0.08, 0.095, 'x', 1, 960 + i),
      placed(0, 0.14, 2.15 + i * 0.1),
    );
  for (const x of [-1.62, 1.62]) {
    for (const z of [2.17, 3.07])
      builder.add(trim, plankGeometry(0.11, 2.1, 0.11, 'y', 1, 980 + z), placed(x, 1.17, z));
    builder.add(trim, plankGeometry(0.1, 0.12, 0.95, 'z', 1, 984), placed(x, 0.95, 2.63));
    for (let i = 0; i < 4; i++)
      builder.add(
        boards,
        plankGeometry(0.065, 0.6, 0.065, 'y', 1, 985 + i),
        placed(x, 0.52, 2.3 + i * 0.21),
      );
  }
  builder.add(trim, plankGeometry(3.42, 0.16, 0.12, 'x', 1, 990), placed(0, 2.16, 3.08));
  builder.add(shingles, new THREE.BoxGeometry(3.7, 0.075, 1.3), placed(0, 2.29, 2.63, { x: 0.12 }));
  builder.add(boards, plankGeometry(1.15, 0.1, 0.32, 'x', 1, 991), placed(-0.69, 0.055, 3.14));
  const porch = builder.build();
  group.add(porch.group);
  return {
    group,
    setDaylight: (brightness) => cabin.setDaylight?.(brightness),
    update: (deltaSeconds) => cabin.update?.(deltaSeconds),
    dispose() {
      cabin.dispose();
      porch.dispose();
    },
  };
}
