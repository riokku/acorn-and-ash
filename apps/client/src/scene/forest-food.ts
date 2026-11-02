import * as THREE from 'three/webgpu';
import { GATHER_PATCH_MAX_COUNT, type ItemId } from '@acorn/shared';
import { ModelBuilder, placed } from '../art/shapes';
import { paintedMaterial, plainMaterial } from '../art/materials';
import { polyforkGroup, polyforkPiece } from './polyfork-piece';

/**
 * Polyfork's free Toadstool, Mushroom Cluster and Berry Bush (decision 0272).
 * The mushrooms are shrunk to our mushrooms' size; the bush keeps its own.
 */
const MUSHROOM_SHRINK = 0.6;
const toadstool = polyforkPiece(
  'toadstool',
  new THREE.Matrix4().makeScale(MUSHROOM_SHRINK, MUSHROOM_SHRINK, MUSHROOM_SHRINK),
);
const mushroomCluster = polyforkPiece(
  'mushroom-cluster',
  new THREE.Matrix4().makeScale(MUSHROOM_SHRINK, MUSHROOM_SHRINK, MUSHROOM_SHRINK),
);
const berryBush = polyforkPiece('berry-bush');
/** Marks the part of a patch that stays put while its harvest is picked off it. */
export const PATCH_SCENERY = 'patchScenery';

/** The pieces of the real model for patch slot `index`, or undefined for the placeholder. */
function realForagePiece(
  item: 'berry' | 'mushroom',
  index: number,
): THREE.BufferGeometry[] | undefined {
  if (item === 'mushroom') {
    const piece = index % 2 === 0 ? toadstool.parts() : mushroomCluster.parts();
    return piece === undefined ? undefined : [...piece.values()];
  }
  // A loose berry is one of the bush's own sprigs, brought down to the ground.
  const fruit = berryBush.parts()?.get(`fruit-${index % 9}-mesh`);
  if (fruit === undefined) return undefined;
  looseFruit[index % 9] ??= groundedAtOrigin(fruit);
  return [looseFruit[index % 9]!];
}
const looseFruit: THREE.BufferGeometry[] = [];

function groundedAtOrigin(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const moved = geometry.clone();
  moved.computeBoundingBox();
  const box = moved.boundingBox!;
  moved.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  return moved;
}

/**
 * A wild berry patch on the real bush: the berries hang where Polyfork put
 * them and are picked off one at a time, and the bare bush stays standing
 * until they grow back.
 */
function createBerryBush(parts: ReadonlyMap<string, THREE.BufferGeometry>, colony: boolean) {
  const bush = parts.get('berry-bush-mesh');
  const sprigs = Array.from({ length: GATHER_PATCH_MAX_COUNT }, (_, index) =>
    parts.get(`fruit-${index}-mesh`),
  );
  if (bush === undefined || sprigs.some((sprig) => sprig === undefined)) return undefined;
  const group = new THREE.Group();
  const fruit = sprigs.map((sprig) => polyforkGroup('berry', [sprig!]));
  for (const piece of fruit) group.add(piece.group);
  // Last, after the berries: ground-items finds each berry by its place in the patch.
  const plant = polyforkGroup('berry-bush', [bush]);
  plant.group.userData[PATCH_SCENERY] = true;
  group.add(plant.group);
  if (colony) group.scale.setScalar(1.35);
  return {
    item: 'berry' as ItemId,
    group,
    show(count: number) {
      fruit.forEach((piece, index) => (piece.group.visible = index < count));
    },
    dispose: () => undefined,
  };
}

/** A berry or mushroom patch. `wild` grows berries on a whole bush rather than on the ground. */
export function createForageModel(item: 'berry' | 'mushroom', colony = false, wild = false) {
  const bushParts = item === 'berry' && wild ? berryBush.parts() : undefined;
  const bush = bushParts === undefined ? undefined : createBerryBush(bushParts, colony);
  if (bush !== undefined) return bush;
  const group = new THREE.Group();
  const models: ReturnType<ModelBuilder['build']>[] = [];
  const stem = paintedMaterial('burlap', { tint: 0xffefd3, roughness: 1 });
  const cap = paintedMaterial('burlap', { tint: 0xefc28a, roughness: 1 });
  const berry = plainMaterial(0x9d5063, { roughness: 0.8 });
  const leaf = plainMaterial(0x698646, { roughness: 1 });
  for (let index = 0; index < GATHER_PATCH_MAX_COUNT; index++) {
    const builder = new ModelBuilder();
    const real = realForagePiece(item, index);
    if (real !== undefined) {
      // The real model is built below; nothing to shape here.
    } else if (item === 'mushroom') {
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
    const model = real !== undefined ? polyforkGroup(item, real) : builder.build();
    if (real !== undefined) model.group.rotation.y = index * 1.7;
    model.group.position.set(
      Math.cos(index * 2.4) * (colony ? 0.35 + index * 0.07 : 0.13 + index * 0.024),
      0,
      Math.sin(index * 2.4) * (colony ? 0.35 + index * 0.07 : 0.13 + index * 0.024),
    );
    model.group.scale.setScalar((0.85 + (index % 3) * 0.13) * (colony ? 1.35 : 1));
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
