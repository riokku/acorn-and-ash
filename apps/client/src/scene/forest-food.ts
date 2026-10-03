import * as THREE from 'three/webgpu';
import { GATHER_PATCH_MAX_COUNT, type ItemId } from '@acorn/shared';
import { ModelBuilder, placed } from '../art/shapes';
import { paintedMaterial, plainMaterial } from '../art/materials';

export function createForageModel(item: 'berry' | 'mushroom') {
  const group = new THREE.Group();
  const models: ReturnType<ModelBuilder['build']>[] = [];
  const stem = paintedMaterial('burlap', { tint: 0xffefd3, roughness: 1 });
  const cap = paintedMaterial('burlap', { tint: 0xefc28a, roughness: 1 });
  const berry = plainMaterial(0x9d5063, { roughness: 0.8 });
  const leaf = plainMaterial(0x698646, { roughness: 1 });
  for (let index = 0; index < GATHER_PATCH_MAX_COUNT; index++) {
    const builder = new ModelBuilder();
    if (item === 'mushroom') {
      builder.add(stem, new THREE.CylinderGeometry(0.026, 0.035, 0.12, 6), placed(0, 0.065, 0));
      builder.add(
        cap,
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0.05, 0.015),
            new THREE.Vector2(0.12, 0.035),
            new THREE.Vector2(0.115, 0.06),
            new THREE.Vector2(0.03, 0.035),
            new THREE.Vector2(0, 0.03),
          ],
          10,
        ),
        placed(0, 0.13, 0),
      );
    } else {
      for (const dx of [-0.035, 0.035])
        builder.add(berry, new THREE.IcosahedronGeometry(0.05, 0), placed(dx, 0.065, 0));
      builder.add(berry, new THREE.IcosahedronGeometry(0.045, 0), placed(0, 0.07, 0.06));
      builder.add(leaf, new THREE.ConeGeometry(0.05, 0.07, 3), placed(0, 0.11, 0.02, { z: 0.4 }));
    }
    const model = builder.build();
    model.group.position.set(
      Math.cos(index * 2.4) * (0.13 + index * 0.024),
      0,
      Math.sin(index * 2.4) * (0.13 + index * 0.024),
    );
    model.group.scale.setScalar(0.85 + (index % 3) * 0.13);
    models.push(model);
    group.add(model.group);
  }
  return {
    item: item as ItemId,
    group,
    show(count: number) {
      group.visible = count > 0;
      models.forEach((model, index) => (model.group.visible = index < count));
    },
    dispose() {
      models.forEach((model) => model.dispose());
    },
  };
}

export function createMealModel(item: 'trailRation' | 'forestStew' | 'berryTea') {
  const builder = new ModelBuilder();
  const wood = paintedMaterial('wood', { tint: 0xdbc19b, roughness: 0.95 });
  if (item === 'trailRation') {
    const wrap = paintedMaterial('burlap', { tint: 0xf5d7a4, roughness: 1 });
    builder.add(wrap, new THREE.BoxGeometry(0.22, 0.08, 0.16), placed(0, 0.07, 0));
    builder.add(wood, new THREE.BoxGeometry(0.02, 0.09, 0.17), placed(0, 0.075, 0));
  } else {
    builder.add(wood, new THREE.CylinderGeometry(0.12, 0.075, 0.09, 12), placed(0, 0.055, 0));
    const broth = plainMaterial(item === 'forestStew' ? 0xb78b4f : 0x92576d, { roughness: 0.45 });
    builder.add(
      broth,
      new THREE.CircleGeometry(0.106, 12),
      placed(0, 0.103, 0, { x: -Math.PI / 2 }),
    );
    if (item === 'forestStew')
      for (const dx of [-0.045, 0.02])
        builder.add(wood, new THREE.IcosahedronGeometry(0.024, 0), placed(dx, 0.109, 0.015));
  }
  const model = builder.build();
  return {
    ...model,
    item: item as ItemId,
    show(count: number) {
      model.group.visible = count > 0;
    },
  };
}
