import { preloadSkeletonTown } from '../scene/skeleton-town';
import * as THREE from 'three/webgpu';
import { gearSlotsOf, type ItemId } from '@acorn/shared';
import { heldItemParts } from '../scene/character';
import { preloadItemModels } from '../scene/item-models';
import { preloadFlowerModel } from '../scene/flower-models';
import { wornWeapon, woodenShieldParts } from '../scene/gear-models';
import { createGearVisuals } from '../scene/gear-visuals';
import { createPileModel } from '../scene/ground-items';
import { createSatchel } from '../scene/pickup-models';
import { createGuardianTrophy } from '../scene/guardian-trophy';
import {
  instantiateAnimatedModel,
  loadAnimatedModel,
  type ModelPart,
} from '../scene/model-loading';
import { preloadWornGearModels } from '../scene/worn-gear-models';
import bodyUrl from '@assets/characters/knight.glb?url';

export interface ItemModel {
  readonly group: THREE.Group;
  dispose(): void;
}
let body: ReturnType<typeof loadAnimatedModel> | undefined;

/** Copy only drawable surfaces. Cached game geometry, materials and textures remain untouched. */
function copySurfaces(root: THREE.Object3D, onlyGear?: ItemId): ItemModel {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
  });
  const group = new THREE.Group();
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh) || (onlyGear && object.userData.gearItem !== onlyGear))
      return;
    let geometry = object.geometry.clone();
    if (object instanceof THREE.SkinnedMesh) {
      const positions = geometry.getAttribute('position');
      const point = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        object.getVertexPosition(i, point);
        positions.setXYZ(i, point.x, point.y, point.z);
      }
    }
    // Clothing shells share the body's attributes but index only their own triangles.
    if (geometry.index !== null) {
      const indexed = geometry;
      geometry = indexed.toNonIndexed();
      indexed.dispose();
    }
    geometry.applyMatrix4(object.matrixWorld);
    geometry.computeVertexNormals();
    const material = Array.isArray(object.material)
      ? object.material.map((m) => m.clone())
      : object.material.clone();
    group.add(new THREE.Mesh(geometry, material));
  });
  return {
    group,
    dispose: () => {
      for (const mesh of group.children as THREE.Mesh[]) {
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          material.dispose();
      }
      group.clear();
    },
  };
}
function copyParts(parts: readonly ModelPart[]): ItemModel {
  const source = new THREE.Group();
  for (const part of parts) source.add(new THREE.Mesh(part.geometry, part.material));
  return copySurfaces(source);
}

/** The same held tools, wearable shells and dropped items used in the world; no separate preview art. */
export async function createItemModel(item: ItemId): Promise<ItemModel> {
  if (['axe', 'rod', 'refinedAxe', 'refinedRod', 'torch', 'shovel'].includes(item))
    await preloadItemModels();
  const held = heldItemParts(item);
  if (held) return copyParts(held);
  const weapon = wornWeapon(item);
  if (weapon) return copyParts(weapon.parts);
  if (item === 'woodenShield') return copyParts(woodenShieldParts());
  const slot = gearSlotsOf(item).find((slot) => slot !== 'mainHand' && slot !== 'offHand');
  if (slot) {
    body ??= loadAnimatedModel(bodyUrl);
    const [template] = await Promise.all([body, preloadWornGearModels()]);
    const instance = instantiateAnimatedModel(template);
    const gear = createGearVisuals(instance.root, undefined, 1);
    try {
      gear.setWorn({ [slot]: item });
      return copySurfaces(instance.root, item);
    } finally {
      gear.dispose();
      instance.mixer.uncacheRoot(instance.root);
    }
  }
  if (item === 'lastBellTrophy') await preloadSkeletonTown();
  if (item === 'flower') await preloadFlowerModel();
  const source =
    item === 'bag'
      ? createSatchel()
      : item === 'guardianTrophy'
        ? createGuardianTrophy()
        : createPileModel(item);
  if ('show' in source) source.show(1);
  try {
    return copySurfaces(source.group);
  } finally {
    source.dispose();
  }
}
