import * as THREE from 'three/webgpu';

import {
  GEAR_SLOTS,
  ITEM_KINDS,
  type CharacterId,
  type GearSlot,
  type ItemId,
  type WornGear,
} from '@acorn/shared';

import { plainMaterial } from '../art/materials';
import { characterModelTemplate } from './character-model';
import { woodenShieldParts } from './gear-models';

/**
 * What a character is wearing, drawn on the body (decision 0113).
 *
 * Helms are the real head pieces already in the character models: the Knight's
 * helmet and visor, the Mage's hat, the Barbarian's bear hat and the hooded
 * Rogue's mask. Every body shares one skeleton, so any of them fits on any head.
 * Body, legs, boots and gloves are a thin coloured skin laid over the matching
 * part of the body, and the shield hangs from the off hand. All of it stands in
 * for the real pieces that will come out of a Blender session.
 *
 * The pieces already baked into the six models (the helmet, the hat, the mask)
 * are hidden, so a head is bare until a helm is worn.
 */

/** The head pieces in the character models, and which model each one is cut from. */
const HELM_SOURCES: Partial<Record<ItemId, { from: CharacterId; nodes: readonly string[] }>> = {
  knightHelmet: { from: 'knight', nodes: ['Knight_Helmet', 'Knight_HelmetVisor'] },
  mageHat: { from: 'mage', nodes: ['Mage_Hat'] },
  bearHat: { from: 'barbarian', nodes: ['Barbarian_BearHat'] },
  rogueMask: { from: 'rogueHooded', nodes: ['RogueHooded_Mask'] },
};

/** The baked-in head pieces to hide, by the end of their names. */
const BAKED_HEAD_PIECE = /_(Helmet|HelmetVisor|Hat|BearHat|Mask)$/;

/** Along the arm (in the model's own units) from here out is the hand. */
const HAND_STARTS_AT = 0.78;
/** Below this height a leg is the foot. */
const BOOT_TOP = 0.16;
/** Above this height a body is the chest; below the next one, the hips. */
const CHEST_BOTTOM = 0.45;
const HIPS_TOP = 0.62;

interface Layer {
  /** Which parts of the body it covers, by the end of their names. */
  readonly meshes: RegExp;
  /** Which part of that mesh. A triangle is covered only if all its corners are. */
  readonly region: (minY: number, maxY: number, maxAbsX: number) => boolean;
  /** How far it stands off the skin, in the model's own units. */
  readonly inflate: number;
}

const LAYERS: Record<'upperBody' | 'lowerBody' | 'feet' | 'hands', readonly Layer[]> = {
  upperBody: [
    { meshes: /_Body$/, region: (min) => min >= CHEST_BOTTOM, inflate: 0.02 },
    { meshes: /_Arm(Left|Right)$/, region: (_min, _max, x) => x <= HAND_STARTS_AT, inflate: 0.02 },
  ],
  lowerBody: [
    { meshes: /_Body$/, region: (_min, max) => max <= HIPS_TOP, inflate: 0.03 },
    { meshes: /_Leg(Left|Right)$/, region: (min) => min >= BOOT_TOP, inflate: 0.025 },
  ],
  feet: [{ meshes: /_Leg(Left|Right)$/, region: (_min, max) => max < BOOT_TOP, inflate: 0.035 }],
  hands: [
    { meshes: /_Arm(Left|Right)$/, region: (_min, _max, x) => x > HAND_STARTS_AT, inflate: 0.035 },
  ],
};

const shellGeometries = new Map<string, THREE.BufferGeometry | null>();

/**
 * A copy of part of a body mesh, pushed out along its normals so it sits over
 * the skin. Built once per part and shared by everybody wearing something there.
 */
function shellOf(
  source: THREE.BufferGeometry,
  key: string,
  covers: Layer['region'],
  inflate: number,
): THREE.BufferGeometry | null {
  const cached = shellGeometries.get(key);
  if (cached !== undefined) return cached;

  const position = source.getAttribute('position');
  const normal = source.getAttribute('normal');
  const index = source.getIndex();
  const corners = index === null ? position.count : index.count;
  const kept: number[] = [];
  for (let at = 0; at + 2 < corners; at += 3) {
    const a = index === null ? at : index.getX(at);
    const b = index === null ? at + 1 : index.getX(at + 1);
    const c = index === null ? at + 2 : index.getX(at + 2);
    const ys = [position.getY(a), position.getY(b), position.getY(c)];
    const xs = [position.getX(a), position.getX(b), position.getX(c)].map(Math.abs);
    if (covers(Math.min(...ys), Math.max(...ys), Math.max(...xs))) kept.push(a, b, c);
  }
  if (kept.length === 0) {
    shellGeometries.set(key, null);
    return null;
  }

  const shell = source.clone();
  const out = shell.getAttribute('position');
  for (let at = 0; at < out.count; at++) {
    out.setXYZ(
      at,
      out.getX(at) + normal.getX(at) * inflate,
      out.getY(at) + normal.getY(at) * inflate,
      out.getZ(at) + normal.getZ(at) * inflate,
    );
  }
  shell.setIndex(kept);
  shellGeometries.set(key, shell);
  return shell;
}

const materials = new Map<ItemId, THREE.MeshStandardMaterial>();

