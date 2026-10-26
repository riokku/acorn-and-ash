import * as THREE from 'three/webgpu';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';
import { paintedMaterial, plainMaterial } from '../art/materials';
/** The existing indoor chest, shared by the outdoor pantry. */
export function createStorageChest(
  materials = {
    darkWood: paintedMaterial('wood', { tint: 0x8f6444, roughness: 0.8 }),
    iron: plainMaterial(0x3b3733, { roughness: 0.55 }),
    brass: plainMaterial(0xb68a3e, { roughness: 0.35 }),
  },
) {
  const chest = new THREE.Group();
  chest.name = 'storage-chest';
  const chestBody = new ModelBuilder();
  chestBody
    .add(materials.darkWood, plankGeometry(0.9, 0.45, 0.46, 'x', 1, 482), placed(0, 0.225, 0))
    .add(materials.iron, plankGeometry(0.94, 0.04, 0.02, 'x', 1, 0), placed(0, 0.32, 0.24))
    .add(materials.brass, new THREE.BoxGeometry(0.08, 0.1, 0.03), placed(0, 0.4, 0.245));
  const body = chestBody.build();
  chest.add(body.group);
  const lid = new THREE.Group();
  lid.position.set(0, 0.45, -0.25);
  const lidModel = new ModelBuilder();
  lidModel.add(
    materials.darkWood,
    plankGeometry(0.94, 0.06, 0.5, 'x', 1, 483),
    placed(0, 0.03, 0.25),
  );
  const top = lidModel.build();
  lid.add(top.group);
  chest.add(lid);

  return {
    group: chest,
    lid,
    dispose() {
      body.dispose();
      top.dispose();
    },
  };
}
