import { preloadSkeletonTown } from '../scene/skeleton-town';
import * as THREE from 'three/webgpu';
import { gearSlotsOf, type ItemId } from '@acorn/shared';
import { heldItemParts } from '../scene/character';
import { preloadItemModels } from '../scene/item-models';
import { preloadFlowerModel } from '../scene/flower-models';
import { wornWeapon, woodenShieldParts } from '../scene/gear-models';
import { createPileModel } from '../scene/ground-items';
import { createSatchel } from '../scene/pickup-models';
import { createGuardianTrophy } from '../scene/guardian-trophy';
import type { ModelPart } from '../scene/model-loading';

export interface ItemModel {
  readonly animated?: boolean;
  readonly group: THREE.Group;
  dispose(): void;
}

/** Copy only drawable surfaces. Cached game geometry, materials and textures remain untouched. */
function copySurfaces(root: THREE.Object3D): ItemModel {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
  });
  const group = new THREE.Group();
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
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

/**
 * The same held tools, weapons and dropped items used in the world; no separate preview art. Null
 * for clothes: they were fitted to bodies built of parts, and the soft bodies that replaced those
 * are one smooth piece (decision 0273), so clothes have no picture until they are refitted.
 */
export async function createItemModel(item: ItemId): Promise<ItemModel | null> {
  if (['axe', 'rod', 'refinedAxe', 'refinedRod', 'torch', 'shovel'].includes(item))
    await preloadItemModels();
  const held = heldItemParts(item);
  if (held) return copyParts(held);
  const weapon = wornWeapon(item);
  if (weapon) return { ...copyParts(weapon.parts), animated: item === 'kingsRequiem' };
  if (item === 'woodenShield') return copyParts(woodenShieldParts());
  if (gearSlotsOf(item).some((slot) => slot !== 'mainHand' && slot !== 'offHand')) return null;
  if (item === 'lastBellTrophy' || item === 'firstBellRelic') await preloadSkeletonTown();
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