function clothMaterial(item: ItemId): THREE.MeshStandardMaterial {
  const existing = materials.get(item);
  if (existing !== undefined) return existing;
  const made = plainMaterial(ITEM_KINDS[item].placeholderColor, {
    roughness: 0.85,
    flatShading: true,
  });
  materials.set(item, made);
  return made;
}

export interface GearVisuals {
  /** Shows exactly this gear (the weapon in the main hand is the character's own business). */
  setWorn(worn: Readonly<WornGear>): void;
  dispose(): void;
}

/** Hides the head pieces baked into a model, so a head is bare until a helm is worn. */
export function hideBakedHeadPieces(model: THREE.Object3D): void {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && BAKED_HEAD_PIECE.test(child.name)) child.visible = false;
  });
}

/**
 * Gear for the character built from this model. `leftHand` is the bone the
 * shield hangs from; `heldScale` cancels the character's own scale for things
 * parented that deep in its skeleton.
 */
export function createGearVisuals(
  model: THREE.Object3D,
  leftHand: THREE.Object3D | undefined,
  heldScale: number,
): GearVisuals {
  const skinned: THREE.SkinnedMesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) skinned.push(child);
  });

  const shown = new Map<GearSlot, { item: ItemId; objects: THREE.Object3D[] }>();

  /** This model's own bones by name, so another model's piece can be hung on them. */
  const bonesByName = new Map<string, THREE.Bone>();
  for (const mesh of skinned)
    for (const bone of mesh.skeleton.bones) bonesByName.set(bone.name, bone);

  /**
   * A skeleton for a piece cut from another model: that piece's own rest pose,
   * on this model's bones, matched by name. Every body shares one rig, but not
   * one rest pose, and a hat sits where its own head was, not this one's.
   */
  const skeletonFor = (source: THREE.SkinnedMesh): THREE.Skeleton => {
    const bones = source.skeleton.bones.map((bone) => bonesByName.get(bone.name) ?? bone);
    return new THREE.Skeleton(bones, source.skeleton.boneInverses);
  };

  /**
   * Adds a skinned piece beside `neighbour` in this model, rigged as `source`
   * is: the same mesh for a skin laid over the body, or another model's for a
   * helm.
   */
  const addSkinned = (
    neighbour: THREE.SkinnedMesh,
    source: THREE.SkinnedMesh,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    into: THREE.Object3D[],
  ): void => {
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.bind(source === neighbour ? source.skeleton : skeletonFor(source), source.bindMatrix);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    (neighbour.parent ?? model).add(mesh);
    into.push(mesh);
  };

  const buildHelm = (item: ItemId, into: THREE.Object3D[]): void => {
    const piece = HELM_SOURCES[item];
    const body = skinned[0];
    const template = piece === undefined ? undefined : characterModelTemplate(piece.from);
    if (piece === undefined || template === undefined || body === undefined) return;
    for (const name of piece.nodes) {
      const found = template.root.getObjectByName(name);
      if (found instanceof THREE.SkinnedMesh) {
        const material = Array.isArray(found.material) ? found.material[0] : found.material;
        if (material !== undefined) addSkinned(body, found, found.geometry, material, into);
      }
    }
  };

  const buildSkin = (slot: keyof typeof LAYERS, item: ItemId, into: THREE.Object3D[]): void => {
    for (const layer of LAYERS[slot]) {
      for (const mesh of skinned) {
        if (!layer.meshes.test(mesh.name)) continue;
        const key = `${mesh.geometry.uuid}:${slot}`;
        const shell = shellOf(mesh.geometry, key, layer.region, layer.inflate);
        if (shell !== null) addSkinned(mesh, mesh, shell, clothMaterial(item), into);
      }
    }
  };

  const buildShield = (into: THREE.Object3D[]): void => {
    if (leftHand === undefined) return;
    const held = new THREE.Group();
    for (const part of woodenShieldParts()) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = true;
      held.add(mesh);
    }
    held.scale.setScalar(heldScale);
    held.position.set(0.0, 0.0, 0.0);
    leftHand.add(held);
    into.push(held);
  };

  const build = (slot: GearSlot, item: ItemId): THREE.Object3D[] => {
    const objects: THREE.Object3D[] = [];
    if (slot === 'helm') buildHelm(item, objects);
    else if (slot === 'upperBody' || slot === 'lowerBody' || slot === 'feet' || slot === 'hands') {
      buildSkin(slot, item, objects);
    } else if (slot === 'offHand' && item === 'woodenShield') buildShield(objects);
    return objects;
  };

  const clear = (slot: GearSlot): void => {
    const current = shown.get(slot);
    if (current === undefined) return;
    // Everything here only borrows its geometry and material, so nothing to free.
    for (const object of current.objects) object.removeFromParent();
    shown.delete(slot);
  };

  return {
    setWorn: (worn) => {
      for (const slot of GEAR_SLOTS) {
        const item = worn[slot];
        const current = shown.get(slot);
        if (current?.item === item) continue;
        clear(slot);
        if (item !== undefined) shown.set(slot, { item, objects: build(slot, item) });
      }
    },
    dispose: () => {
      for (const slot of GEAR_SLOTS) clear(slot);
    },
  };
}
