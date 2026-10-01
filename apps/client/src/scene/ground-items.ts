import * as THREE from 'three/webgpu';

import {
  GATHER_PATCH_MAX_COUNT,
  ITEM_KINDS,
  type DroppedPileView,
  type GatherPatchView,
  type ItemId,
} from '@acorn/shared';

import { plainMaterial } from '../art/materials';
import { flowerModelParts } from './flower-models';
import { createStickPatchModel } from './pickup-models';

/**
 * Things lying on the grass to be picked up by hand: the stick and flower
 * patches, and whatever anybody has dropped (see decision 0061).
 *
 * Both are drawn wherever the server says they are, and only ever as many as
 * are actually there: a patch with two sticks left shows two sticks.
 */
export interface GroundItems {
  readonly group: THREE.Group;
  /** Draw every patch where it is now, with as many as it has left. A picked-clean one is not drawn. */
  setGatherPatches(patches: readonly GatherPatchView[]): void;
  /** Draw every pile that is still lying about, and nothing that has since been picked up or faded. */
  setDroppedPiles(piles: readonly DroppedPileView[]): void;
  dispose(): void;
}

/** One patch or pile as drawn: whatever it is made of, and how to show only some of it. */
interface GroundModel {
  readonly item: ItemId;
  readonly group: THREE.Group;
  /** Show this many of it, or nothing at all for zero. */
  show(count: number): void;
  dispose(): void;
}

/** One drawn pile, along with how many it was drawn holding, so it is only rebuilt when that changes. */
interface DrawnPile {
  readonly model: GroundModel;
  count: number;
}

/**
 * `heightAt` is the ground's height anywhere: patches only ever grow in the
 * flat clearing, but something can be dropped anywhere out in the hills.
 */
export function createGroundItems(heightAt: (x: number, z: number) => number): GroundItems {
  const group = new THREE.Group();
  const patches = new Map<number, GroundModel>();
  const piles = new Map<number, DrawnPile>();

  const remove = (model: GroundModel): void => {
    group.remove(model.group);
    model.dispose();
  };

  return {
    group,
    setGatherPatches: (views) => {
      const present = new Set<number>();
      for (const view of views) {
        present.add(view.id);
        let model = patches.get(view.id);
        if (model === undefined || model.item !== view.item) {
          if (model !== undefined) remove(model);
          model = createPatchModel(view.item);
          patches.set(view.id, model);
          group.add(model.group);
        }
        model.group.position.set(view.x, heightAt(view.x, view.z), view.z);
        model.show(view.remaining);
      }
      for (const [id, model] of patches) {
        if (present.has(id)) continue;
        remove(model);
        patches.delete(id);
      }
    },
    setDroppedPiles: (views) => {
      const present = new Set<number>();
      for (const view of views) {
        present.add(view.id);
        let drawn = piles.get(view.id);
        if (drawn === undefined || drawn.model.item !== view.item) {
          if (drawn !== undefined) remove(drawn.model);
          drawn = { model: createPileModel(view.item), count: -1 };
          piles.set(view.id, drawn);
          group.add(drawn.model.group);
        }
        drawn.model.group.position.set(view.x, heightAt(view.x, view.z), view.z);
        if (drawn.count !== view.count) {
          drawn.model.show(view.count);
          drawn.count = view.count;
        }
      }
      for (const [id, drawn] of piles) {
        if (present.has(id)) continue;
        remove(drawn.model);
        piles.delete(id);
      }
    },
    dispose: () => {
      for (const model of patches.values()) remove(model);
      for (const drawn of piles.values()) remove(drawn.model);
      patches.clear();
      piles.clear();
    },
  };
}

/** A stick or flower patch, built to hold as many as any patch ever can. */
function createPatchModel(item: ItemId): GroundModel {
  return item === 'flower' ? createFlowerModel('flower') : createSticksModel(item);
}

/**
 * Something dropped. Sticks and flowers look the same as a patch of them, so
 * a dropped handful reads as exactly what it is; anything else is a small
 * bundle in its own colour until it has a model of its own.
 */
function createPileModel(item: ItemId): GroundModel {
  if (item === 'stick') return createSticksModel(item);
  if (item === 'flower') return createFlowerModel(item);
  return createBundleModel(item);
}

