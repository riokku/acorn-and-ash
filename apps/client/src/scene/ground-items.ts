import { createForageModel, createMealModel } from './forest-food';
import * as THREE from 'three/webgpu';

import {
  GATHER_PATCH_MAX_COUNT,
  ITEM_KINDS,
  blueprintHome,
  type DroppedPileView,
  type GatherPatchView,
  type ItemId,
} from '@acorn/shared';

import { paintedMaterial, plainMaterial } from '../art/materials';
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
  /** A patch highlights the last visible piece, which is the next one gathering removes. */
  target(kind: 'patch' | 'pile', id: number): THREE.Object3D | null;
  patchObject(id: number): THREE.Object3D | null;
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
        if (view.item === 'log') drawn.model.group.rotation.y = view.id * 2.399963;
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
    patchObject: (id) => {
      const model = patches.get(id);
      return model?.group.visible === true ? model.group : null;
    },
    target: (kind, id) => {
      const model = kind === 'patch' ? patches.get(id) : piles.get(id)?.model;
      if (model === undefined || !model.group.visible) return null;
      if (kind === 'pile') return model.group;
      return model.group.children.findLast((child) => child.visible) ?? null;
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
  if (item === 'berry' || item === 'mushroom') return createForageModel(item);
  return item === 'flower' ? createFlowerModel('flower') : createSticksModel(item);
}

/**
 * Something dropped. Sticks and flowers look the same as a patch of them, so
 * a dropped handful reads as exactly what it is; anything else is a small
 * bundle in its own colour until it has a model of its own.
 */
function createPileModel(item: ItemId): GroundModel {
  if (item === 'berry' || item === 'mushroom') return createForageModel(item);
  if (item === 'trailRation' || item === 'forestStew' || item === 'berryTea')
    return createMealModel(item);
  if (blueprintHome(item) !== null) return createBlueprintModel(item);
  if (item === 'stick') return createSticksModel(item);
  if (item === 'flower') return createFlowerModel(item);
  if (item === 'bone') return createBonesModel(item);
  if (item === 'log') return createLogsModel();
  return createBundleModel(item);
}

/** Short bark-covered lengths with visible growth rings, lying on the grass. */
function createLogsModel(): GroundModel {
  const group = new THREE.Group();
  const geometry = new THREE.CylinderGeometry(0.14, 0.17, 0.8, 9).rotateZ(Math.PI / 2);
  const bark = paintedMaterial('bark', { roughness: 1 });
  const end = paintedMaterial('logEnd', { roughness: 0.95 });
  const logs: THREE.Mesh[] = [];
  for (let index = 0; index < 5; index++) {
    const log = new THREE.Mesh(geometry, [bark, end, end]);
    log.position.set((index % 2) * 0.14, 0.16 + Math.floor(index / 3) * 0.24, (index % 3) * 0.25);
    log.rotation.y = index * 0.16;
    log.castShadow = true;
    log.receiveShadow = true;
    group.add(log);
    logs.push(log);
  }
  return {
    item: 'log',
    group,
    show: (count) => showFirst(group, logs, count),
    dispose: () => geometry.dispose(),
  };
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

/** Where each bone of a pile lies, and which way: crossed over each other, one more for each there is. */
const BONE_PLACES: readonly { x: number; z: number; yaw: number }[] = [
  { x: 0, z: 0, yaw: 0.4 },
  { x: 0.05, z: 0.06, yaw: -0.9 },
  { x: -0.12, z: 0.1, yaw: 1.7 },
];

/**
 * What a beaten skeleton leaves behind (see decision 0063): a bone or two
 * lying in the grass, a shaft with a knuckle at each end - built from the
 * same simple shapes as every other placeholder.
 */
function createBonesModel(item: ItemId): GroundModel {
  const group = new THREE.Group();
  const bones: THREE.Group[] = [];
  const length = 0.34;
  const shaftGeometry = new THREE.CylinderGeometry(0.022, 0.026, length, 6).rotateZ(Math.PI / 2);
  const knuckleGeometry = new THREE.IcosahedronGeometry(0.038, 0);
  // Shared with everything else of the same colour (see materials.ts), so
  // never disposed here.
  const material = plainMaterial(ITEM_KINDS[item].placeholderColor, {
    roughness: 0.65,
    flatShading: true,
  });
  for (const place of BONE_PLACES) {
    const bone = new THREE.Group();
    bone.position.set(place.x, 0.035, place.z);
    bone.rotation.y = place.yaw;
    const shaft = new THREE.Mesh(shaftGeometry, material);
    shaft.castShadow = true;
    bone.add(shaft);
    for (const end of [-1, 1]) {
      for (const side of [-1, 1]) {
        const knuckle = new THREE.Mesh(knuckleGeometry, material);
        knuckle.position.set((end * length) / 2, 0, side * 0.026);
        knuckle.castShadow = true;
        bone.add(knuckle);
      }
    }
    bones.push(bone);
    group.add(bone);
  }
  return {
    item,
    group,
    show: (count) => showFirst(group, bones, count),
    dispose: () => {
      shaftGeometry.dispose();
      knuckleGeometry.dispose();
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

/** A rolled blueprint with pale paper edges and a blue drafting sheet. */
function createBlueprintModel(item: ItemId): GroundModel {
  const group = new THREE.Group();
  const paper = paintedMaterial('burlap', { tint: 0xffedca, roughness: 1 });
  const ink = plainMaterial(0x63858e, { roughness: 0.9 });
  const geometries: THREE.BufferGeometry[] = [];
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): void => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(new THREE.BoxGeometry(0.36, 0.02, 0.26), ink, 0, 0.055, 0);
  for (const x of [-0.2, 0.2])
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 8).rotateX(Math.PI / 2), paper, x, 0.075, 0);
  for (const x of [-0.08, 0, 0.08])
    add(new THREE.BoxGeometry(0.008, 0.006, 0.2), paper, x, 0.07, 0);
  add(new THREE.BoxGeometry(0.27, 0.006, 0.008), paper, 0, 0.07, 0);
  return {
    item,
    group,
    show(count) {
      group.visible = count > 0;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
