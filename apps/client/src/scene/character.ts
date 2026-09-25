import * as THREE from 'three/webgpu';

import { PLAYER_HEIGHT, PLAYER_RADIUS } from '@acorn/shared';

import { instantiateAnimatedModel, type AnimatedModel } from './model-loading';
import { characterModelTemplate } from './character-model';
import { itemModelParts } from './item-models';
import { pickAnimationState, type CharacterAnimState } from './character-animation';

export { pickAnimationState, type CharacterAnimState };

/**
 * A character: real modeled art once it has loaded (see character-model.ts),
 * or a capsule with a snout so you can tell which way it is facing until
 * then, the same fallback every other placeholder gets before its art
 * arrives. Every player currently draws the same one model - Knight, the
 * first of the pack's six - since there is no picker yet to choose between
 * them.
 */
export interface Character {
  readonly group: THREE.Group;
  setColor(color: THREE.ColorRepresentation): void;
  /** Which of the four named clips should be playing right now. A no-op on the placeholder. */
  setAnimationState(state: CharacterAnimState): void;
  /** Shows or hides the axe carried in this character's right hand. A no-op on the placeholder. */
  setHoldingAxe(holding: boolean): void;
  /** Advances the animation mixer. A no-op on the placeholder. */
  update(deltaSeconds: number): void;
  dispose(): void;
}

const CLIP_NAME_BY_STATE: Record<CharacterAnimState, string> = {
  idle: 'Idle_A_Rig_Medium',
  walk: 'Walking_A_Rig_Medium',
  run: 'Running_A_Rig_Medium',
  jump: 'Jump_Idle_Rig_Medium',
};

/** Fade time between two clips - quick enough to feel responsive, soft enough not to pop. */
const CROSSFADE_SECONDS = 0.15;

/** Knight rendered noticeably too large at the pack's own native scale. */
const MODEL_SCALE = 0.6;

/** Where a held item is parented - the pack's own socket bone for the right hand. */
const HAND_BONE_NAME = 'handslot.r';

/**
 * A first attempt at a carried grip, not a measured one: rotate the axe
 * (grounded and upright when it's a pickup) so its handle lies back along
 * the hand rather than sticking straight out, and shift it slightly so the
 * grip - not the butt of the handle the pickup's own origin sits at - is
 * what actually lines up with the hand bone. Tune from how it actually
 * looks once someone can see it, the same way the facing direction did.
 */
const HELD_AXE_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);
const HELD_AXE_OFFSET = new THREE.Vector3(0, -0.12, 0);

const CAPSULE_LENGTH = PLAYER_HEIGHT - PLAYER_RADIUS * 2;

export function createCharacter(color: THREE.ColorRepresentation): Character {
  const template = characterModelTemplate();
  if (template !== undefined) return createAnimatedCharacter(template, color);
  return createPlaceholderCharacter(color);
}

