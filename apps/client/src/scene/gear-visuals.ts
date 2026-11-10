import { ITEM_KINDS } from '../item-catalog';
import * as THREE from 'three/webgpu';

import { GEAR_SLOTS, type GearSlot, type ItemId, type WornGear } from '@acorn/shared';

import { plainMaterial } from '../art/materials';
import { wornGearModelTemplate } from './worn-gear-models';
import { bodyUnderClothes, type BoundGeometry } from './hidden-under-clothes';
import { woodenShieldParts, wornWeapon } from './gear-models';

/**
 * What a character is wearing, drawn on the body (decision 0113).
 *
 * Every helm is its own file fitted to the dwarves (tools/art/dwarf_hats.py,
 * decision 0283): the Knight's helmet and visor, the Mage's hat, the bear hat,
 * the mask, the wool cap and the Last Watch helm. Both bodies share one
 * skeleton, so each fits either head. Every top is fitted the same way
 * (tools/art/soft_tops.py, decision 0284), one fit for each body in its file.
 * On the old Adventurers, clothes are a thin coloured skin laid over the
 * matching part of the body. The shield hangs from the off hand.
 *
 * The pieces already baked into the six models (the helmet, the hat, the mask)
 * are hidden, so a head is bare until a helm is worn.
 */

/** The baked-in head pieces to hide, by the end of their names. */
const BAKED_HEAD_PIECE = /_(Helmet|HelmetVisor|Hat|BearHat|Mask)$/;

/**
 * The players' own body meshes are named `dwarf1` and `dwarf2` (split by colour: `dwarf1_1`).
 * The soft bodies before them were `body1` and `body2`.
 */
