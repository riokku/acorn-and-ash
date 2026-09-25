import * as THREE from 'three/webgpu';

import { PLAYER_HEIGHT, PLAYER_RADIUS } from '@acorn/shared';

import { instantiateAnimatedModel, type AnimatedModel } from './model-loading';
import { characterModelTemplate } from './character-model';
import { itemModelParts } from './item-models';
import { pickAnimationState, type CharacterAnimState } from './character-animation';
import { createNameplate, type Nameplate } from './nameplate';

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
  /** Shows a floating name label above the character's head, or hides it for null. */
  setName(name: string | null): void;
  /** Which of the four named clips should be playing right now. A no-op on the placeholder. */
  setAnimationState(state: CharacterAnimState): void;
  /** Shows or hides the axe carried in this character's right hand. A no-op on the placeholder. */
  setHoldingAxe(holding: boolean): void;
  /** Plays a one-shot swing of the held axe, timed to a chop landing. A no-op on the placeholder. */
  swingAxe(): void;
  /** Advances the animation mixer and any swing in progress. A no-op on the placeholder. */
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

/**
 * Where a held item is parented - the pack's own socket bone for the right
 * hand, named `handslot.r` in the source file. Three.js's GLTFLoader strips
 * dots from every bone name on load (`PropertyBinding` reserves `.` as the
 * separator between a node name and an animated property in a track path),
 * so the live name is `handslotr`, not the file's own `handslot.r` - the rest
 * of the rig is renamed the same way, which is invisible for bones only ever
 * addressed by an animation clip, but broke this direct lookup by name.
 */
const HAND_BONE_NAME = 'handslotr';

/**
 * The carried grip. Z is the axis that swings the axe between lying flat and
 * standing upright - found by sampling the live angle between the axe's
 * handle and straight up in a running browser at a handful of Z values, and
 * confirmed against the axe model's own geometry (the wide blade-shaped
 * vertices cluster at the high end of local Y, the handle shaft down to the
 * low end) so "upright" and "which end is the blade" are both grounded in
 * measurement rather than assumption.
 *
 * The 30 degree angle that first measurement landed on put the axe the
 * right amount off vertical, but with the blade pointing backwards - and
 * the next attempt at fixing that made things worse, not better: adding a
 * half turn to Z alone negates all three components of the direction the
 * handle points, which does not land the same distance off vertical the
 * way the comment here used to claim - it is close to the supplementary
 * angle instead, which is why the axe ended up hanging almost straight
 * down into the ground. A further `Math.PI` on Y corrects for exactly
 * that: applied on top of the Z half turn, it puts the up component back
 * where it was (so the same ~30 degrees off vertical returns) while
 * leaving the forward and sideways components flipped from the original,
 * which is the actual fix - confirmed this time by reading the held axe's
 * real world Y position (comfortably above both the hand and the ground)
 * alongside the angle, not the angle alone.
 *
 * `HELD_AXE_REST_X` steers which way, of everywhere on the resulting cone
 * of directions ~30 degrees off vertical, it actually leans - not a small
 * tilt in isolation the way "20 degrees forward" first suggested, since X
 * here interacts with the Y and Z already in place rather than adding a
 * separate small tilt on top of them. With Y and Z fixed, sweeping X alone
 * traces that whole cone at an almost exactly constant ~29.5 degrees off
 * vertical while the forward/sideways split changes completely, including
 * through the still-too-far-backward lean the first value gave - so this
 * value was found by sampling that sweep directly against a real
 * screenshot Chris sent, and reading off the point that lands furthest
 * toward the character's own front with the least sideways drift, rather
 * than trusting what a plain 20-degree offset from the previous value
 * would visually mean.
 */
const HELD_AXE_REST_X = 2.8;
const HELD_AXE_REST_Y = Math.PI;
const HELD_AXE_REST_Z = 1.05 + Math.PI;
const HELD_AXE_ROTATION = new THREE.Euler(HELD_AXE_REST_X, HELD_AXE_REST_Y, HELD_AXE_REST_Z);
const HELD_AXE_OFFSET = new THREE.Vector3(0, -0.12, 0);