/** The real, rigged character: crossfades between its four named clips as `setAnimationState` asks. */
function createAnimatedCharacter(
  template: AnimatedModel,
  color: THREE.ColorRepresentation,
): Character {
  const instance = instantiateAnimatedModel(template);
  const model = instance.root;

  // Knight's own rig faces the pack's +Z, but this game's convention is
  // yaw 0 = facing -Z (see the placeholder capsule's snout, which is built
  // to that convention directly) - a bare 180 degree mismatch, which is
  // exactly what made it look like it was walking backwards. Corrected on
  // an inner wrapper, not `group` itself: the outer group's own rotation.y
  // is overwritten every frame with the live facing direction, which would
  // instantly undo a correction applied there instead.
  model.rotation.y = Math.PI;
  model.scale.setScalar(MODEL_SCALE);
  const group = new THREE.Group();
  group.add(model);

  // Materials are shared with the template by default - cloned per instance
  // so tinting one player's colour in below never bleeds into another's.
  const materials: THREE.MeshStandardMaterial[] = [];
  const cloned = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const original = Array.isArray(child.material) ? child.material[0] : child.material;
    if (!(original instanceof THREE.MeshStandardMaterial)) return;
    let next = cloned.get(original);
    if (next === undefined) {
      // Material.clone()'s return type isn't narrowed to the subclass it's
      // called on, but at runtime it always is one - `original` was already
      // confirmed to be a MeshStandardMaterial above.
      next = original.clone() as THREE.MeshStandardMaterial;
      cloned.set(original, next);
      materials.push(next);
    }
    child.material = next;
  });
  for (const material of materials) material.color.set(color);

  // A held axe is its own group, parented straight onto the hand bone - a
  // real Object3D in the skeleton - so it moves and rotates with the arm
  // through every animation for free, with no per-frame code needed here.
  // Scaled up to cancel MODEL_SCALE: parented this deep, it would otherwise
  // shrink along with the character, even though it's the same physical axe
  // as the one on the ground.
  let heldAxe: THREE.Group | undefined;
  const handBone = model.getObjectByName(HAND_BONE_NAME);
  const axeParts = itemModelParts('axe');
  if (handBone !== undefined && axeParts !== undefined) {
    heldAxe = new THREE.Group();
    for (const part of axeParts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = true;
      heldAxe.add(mesh);
    }
    heldAxe.rotation.copy(HELD_AXE_ROTATION);
    heldAxe.position.copy(HELD_AXE_OFFSET);
    heldAxe.scale.setScalar(1 / MODEL_SCALE);
    heldAxe.visible = false;
    handBone.add(heldAxe);
  }

  const actionByState = new Map<CharacterAnimState, THREE.AnimationAction>();
  for (const action of instance.actions) {
    const state = (Object.keys(CLIP_NAME_BY_STATE) as CharacterAnimState[]).find(
      (candidate) => CLIP_NAME_BY_STATE[candidate] === action.getClip().name,
    );
    if (state !== undefined) actionByState.set(state, action);
  }

  let current = actionByState.get('idle');
  current?.play();

  return {
    group,
    setColor: (next) => {
      for (const material of materials) material.color.set(next);
    },
    setAnimationState: (state) => {
      const next = actionByState.get(state);
      if (next === undefined || next === current) return;
      next.reset().fadeIn(CROSSFADE_SECONDS).play();
      current?.fadeOut(CROSSFADE_SECONDS);
      current = next;
    },
    setHoldingAxe: (holding) => {
      if (heldAxe !== undefined) heldAxe.visible = holding;
    },
    update: (deltaSeconds) => instance.mixer.update(deltaSeconds),
    dispose: () => {
      instance.mixer.stopAllAction();
      for (const material of materials) material.dispose();
      // Geometry (and the template root it was cloned from) is shared across
      // every character instance, so only the per-instance materials are ours.
    },
  };
}

function createPlaceholderCharacter(color: THREE.ColorRepresentation): Character {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER_RADIUS, CAPSULE_LENGTH, 6, 12),
    material,
  );
  // The simulation puts the player's feet at the position; the capsule is
  // measured from its middle.
  body.position.y = PLAYER_HEIGHT / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const snoutMaterial = new THREE.MeshStandardMaterial({ color: 0x2d2a26, roughness: 0.9 });
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), snoutMaterial);
  snout.rotation.x = -Math.PI / 2;
  // Yaw 0 faces -Z, so the snout points that way too.
  snout.position.set(0, PLAYER_HEIGHT * 0.78, -PLAYER_RADIUS - 0.1);
  snout.castShadow = true;
  group.add(snout);

  return {
    group,
    setColor: (next) => material.color.set(next),
    setAnimationState: () => {},
    setHoldingAxe: () => {},
    update: () => {},
    dispose: () => {
      body.geometry.dispose();
      snout.geometry.dispose();
      material.dispose();
      snoutMaterial.dispose();
    },
  };
}

/** Give every player a recognisable colour, derived from their network id. */
export function colorForPlayer(netId: number): THREE.Color {
  // Spread hues with the golden angle so nearby ids do not look alike.
  const hue = (netId * 0.61803398875) % 1;
  return new THREE.Color().setHSL(hue, 0.45, 0.58);
}