const SOFT_BODY = /^((?:body|dwarf)\d)(?:_\d+)?$/;
/** The knot or bun on top of a dwarf's hair (split by colour: `dwarf1_HairTop_1`). */
const HAIR_TOP = /_HairTop(?:_\d+)?$/;
/** Helm-slot pieces that leave the top of the head bare. */
const LEAVES_HAIR_TOP: ReadonlySet<ItemId> = new Set<ItemId>(['rogueMask']);
/** A piece fitted to one of them ends in its name: `linen_shirt_dwarf1`. */
const FIT_FOR = /_((?:body|dwarf)\d)$/;

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
    { meshes: /_Body(?:_\d+)?$/, region: (min) => min >= CHEST_BOTTOM, inflate: 0.02 },
    {
      meshes: /_Arm(Left|Right)(?:_\d+)?$/,
      region: (_min, _max, x) => x <= HAND_STARTS_AT,
      inflate: 0.02,
    },
  ],
  lowerBody: [
    { meshes: /_Body(?:_\d+)?$/, region: (_min, max) => max <= HIPS_TOP, inflate: 0.03 },
    { meshes: /_Leg(Left|Right)(?:_\d+)?$/, region: (min) => min >= BOOT_TOP, inflate: 0.025 },
  ],
  feet: [
    { meshes: /_Leg(Left|Right)(?:_\d+)?$/, region: (_min, max) => max < BOOT_TOP, inflate: 0.035 },
  ],
  hands: [
    {
      meshes: /_Arm(Left|Right)(?:_\d+)?$/,
      region: (_min, _max, x) => x > HAND_STARTS_AT,
      inflate: 0.035,
    },
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
 * parented that deep in its skeleton. With `bodyFitted` true (the old
 * Adventurers), clothes are a skin laid over the body's own parts; with it
 * false (the soft bodies), each piece comes from its fitted file, and a piece
 * without one is left off. Helms always come from their fitted files.
 */
export function createGearVisuals(
  model: THREE.Object3D,
  leftHand: THREE.Object3D | undefined,
  heldScale: number,
  { bodyFitted = true }: { readonly bodyFitted?: boolean } = {},
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

  /**
   * Which soft body this is ('body1' or 'body2'), from its mesh's name, or from the
   * group that holds it when the mesh was split by colour (Body 1's parts are `body1002_0`).
   */
  const wearer = skinned
    .flatMap((mesh) => [mesh.name, mesh.parent?.name ?? ''])
    .map((name) => SOFT_BODY.exec(name)?.[1])
    .find((found) => found);

  /**
   * Draws a piece from its own fitted file. A top holds one fit for each body, named for it
   * (`linen_shirt_body1`), and only the wearer's is drawn; a helm fits both, so all of it is.
   */
  const buildFitted = (item: ItemId, into: THREE.Object3D[]): void => {
    const body = skinned[0];
    const template = wornGearModelTemplate(item);
    if (template === undefined || body === undefined) return;
    template.root.traverse((found) => {
      if (!(found instanceof THREE.SkinnedMesh) || !fitsWearer(found, template.root)) return;
      const material = Array.isArray(found.material) ? found.material[0] : found.material;
      if (material !== undefined) addSkinned(body, found, found.geometry, material, into);
    });
  };

  /** Whether a piece is the wearer's fit, or one made for any body. */
  const fitsWearer = (piece: THREE.Object3D, root: THREE.Object3D): boolean => {
    for (let at: THREE.Object3D | null = piece; at !== null && at !== root; at = at.parent) {
      const fit = FIT_FOR.exec(at.name)?.[1];
      if (fit !== undefined) return fit === wearer;
    }
    return true;
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

  /** A knife worn in the off hand, the same knife the main hand swings, its point forward. */
  const buildOffHandKnife = (into: THREE.Object3D[]): void => {
    const knife = wornWeapon('huntingKnife');
    if (leftHand === undefined || knife === undefined) return;
    const held = new THREE.Group();
    for (const part of knife.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = true;
      held.add(mesh);
    }
    held.scale.setScalar(heldScale);
    leftHand.add(held);
    into.push(held);
  };

  const build = (slot: GearSlot, item: ItemId): THREE.Object3D[] => {
    const objects: THREE.Object3D[] = [];
    if (slot === 'helm') {
      buildFitted(item, objects);
    } else if (
      slot === 'upperBody' ||
      slot === 'lowerBody' ||
      slot === 'feet' ||
      slot === 'hands'
    ) {
      if (bodyFitted) buildSkin(slot, item, objects);
      else buildFitted(item, objects);
    } else if (slot === 'offHand' && item === 'woodenShield') buildShield(objects);
    else if (slot === 'offHand' && item === 'huntingKnife') buildOffHandKnife(objects);
    for (const object of objects)
      object.traverse((part) => {
        part.userData.gearItem = item;
      });
    return objects;
  };

  /** The soft body's own meshes, with the geometry each was loaded with. */
  const bareBody = new Map(
    skinned
      .filter((mesh) => SOFT_BODY.test(mesh.name) || SOFT_BODY.test(mesh.parent?.name ?? ''))
      .map((mesh) => [mesh, mesh.geometry] as const),
  );

  /**
   * A piece of this model as it stood when bound, in `bone`'s frame. Body 1's file packs
   * its vertices into a small box and keeps the unpacking in its bind pose, so its bare
   * vertices only line up with a top's once both are taken to the same bone.
   */
  const boundTo = (
    mesh: THREE.SkinnedMesh,
    geometry: THREE.BufferGeometry,
    bone: THREE.Bone,
  ): BoundGeometry | undefined => {
    const inverse = mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(bone)];
    if (inverse === undefined) return undefined;
    return { geometry, toBone: inverse.clone().multiply(mesh.bindMatrix) };
  };

  /** Leaves out the parts of a soft body its fitted clothes cover, so none pokes through. */
  const hideCoveredBody = (): void => {
    const cloth: THREE.SkinnedMesh[] = [];
    for (const [slot, { objects }] of shown)
      if (slot !== 'helm' && !bodyFitted)
        for (const object of objects) if (object instanceof THREE.SkinnedMesh) cloth.push(object);
    for (const [mesh, bare] of bareBody) {
      const bone = mesh.skeleton.bones[0];
      const body = bone && boundTo(mesh, bare, bone);
      const covers = bone
        ? cloth.flatMap((piece) => boundTo(piece, piece.geometry, bone) ?? [])
        : [];
      mesh.geometry = body && covers.length > 0 ? bodyUnderClothes(body, covers) : bare;
    }
  };

  /**
   * A dwarf's knot or bun stands above the hair (`<id>_HairTop`) and would poke through a
   * hat, so it is left off while one is worn (decision 0291). A mask leaves the top of the
   * head bare, so the knot stays.
   */
  const hairTops: THREE.Object3D[] = [];
  model.traverse((child) => {
    if (HAIR_TOP.test(child.name)) hairTops.push(child);
  });
  const showHairTop = (): void => {
    const helm = shown.get('helm')?.item;
    const covered = helm !== undefined && !LEAVES_HAIR_TOP.has(helm);
    for (const piece of hairTops) piece.visible = !covered;
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
      hideCoveredBody();
      showHairTop();
    },
    dispose: () => {
      for (const slot of GEAR_SLOTS) clear(slot);
      hideCoveredBody();
      showHairTop();
    },
  };
}