/**
 * A swing with no attack clip to drive it yet: the axe alone sweeps around
 * the same Z axis its resting grip leans on, through vertical and out the
 * other side, then back to rest. `game.ts` calls this when the server
 * confirms a chop landed (`treeHit`) rather than the moment the swing button
 * is pressed, so it never plays for a swing that connected with nothing, and
 * only for a swing that was actually this player's own. Which way that arc
 * reads on screen (a forward chop versus something backwards-looking) is not
 * confirmed - the same visual gap the grip angle had before real numbers
 * replaced the guess, but there is no equivalent number to sample for "which
 * direction looks like chopping". The arm itself stays in whatever
 * locomotion pose it was already in - a real swinging arm needs a clip from
 * the pack this project doesn't have converted yet (see decision 0036).
 */
const SWING_DURATION_SECONDS = 0.25;
const SWING_SWEEP_RADIANS = 1.3;

const CAPSULE_LENGTH = PLAYER_HEIGHT - PLAYER_RADIUS * 2;

/**
 * How far above the top of the collision capsule a nameplate floats.
 *
 * Independent of `MODEL_SCALE`: the capsule height is a gameplay number, not
 * an art one, so this reads the same whether or not the model above it is
 * the animated Knight or the placeholder capsule.
 */
const NAMEPLATE_Y_OFFSET = 0.32;

/** Lazily creates and owns a character's nameplate, shared by both variants below. */
function attachNameplate(group: THREE.Group): Pick<Character, 'setName'> & { dispose(): void } {
  let nameplate: Nameplate | null = null;

  return {
    setName: (name) => {
      if (name === null) {
        if (nameplate !== null) nameplate.sprite.visible = false;
        return;
      }
      if (nameplate === null) {
        nameplate = createNameplate(name);
        nameplate.sprite.position.set(0, PLAYER_HEIGHT + NAMEPLATE_Y_OFFSET, 0);
        group.add(nameplate.sprite);
      }
      nameplate.sprite.visible = true;
      nameplate.setText(name);
    },
    dispose: () => nameplate?.dispose(),
  };
}

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

  // Seconds into the current swing, or null when the axe is at rest - not a
  // boolean, since the sweep below needs to know how far into it to be.
  let swingElapsed: number | null = null;
  const nameplate = attachNameplate(group);

  return {
    group,
    setColor: (next) => {
      for (const material of materials) material.color.set(next);
    },
    setName: nameplate.setName,
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
    swingAxe: () => {
      if (heldAxe !== undefined) swingElapsed = 0;
    },
    update: (deltaSeconds) => {
      instance.mixer.update(deltaSeconds);
      if (heldAxe === undefined || swingElapsed === null) return;
      swingElapsed += deltaSeconds;
      if (swingElapsed >= SWING_DURATION_SECONDS) {
        swingElapsed = null;
        heldAxe.rotation.copy(HELD_AXE_ROTATION);
        return;
      }
      // Out and back on the same half-cycle of a sine wave, so it starts and
      // ends exactly at rest with no pop on either end.
      const progress = swingElapsed / SWING_DURATION_SECONDS;
      const sweep = Math.sin(progress * Math.PI) * SWING_SWEEP_RADIANS;
      heldAxe.rotation.set(HELD_AXE_ROTATION.x, HELD_AXE_ROTATION.y, HELD_AXE_REST_Z + sweep);
    },
    dispose: () => {
      instance.mixer.stopAllAction();
      for (const material of materials) material.dispose();
      // Geometry (and the template root it was cloned from) is shared across
      // every character instance, so only the per-instance materials are ours.
      nameplate.dispose();
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

  const nameplate = attachNameplate(group);

  return {
    group,
    setColor: (next) => material.color.set(next),
    setName: nameplate.setName,
    setAnimationState: () => {},
    setHoldingAxe: () => {},
    swingAxe: () => {},
    update: () => {},
    dispose: () => {
      body.geometry.dispose();
      snout.geometry.dispose();
      material.dispose();
      snoutMaterial.dispose();
      nameplate.dispose();
    },
  };
}

/** Give every player a recognisable colour, derived from their network id. */
export function colorForPlayer(netId: number): THREE.Color {
  // Spread hues with the golden angle so nearby ids do not look alike.
  const hue = (netId * 0.61803398875) % 1;
  return new THREE.Color().setHSL(hue, 0.45, 0.58);
}