/** Show the first `count` of these and hide the rest, hiding the lot when there are none. */
function showFirst(group: THREE.Object3D, parts: readonly THREE.Object3D[], count: number): void {
  group.visible = count > 0;
  parts.forEach((part, index) => {
    part.visible = index < count;
  });
}

/** A few fallen sticks, one more showing for every one there is (see pickup-models.ts). */
function createSticksModel(item: ItemId): GroundModel {
  const patch = createStickPatchModel();
  return {
    item,
    group: patch.group,
    show: (count) => showFirst(patch.group, patch.sticks, count),
    dispose: () => patch.dispose(),
  };
}

/**
 * Where each wildflower of a patch stands, in the order they are drawn: a
 * patch with three left shows the first three, scattered within a step or
 * two of its middle.
 */
const FLOWER_OFFSETS: readonly { x: number; z: number }[] = [
  { x: 0, z: 0 },
  { x: 0.28, z: 0.12 },
  { x: -0.22, z: 0.2 },
  { x: 0.1, z: -0.26 },
  { x: -0.26, z: -0.1 },
  { x: 0.24, z: -0.08 },
].slice(0, GATHER_PATCH_MAX_COUNT);

/**
 * A little patch of wildflowers: one bloom for every flower left in it, each
 * on its own thin stem.
 */
function createFlowerModel(item: ItemId): GroundModel {
  const group = new THREE.Group();
  const blooms: THREE.Group[] = [];
  const owned: Array<{ dispose(): void }> = [];

  const realFlower = flowerModelParts();
  if (realFlower !== undefined) {
    // Shared geometry and material loaded once for every flower patch and
    // bed in the world, so this group never owns them to dispose.
    FLOWER_OFFSETS.forEach((offset, index) => {
      const bloom = new THREE.Group();
      bloom.position.set(offset.x, 0, offset.z);
      bloom.rotation.y = index * 1.3;
      for (const part of realFlower) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.castShadow = true;
        bloom.add(mesh);
      }
      blooms.push(bloom);
      group.add(bloom);
    });
  } else {
    const stemGeometry = new THREE.CylinderGeometry(0.012, 0.018, 0.3, 5);
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 0.9 });
    const headGeometry = new THREE.SphereGeometry(0.07, 6, 5);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: ITEM_KINDS.flower.placeholderColor,
      roughness: 0.7,
      flatShading: true,
    });
    owned.push(stemGeometry, stemMaterial, headGeometry, headMaterial);

    for (const offset of FLOWER_OFFSETS) {
      const bloom = new THREE.Group();
      bloom.position.set(offset.x, 0, offset.z);

      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.position.y = 0.15;
      stem.castShadow = true;

      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 0.32;
      head.castShadow = true;

      bloom.add(stem, head);
      blooms.push(bloom);
      group.add(bloom);
    }
  }

  return {
    item,
    group,
    show: (count) => showFirst(group, blooms, count),
    dispose: () => {
      for (const thing of owned) thing.dispose();
    },
  };
}

/** How many lumps a bundle shows at most, however many it really holds. */
const BUNDLE_LUMPS: readonly { x: number; z: number; size: number }[] = [
  { x: 0, z: 0, size: 1 },
  { x: 0.16, z: 0.1, size: 0.8 },
  { x: -0.12, z: 0.14, size: 0.7 },
];

/**
 * A placeholder for anything dropped that has no model of its own yet: a
 * squat lump or three in the item's own colour, one more for each of the
 * first few there are.
 */
function createBundleModel(item: ItemId): GroundModel {
  const group = new THREE.Group();
  const lumps: THREE.Mesh[] = [];

  const lumpGeometry = new THREE.IcosahedronGeometry(0.12, 0);
  // Shared with everything else of the same colour (see materials.ts), so
  // never disposed here.
  const lumpMaterial = plainMaterial(ITEM_KINDS[item].placeholderColor, {
    roughness: 0.8,
    flatShading: true,
  });

  for (const lump of BUNDLE_LUMPS) {
    const mesh = new THREE.Mesh(lumpGeometry, lumpMaterial);
    mesh.position.set(lump.x, 0.07 * lump.size, lump.z);
    mesh.scale.set(lump.size, lump.size * 0.65, lump.size);
    mesh.rotation.y = lump.x * 7;
    mesh.castShadow = true;
    lumps.push(mesh);
    group.add(mesh);
  }

  return {
    item,
    group,
    show: (count) => showFirst(group, lumps, count),
    dispose: () => lumpGeometry.dispose(),
  };
}
