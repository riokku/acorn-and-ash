import * as THREE from 'three/webgpu';
import { HOME_FACILITIES, homeHasFacility, type HomeKind, type GardenPlot } from '@acorn/shared';
import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';
import { createForageModel } from './forest-food';

/** Tier facilities use the same room coordinates as authoritative reach checks. */
export function createHomeFacilities(kind: HomeKind) {
  const builder = new ModelBuilder();
  const wood = paintedMaterial('wood', { tint: 0xd2b08a, roughness: 0.9 });
  const metal = plainMaterial(0x484c47, { roughness: 0.55 });
  const stone = paintedMaterial('stone', { tint: 0xaab79b, roughness: 1 });
  if (kind === 'teepee') {
    const { x, z } = HOME_FACILITIES.cooking;
    for (let index = 0; index < 8; index++) {
      const angle = (index * Math.PI) / 4;
      builder.add(
        stone,
        new THREE.DodecahedronGeometry(0.12),
        placed(x + Math.cos(angle) * 0.26, 0.1, z + Math.sin(angle) * 0.26),
      );
    }
    builder.add(metal, new THREE.CylinderGeometry(0.23, 0.17, 0.22, 12), placed(x, 0.27, z));
    builder.add(
      plainMaterial(0xc69b60, { roughness: 0.6 }),
      new THREE.CircleGeometry(0.21, 12),
      placed(x, 0.384, z, { x: -Math.PI / 2 }),
    );
    const handle = new THREE.TorusGeometry(0.2, 0.015, 5, 12, Math.PI);
    builder.add(metal, handle, placed(x, 0.38, z));
    builder.add(
      plainMaterial(0xff9e47, { emissive: 0xe85c24, emissiveIntensity: 0.8 }),
      new THREE.ConeGeometry(0.09, 0.17, 5),
      placed(x, 0.1, z),
    );
  }
  if (homeHasFacility(kind, 'workbench')) {
    const { x, z } = HOME_FACILITIES.workbench;
    builder.add(wood, plankGeometry(0.65, 0.035, 0.72, 'z', 1, 2601), placed(x, 0.69, z));
    for (const dx of [-0.065, 0.065])
      builder.add(metal, new THREE.BoxGeometry(0.055, 0.11, 0.13), placed(x + dx, 0.77, z - 0.07));
    builder.add(
      metal,
      new THREE.CylinderGeometry(0.018, 0.018, 0.24, 6).rotateZ(Math.PI / 2),
      placed(x, 0.78, z - 0.07),
    );
    builder.add(
      wood,
      new THREE.CylinderGeometry(0.022, 0.022, 0.35, 6).rotateZ(Math.PI / 2),
      placed(x, 0.745, z + 0.23),
    );
    builder.add(metal, new THREE.BoxGeometry(0.08, 0.08, 0.05), placed(x + 0.13, 0.75, z + 0.23));
  }
  const model = builder.build();
  const garden = new THREE.Group();
  garden.name = 'home-garden';
  const plants: {
    berry: ReturnType<typeof createForageModel>;
    mushroom: ReturnType<typeof createForageModel>;
    flower: THREE.Group;
  }[] = [];
  const gardenModels: ReturnType<ModelBuilder['build']>[] = [];
  if (homeHasFacility(kind, 'garden')) {
    const { x, z } = HOME_FACILITIES.garden;
    for (let index = 0; index < 3; index++) {
      const bed = new ModelBuilder(),
        dx = x + (index - 1) * 0.65;
      bed.add(
        plainMaterial(0x51422f, { roughness: 1 }),
        new THREE.BoxGeometry(0.49, 0.27, 0.49),
        placed(dx, 0.145, z),
      );
      for (const side of [-1, 1]) {
        bed.add(
          wood,
          plankGeometry(0.56, 0.3, 0.04, 'x', 0.8, 2610 + index),
          placed(dx, 0.17, z + side * 0.27),
        );
        bed.add(
          wood,
          plankGeometry(0.04, 0.3, 0.49, 'z', 0.8, 2620 + index),
          placed(dx + side * 0.27, 0.17, z),
        );
      }
      const built = bed.build();
      gardenModels.push(built);
      garden.add(built.group);
      const berry = createForageModel('berry'),
        mushroom = createForageModel('mushroom');
      const flowerBuilder = new ModelBuilder();
      for (const offset of [-0.12, 0, 0.12]) {
        flowerBuilder.add(
          plainMaterial(0x738c51),
          new THREE.CylinderGeometry(0.009, 0.009, 0.25, 5),
          placed(offset, 0.13, offset * 0.5),
        );
        flowerBuilder.add(
          plainMaterial(0xbbb0d2),
          new THREE.IcosahedronGeometry(0.055, 0),
          placed(offset, 0.27, offset * 0.5),
        );
      }
      const flowers = flowerBuilder.build();
      berry.show(0);
      mushroom.show(0);
      flowers.group.visible = false;
      gardenModels.push(flowers);
      for (const group of [berry.group, mushroom.group, flowers.group]) {
        group.position.set(dx, 0.28, z);
        garden.add(group);
      }
      plants.push({ berry, mushroom, flower: flowers.group });
    }
  }
  model.group.add(garden);
  return {
    group: model.group,
    garden,
    setGardenPlots(plots: readonly GardenPlot[]) {
      plants.forEach((plant, index) => {
        const plot = plots[index];
        plant.berry.show(plot?.crop === 'berry' ? 3 : 0);
        plant.mushroom.show(plot?.crop === 'mushroom' ? 3 : 0);
        plant.flower.visible = plot?.crop === 'flower';
        const scale = plot?.growTicks === 0 ? 1 : 0.45;
        for (const group of [plant.berry.group, plant.mushroom.group, plant.flower])
          group.scale.setScalar(scale);
      });
    },
    dispose() {
      model.dispose();
      gardenModels.forEach((built) => built.dispose());
      plants.forEach((plant) => {
        plant.berry.dispose();
        plant.mushroom.dispose();
      });
    },
  };
}
