import * as THREE from 'three/webgpu';
import { plainMaterial } from '../art/materials';

import {
  Gesture,
  ITEM_KINDS,
  isWeapon,
  ITEM_ORDER,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  type CharacterId,
  type ItemId,
  type WornGear,
} from '@acorn/shared';

import { instantiateAnimatedModel, type AnimatedModel, type ModelPart } from './model-loading';
import { characterModelTemplate } from './character-model';
import { TARGET_HEIGHTS, itemModelParts } from './item-models';
import { characterClips, type CharacterClips } from './character-animations';
import { CharacterAnimator, type FishingPose, type Locomotion } from './character-animator';
import type { MoveClip, MovePose, MoveView } from './character-moves';
import { createNameplate, type Nameplate } from './nameplate';
import { createFireGlow, type FireGlow } from './fire-light';
import { createGearVisuals, hideBakedHeadPieces } from './gear-visuals';
import { wornWeapon } from './gear-models';

export type { FishingPose, Locomotion, MoveView };

/** Which way a dodge rolls, as the character sees it. */
export type RollDirection = 'forward' | 'backward' | 'left' | 'right';

/** Everything that decides how a character is drawn this frame. */
export interface CharacterFrame {
  /** What they are in the middle of, with its age in fractional ticks. */
  readonly move: MoveView;
  readonly locomotion: Locomotion;
}

/** Where a sitting or lying body rests, in the same space the character stands in. */
export interface RestSpot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * A character: real modeled art once its own model has loaded (see
 * character-model.ts), or a capsule with a snout so you can tell which way
 * it is facing until then, the same fallback every other placeholder gets
 * before its art arrives. Which of the pack's six a player draws is their
 * own choice from the Home screen.
 */
export interface Character {
  readonly group: THREE.Group;
  setColor(color: THREE.ColorRepresentation): void;
  /** Shows a floating name label above the character's head, or hides it for null. */
  setName(name: string | null): void;
  /**
   * Shows this item in the character's hand, replacing whatever was shown
   * before - or shows nothing for null. A no-op on the placeholder.
   */
  setEquippedItem(item: ItemId | null): void;
  /**
   * Shows what this character is wearing, replacing whatever was shown before
   * (decision 0113). A no-op on the placeholder.
   */
  setGear(worn: Readonly<WornGear>): void;
  /**
   * Something done with the hands, over whatever else is going on: picking
   * up, digging, reaching, eating. `item` is shown in hand while it plays -
   * the fish being eaten - or null to leave the hand as it is.
   */
  playGesture(gesture: Gesture, item: ItemId | null): void;
  /** Where their line is at, or null with no line out. */
  setFishing(pose: FishingPose | null): void;
  /** Where the body settles when they sit or lie down, or null when there is nowhere. */
  setRestSpot(spot: RestSpot | null): void;
  /** Freeze the moment a blow of theirs lands, for a beat. */
  hitStop(seconds: number): void;
  /**
   * Where the far end of whatever is in hand is right now - the axe's head,
   * the rod's tip - in the world, or null with nothing in hand.
   */
  heldTip(into: THREE.Vector3): THREE.Vector3 | null;
  /** Where the hand holding things is right now, in the world. */
  handPosition(into: THREE.Vector3): THREE.Vector3 | null;
  /** Draws this frame. Returns the move's pose, for effects that follow it. */
  update(deltaSeconds: number, frame: CharacterFrame): MovePose | null;
  dispose(): void;
}

/** Every item that can ever be shown in a hand, in the wire's own stable order. */
const HELD_ITEM_IDS: readonly ItemId[] = ITEM_ORDER.filter((id) => ITEM_KINDS[id].equippable);

/** The pieces of gear that are swung from the main hand. */
const GEAR_WEAPON_IDS: readonly ItemId[] = ITEM_ORDER.filter(isWeapon);

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
/** The same socket on the left hand, where a shield hangs. */
const OFF_HAND_BONE_NAME = 'handslotl';

/**
 * The upright carry every long tool started from. Z is the axis that swings
 * a tool between lying flat and standing upright, and X steers which way,
 * around the resulting cone ~30 degrees off vertical, it leans - read off
 * a sweep against a real screenshot of Chris's for the furthest toward the
 * character's own front (see decision 0036 for the full story).
 */
const HELD_AXE_REST_X = 2.8;
const HELD_AXE_REST_Y = Math.PI;
const HELD_AXE_REST_Z = 1.05 + Math.PI;
const UPRIGHT_CARRY = new THREE.Euler(HELD_AXE_REST_X, HELD_AXE_REST_Y, HELD_AXE_REST_Z);
const HELD_AXE_OFFSET = new THREE.Vector3(0, -0.12, 0);

/**
 * Half a turn about a tool's own handle, which runs along its local Y: the
 * axe's blade sticks out along its own -X, so this swaps which way it faces
 * without moving the handle at all.
 */
const ABOUT_THE_HANDLE = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI,
);

/**
 * How far off vertical the upright carry stands with the character standing
 * still - about 30 degrees forward, measured in the moves gallery.
 */
const UPRIGHT_LEAN = Math.PI / 6;

/**
 * How far forward of vertical each long tool is carried, standing still.
 * Upright, walking swung the hand far enough back that the torch's flame
 * went into the character's hair and the rod and axe leaned back over
 * their shoulder (see decision 0062).
 */
const CARRY_LEAN = {
  axe: THREE.MathUtils.degToRad(55),
  rod: THREE.MathUtils.degToRad(45),
  torch: THREE.MathUtils.degToRad(45),
} as const;

/**
 * How far every long tool tips out to the character's right, away from the
 * head: upright, it leaned in a little, and from the camera behind, the
 * helmet hid it.
 */
const CARRY_SPLAY = THREE.MathUtils.degToRad(12);

/**
 * How much the wrist holds a carried tool steady against the arm swinging
 * through a walk or a run, from 0 (none: it swings back with every stride)
 * to 1 (fixed to the body, as stiff as a puppet's).
 */
const WRIST_STEADY = 0.8;

const SIDE_TO_SIDE = new THREE.Vector3(1, 0, 0);
const ALONG_THE_HANDLE = new THREE.Vector3(0, 1, 0);
const TIP_AXIS = new THREE.Vector3(0, 0, 1);
/** A tool's own X, which carried runs ahead of the character and down. */
const SPLAY_AXIS = new THREE.Vector3(1, 0, 0);
const NO_TURN = new THREE.Quaternion();

/** Tipped out to the right by `CARRY_SPLAY`, then turned about the handle by `turn`. */
function splayedAndTurned(turn: THREE.Quaternion): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(SPLAY_AXIS, CARRY_SPLAY).multiply(turn);
}

/**
 * A long tool carried in the hand: the upright carry, tipped about its own
 * Z - which, held upright, runs from one side of the character to the
 * other - to `lean` off vertical in all, out to the right a little, then
 * turned about its handle by `turn`.
 */
function carriedAt(lean: number, turn: THREE.Quaternion): THREE.Euler {
  return new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion()
      .setFromEuler(UPRIGHT_CARRY)
      .multiply(new THREE.Quaternion().setFromAxisAngle(TIP_AXIS, UPRIGHT_LEAN - lean))
      .multiply(splayedAndTurned(turn)),
  );
}

/**
 * The same carry against the body instead of the hand, in the model's own
 * frame (ahead along +Z, up along +Y): a quarter turn about the handle,
 * which is how the upright carry measured standing still, then tipped
 * forward to `lean` about the body's own side-to-side - splayed and turned
 * the same as in the hand.
 */
function steadiedAt(lean: number, turn: THREE.Quaternion): THREE.Quaternion {
  return new THREE.Quaternion()
    .setFromAxisAngle(SIDE_TO_SIDE, lean)
    .multiply(new THREE.Quaternion().setFromAxisAngle(ALONG_THE_HANDLE, -Math.PI / 2))
    .multiply(splayedAndTurned(turn));
}

/**
 * How a held item sits relative to the hand bone: `rotation`/`offset` place
 * it, and everything is scaled by `1 / MODEL_SCALE` to cancel the character's
 * own shrink, the same as the axe's group always was.
 */
interface HeldItemRest {
  readonly rotation: THREE.Euler;
  readonly offset: THREE.Vector3;
}

/**
 * How a held thing sits in the hand two ways: `carry`, walking about or
 * standing, and `use`, mid-swing or fishing, and blended between the two
 * as a move starts and ends (see decision 0056).
 *
 * The animation pack's own moves turn the hand as though a weapon points
 * along the hand's own "up" - straight up with the axe raised overhead,
 * straight ahead as a chop lands - so `use` holds everything that way, a
 * little way up the handle. Carried like that, though, the axe sticks
 * straight out in front, so standing about keeps the upright carry that
 * was matched to Chris's screenshot, leaned further forward.
 */
interface HeldGrips {
  readonly carry: HeldItemRest;
  readonly use: HeldItemRest;
  /**
   * A long tool's carry held against the body rather than the hand, in the
   * model's own frame: the wrist turns toward it as the arms swing with a
   * walk or a run, so the tool doesn't swing back with every stride.
   */
  readonly steady?: THREE.Quaternion;
}

/** A long tool gripped the animation pack's way, a hand's width up from the end of its handle. */
const TOOL_USE_GRIP: HeldItemRest = {
  rotation: new THREE.Euler(0, 0, 0),
  offset: new THREE.Vector3(0, -0.14, 0),
};

/**
 * A long tool's grips, carried `lean` off vertical. Every one shares the
 * same upright carry to start from: they are all long, one-handed tools
 * whose model sits with its base at the local origin (see
 * `loadScaledModel`), gripped by that same base end. `turn` is a turn about
 * the handle, for a tool with a side that has to face the right way.
 */
function longToolGrips(lean: number, turn: THREE.Quaternion): HeldGrips {
  return {
    carry: { rotation: carriedAt(lean, turn), offset: HELD_AXE_OFFSET },
    use: {
      rotation: new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromEuler(TOOL_USE_GRIP.rotation).multiply(turn),
      ),
      offset: TOOL_USE_GRIP.offset,
    },
    steady: steadiedAt(lean, turn),
  };
}

/**
 * The axe its own way round: blade first both carried and swung. Gripped
 * like every other tool, the blade trailed behind every blow - chop, combo
 * and charged strike alike - which measured as the edge pointing against
 * the way the head was travelling at each impact; the same half turn about
 * the handle puts it in front (see decision 0058).
 */
const AXE_GRIPS = longToolGrips(CARRY_LEAN.axe, ABOUT_THE_HANDLE);

/** The shovel only ever comes out to dig, so is never seen carried. */
const SHOVEL_GRIPS = longToolGrips(UPRIGHT_LEAN, NO_TURN);

/**
 * Every food item shares one rest pose too: small enough, and round enough,
 * that a fish or a cut of meat reads fine held at roughly the same angle -
 * unlike an axe or a rod, there is no "wrong end" for a swing to expose.
 */
const FOOD_HELD_REST: HeldItemRest = {
  rotation: new THREE.Euler(0.3, 0, 0.4),
  offset: new THREE.Vector3(0, -0.05, 0.03),
};

/**
 * Swung, a fish or a cut of meat is held by one end and brought round
 * lengthways - a fish's long side lies along its own Z, turned here to
 * point along the hand's up.
 */
const FOOD_USE_GRIP: HeldItemRest = {
  rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
  offset: new THREE.Vector3(0, 0.1, 0),
};
const FOOD_GRIPS: HeldGrips = { carry: FOOD_HELD_REST, use: FOOD_USE_GRIP };

const HELD_ITEM_REST: Partial<Record<ItemId, HeldGrips>> = {
  axe: AXE_GRIPS,
  rod: longToolGrips(CARRY_LEAN.rod, NO_TURN),
  torch: longToolGrips(CARRY_LEAN.torch, NO_TURN),
  perch: FOOD_GRIPS,
  trout: FOOD_GRIPS,
  goldenCarp: FOOD_GRIPS,
  meat: FOOD_GRIPS,
  roastedPerch: FOOD_GRIPS,
  roastedTrout: FOOD_GRIPS,
  roastedGoldenCarp: FOOD_GRIPS,
  roastedMeat: FOOD_GRIPS,
};

/** Warm torchlight - dimmer and closer than the campfire's (see fire-light.ts and campfire.ts). */
const TORCH_LIGHT_COLOR = 0xffa25a;
const TORCH_LIGHT_INTENSITY = 9;
const TORCH_LIGHT_DISTANCE = 6;
/** Near the top of the torch model, in its own local space (see TARGET_HEIGHTS.torch in item-models.ts). */
const TORCH_FLAME_HEIGHT = 0.72;

/**
 * A fish placeholder: one shared body-and-tail shape, tinted per species -
 * nobody has a real fish model yet, so this stands in for perch, trout and
 * golden carp alike the same way a stem and a sphere stand in for a flower.
 */
const FISH_BODY_GEOMETRY = new THREE.SphereGeometry(0.08, 8, 6).scale(0.8, 0.6, 1.6);
const FISH_TAIL_GEOMETRY = new THREE.ConeGeometry(0.07, 0.09, 4)
  .rotateX(Math.PI / 2)
  .scale(0.3, 1, 1)
  .translate(0, 0, 0.16);

function fishHeldParts(color: number, roasted = false): ModelPart[] {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true });
  const parts: ModelPart[] = [
    { geometry: FISH_BODY_GEOMETRY, material },
    { geometry: FISH_TAIL_GEOMETRY, material },
  ];
  if (roasted) {
    const char = new THREE.MeshStandardMaterial({
      color: 0x4a2b20,
      roughness: 0.9,
      flatShading: true,
    });
    for (const z of [-0.045, 0.035]) {
      parts.push({
        geometry: new THREE.BoxGeometry(0.13, 0.012, 0.018).rotateY(0.45).translate(0, 0.055, z),
        material: char,
      });
    }
  }
  return parts;
}

/** A meat placeholder: a rounded chunk with a bone end, the same "two simple shapes" idiom as the fish. */
const MEAT_BODY_GEOMETRY = new THREE.IcosahedronGeometry(0.1, 0);
const MEAT_BONE_GEOMETRY = new THREE.CylinderGeometry(0.02, 0.025, 0.14, 5).translate(0, -0.1, 0);
const MEAT_BONE_COLOR = 0xe8ddc0;

/**
 * Every equippable item's held parts, built once at module scope and shared
 * by every character instance - the same "geometry and material are nobody's
 * to dispose per-instance" arrangement `itemModelParts` already gives the
 * axe. `axe` and `rod` come from their real loaded models instead; both are
 * looked up fresh each time a character is built rather than cached here,
 * since a model that failed to load can still succeed on a later retry.
 */
function forestHeldParts(
  item: 'berry' | 'mushroom' | 'trailRation' | 'forestStew' | 'berryTea',
): ModelPart[] {
  const material = new THREE.MeshStandardMaterial({
    color: ITEM_KINDS[item].placeholderColor,
    roughness: 0.9,
    flatShading: true,
  });
  if (item === 'berry')
    return [-0.035, 0.035].map((x) => ({
      geometry: new THREE.IcosahedronGeometry(0.05, 0).translate(x, 0.06, 0),
      material,
    }));
  if (item === 'mushroom')
    return [
      {
        geometry: new THREE.CylinderGeometry(0.026, 0.035, 0.12, 6).translate(0, 0.06, 0),
        material: new THREE.MeshStandardMaterial({ color: 0xf0ddba, roughness: 1 }),
      },
      { geometry: new THREE.ConeGeometry(0.12, 0.055, 10).translate(0, 0.13, 0), material },
    ];
  if (item === 'trailRation')
    return [{ geometry: new THREE.BoxGeometry(0.2, 0.07, 0.15), material }];
  return [
    { geometry: new THREE.CylinderGeometry(0.12, 0.08, 0.1, 10), material },
    {
      geometry: new THREE.CircleGeometry(0.105, 12).rotateX(-Math.PI / 2).translate(0, 0.051, 0),
      material: new THREE.MeshStandardMaterial({
        color: item === 'forestStew' ? 0xb78b4f : 0x92576d,
        roughness: 0.45,
      }),
    },
  ];
}

const FOOD_HELD_PARTS: Partial<Record<ItemId, ModelPart[]>> = {
  berry: forestHeldParts('berry'),
  mushroom: forestHeldParts('mushroom'),
  trailRation: forestHeldParts('trailRation'),
  forestStew: forestHeldParts('forestStew'),
  berryTea: forestHeldParts('berryTea'),
  perch: fishHeldParts(ITEM_KINDS.perch.placeholderColor),
  trout: fishHeldParts(ITEM_KINDS.trout.placeholderColor),
  goldenCarp: fishHeldParts(ITEM_KINDS.goldenCarp.placeholderColor),
  roastedPerch: fishHeldParts(ITEM_KINDS.roastedPerch.placeholderColor, true),
  roastedTrout: fishHeldParts(ITEM_KINDS.roastedTrout.placeholderColor, true),
  roastedGoldenCarp: fishHeldParts(ITEM_KINDS.roastedGoldenCarp.placeholderColor, true),
  meat: [
    {
      geometry: MEAT_BODY_GEOMETRY,
      material: new THREE.MeshStandardMaterial({
        color: ITEM_KINDS.meat.placeholderColor,
        roughness: 0.8,
        flatShading: true,
      }),
    },
    {
      geometry: MEAT_BONE_GEOMETRY,
      material: new THREE.MeshStandardMaterial({
        color: MEAT_BONE_COLOR,
        roughness: 0.6,
        flatShading: true,
      }),
    },
  ],
  roastedMeat: [
    {
      geometry: MEAT_BODY_GEOMETRY,
      material: new THREE.MeshStandardMaterial({
        color: ITEM_KINDS.roastedMeat.placeholderColor,
        roughness: 0.9,
        flatShading: true,
      }),
    },
    {
      geometry: MEAT_BONE_GEOMETRY,
      material: new THREE.MeshStandardMaterial({
        color: MEAT_BONE_COLOR,
        roughness: 0.6,
        flatShading: true,
      }),
    },
    {
      geometry: new THREE.BoxGeometry(0.16, 0.012, 0.018).rotateZ(0.6).translate(0, 0.06, 0),
      material: new THREE.MeshStandardMaterial({
        color: 0x4a2b20,
        roughness: 0.9,
        flatShading: true,
      }),
    },
  ],
};

/**
 * Anything that can be shown in a hand: what you carry, the shovel that
 * comes out to dig, and a raider's own weapon.
 */
type HeldThing = ItemId | 'shovel' | 'weapon';

/** Something a character always has in hand when nothing else is: a raider's weapon. */
export interface CharacterWeapon {
  /** Its parts, built along +Y from where the hand grips it, at the origin. */
  readonly parts: readonly ModelPart[];
  /** How far up it its far end is, in its own units, for the streak behind a swing. */
  readonly length: number;
}

/** How a character built from a model looks: its colours and anything it is never without. */
export interface CharacterLook {
  /** A colour to tint the whole model, or null to keep its own colours. */
  readonly tint: THREE.ColorRepresentation | null;
  readonly weapon?: CharacterWeapon;
}

/**
 * A raider's weapon, held like the axe: it is swung by the same moves, and
 * a sword's edges run along its own X like the axe's blade, so either edge
 * leads the blow.
 */
const WEAPON_GRIPS = longToolGrips(CARRY_LEAN.axe, NO_TURN);

interface HeldModel {
  readonly group: THREE.Group;
  /** How far along it its far end is - the axe's head, the rod's tip - in its own units. */
  readonly tipHeight: number;
  /** Its two grips (see `HeldGrips`), ready to blend between. */
  readonly carry: THREE.Quaternion;
  readonly use: THREE.Quaternion;
  readonly carryOffset: THREE.Vector3;
  readonly useOffset: THREE.Vector3;
  /** Its carry held against the body (see `HeldGrips`), or null for none. */
  readonly steady: THREE.Quaternion | null;
}

/** This thing's parts to put in a hand, or undefined to leave it showing nothing. */
const REFINED_HELD_PARTS = new Map<ItemId, ModelPart[]>();
function heldItemParts(thing: ItemId | 'shovel'): ModelPart[] | undefined {
  if (thing === 'refinedAxe' || thing === 'refinedRod') {
    const existing = REFINED_HELD_PARTS.get(thing);
    if (existing !== undefined) return existing;
    const base = itemModelParts(thing === 'refinedAxe' ? 'axe' : 'rod');
    if (base === undefined) return undefined;
    const band = new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8).translate(0, 0.27, 0);
    const parts = [
      ...base,
      { geometry: band, material: plainMaterial(0x86aaa0, { roughness: 0.6 }) },
    ];
    REFINED_HELD_PARTS.set(thing, parts);
    return parts;
  }
  if (thing === 'axe' || thing === 'rod' || thing === 'torch' || thing === 'shovel') {
    return itemModelParts(thing);
  }
  return FOOD_HELD_PARTS[thing];
}

/** Where along a held thing its far end is: the full length of a tool, the middle of a fish. */
function tipHeightOf(thing: ItemId | 'shovel'): number {
  if (thing === 'refinedAxe') return TARGET_HEIGHTS.axe;
  if (thing === 'refinedRod') return TARGET_HEIGHTS.rod;
  if (thing === 'axe' || thing === 'rod' || thing === 'torch' || thing === 'shovel') {
    return TARGET_HEIGHTS[thing];
  }
  return 0.08;
}

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

export function createCharacter(
  character: CharacterId,
  color: THREE.ColorRepresentation,
): Character {
  const template = characterModelTemplate(character);
  if (template !== undefined) return createAnimatedCharacter(template, { tint: color });
  return createPlaceholderCharacter(color);
}

/**
 * A character from any model on the same rig as the players' - a skeleton
 * raider - playing every move the same way.
 */
export function createCharacterFromModel(template: AnimatedModel, look: CharacterLook): Character {
  return createAnimatedCharacter(template, look);
}

/**
 * How high above the ground a dodge roll turns about: the middle of a
 * crouched body, so it tumbles over itself rather than about its feet.
 */
const ROLL_PIVOT_HEIGHT = 0.42;
/** How high a roll hops at its top. */
const ROLL_HOP = 0.1;
/**
 * How far a raider twists back to its weapon side, coiled to swing, and how
 * far it leans away, in radians (see `MovePose.coil`).
 */
const COIL_TWIST = -0.42;
const COIL_LEAN = 0.14;

/** The real, rigged character, every move played by its animator (see decision 0056). */
function createAnimatedCharacter(template: AnimatedModel, look: CharacterLook): Character {
  const instance = instantiateAnimatedModel(template);
  const model = instance.root;
  // The template's own four clips only ever stand in until the animation
  // library has loaded: every move comes from there.
  instance.mixer.stopAllAction();

  // Every character in the pack shares Knight's own rig, which faces the
  // pack's +Z - but this game's convention is yaw 0 = facing -Z (see the
  // placeholder capsule's snout, which is built to that convention
  // directly) - a bare 180 degree mismatch, which is exactly what made
  // Knight look like it was walking backwards (see decision 0036).
  // Corrected on an inner wrapper, not `group` itself: the outer group's
  // own rotation.y is overwritten every frame with the live facing
  // direction, which would instantly undo a correction applied there
  // instead.
  model.rotation.y = Math.PI;
  model.scale.setScalar(MODEL_SCALE);
  // group (where they stand) > rest (onto a seat or a mattress) > pivot (a
  // roll tumbles about it) > the model itself.
  const group = new THREE.Group();
  const rest = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = ROLL_PIVOT_HEIGHT;
  model.position.y = -ROLL_PIVOT_HEIGHT;
  pivot.add(model);
  rest.add(pivot);
  group.add(rest);

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
  if (look.tint !== null) for (const material of materials) material.color.set(look.tint);

  // Every item that could ever be equipped gets its own group, parented
  // straight onto the hand bone - a real Object3D in the skeleton - so
  // whichever one is visible moves and rotates with the arm through every
  // animation for free, with no per-frame code needed here. Scaled up to
  // cancel MODEL_SCALE: parented this deep, it would otherwise shrink along
  // with the character, even though it's the same physical item as the one
  // on the ground. All start hidden; at most one shows at a time.
  const heldItems = new Map<HeldThing, HeldModel>();
  // Lives only while a torch is actually part of the rig - `held.visible`
  // already puts its glow out along with the rest of the group whenever
  // some other item is equipped instead.
  let torchGlow: FireGlow | undefined;
  const handBone = model.getObjectByName(HAND_BONE_NAME);
  if (handBone !== undefined) {
    const things: readonly HeldThing[] = [
      ...HELD_ITEM_IDS,
      ...GEAR_WEAPON_IDS,
      'shovel',
      ...(look.weapon === undefined ? [] : ['weapon' as const]),
    ];
    for (const thing of things) {
      const gearWeapon = thing === 'weapon' || thing === 'shovel' ? undefined : wornWeapon(thing);
      const parts =
        thing === 'weapon' ? look.weapon?.parts : (gearWeapon?.parts ?? heldItemParts(thing));
      const grips =
        thing === 'shovel'
          ? SHOVEL_GRIPS
          : thing === 'weapon' || gearWeapon !== undefined
            ? WEAPON_GRIPS
            : HELD_ITEM_REST[
                thing === 'refinedAxe' ? 'axe' : thing === 'refinedRod' ? 'rod' : thing
              ];
      if (parts === undefined || grips === undefined) continue;
      const held = new THREE.Group();
      for (const part of parts) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.castShadow = true;
        held.add(mesh);
      }
      held.rotation.copy(grips.carry.rotation);
      held.position.copy(grips.carry.offset);
      held.scale.setScalar(1 / MODEL_SCALE);
      held.visible = false;
      if (thing === 'torch') {
        torchGlow = createFireGlow(TORCH_LIGHT_COLOR, TORCH_LIGHT_INTENSITY, TORCH_LIGHT_DISTANCE);
        torchGlow.anchor.position.set(0, TORCH_FLAME_HEIGHT, 0);
        held.add(torchGlow.anchor);
      }
      handBone.add(held);
      heldItems.set(thing, {
        group: held,
        tipHeight:
          thing === 'weapon'
            ? (look.weapon?.length ?? 0)
            : (gearWeapon?.length ?? tipHeightOf(thing)),
        carry: new THREE.Quaternion().setFromEuler(grips.carry.rotation),
        use: new THREE.Quaternion().setFromEuler(grips.use.rotation),
        carryOffset: grips.carry.offset,
        useOffset: grips.use.offset,
        steady: grips.steady ?? null,
      });
    }
  }

  // The head pieces baked into the six models give way to whatever is worn.
  hideBakedHeadPieces(model);
  const gear = createGearVisuals(model, model.getObjectByName(OFF_HAND_BONE_NAME), 1 / MODEL_SCALE);

  let equipped: ItemId | null = null;
  /** How long the shovel has left out, digging, in seconds. */
  let digging = 0;
  /** The food being eaten, in hand until the last mouthful has gone. */
  let eating: ItemId | null = null;
  let handsFree = false;
  let restSpot: RestSpot | null = null;
  let animator: CharacterAnimator | null = null;
  /** How far into the using grip whatever is in hand is, from carrying (0) to using (1). */
  let gripBlend = 0;
  let clock = 0;
  const nameplate = attachNameplate(group);

  /** The animator, made once the library has loaded, or null while it is on its way. */
  const animatorFor = (): CharacterAnimator | null => {
    if (animator !== null) return animator;
    const clips: CharacterClips | null = characterClips() ?? fallbackClips(template);
    if (clips === null) return null;
    animator = new CharacterAnimator(model, clips);
    return animator;
  };

  const showHeld = (): void => {
    const bites = animator?.eating ?? null;
    // Eaten a mouthful at a time, and the hand comes back down empty.
    const left = eating !== null && bites !== null ? bites.left : 1;
    const showing: HeldThing | null =
      digging > 0
        ? 'shovel'
        : eating !== null
          ? left > 0
            ? eating
            : null
          : handsFree
            ? null
            : (equipped ?? (look.weapon === undefined ? null : 'weapon'));
    for (const [thing, held] of heldItems) {
      held.group.visible = thing === showing;
      held.group.scale.setScalar((1 / MODEL_SCALE) * (thing === eating ? left : 1));
    }
  };

  const shown = (): HeldModel | undefined => {
    for (const [, held] of heldItems) if (held.group.visible) return held;
    return undefined;
  };

  return {
    group,
    setColor: (next) => {
      for (const material of materials) material.color.set(next);
    },
    setName: nameplate.setName,
    setEquippedItem: (item) => {
      equipped = item;
      showHeld();
    },
    setGear: gear.setWorn,
    playGesture: (gesture, item) => {
      const playing = animatorFor();
      if (playing === null) return;
      playing.playGesture(gesture);
      if (gesture === Gesture.Eat) eating = item;
      if (gesture === Gesture.Dig) digging = GESTURE_DIG_SECONDS;
    },
    setFishing: (pose) => animatorFor()?.setFishing(pose),
    setRestSpot: (spot) => {
      restSpot = spot;
    },
    hitStop: (seconds) => animatorFor()?.hitStop(seconds),
    heldTip: (into) => {
      const held = shown();
      if (held === undefined) return null;
      held.group.updateWorldMatrix(true, false);
      return held.group.localToWorld(into.set(0, held.tipHeight, 0));
    },
    handPosition: (into) => {
      if (handBone === undefined) return null;
      handBone.updateWorldMatrix(true, false);
      return into.setFromMatrixPosition(handBone.matrixWorld);
    },
    update: (deltaSeconds, frame) => {
      clock += deltaSeconds;
      torchGlow?.update(deltaSeconds);
      digging = Math.max(0, digging - deltaSeconds);
      const playing = animatorFor();
      if (playing === null) return null;
      const pose = playing.update(deltaSeconds, frame.move, frame.locomotion);
      handsFree = pose.handsFree;
      const bites = playing.eating;
      if (bites === null) eating = null;
      showHeld();
      // Into the using grip as a move starts, back to carrying as it ends; a
      // shovel is out for nothing but using.
      const target = digging > 0 ? 1 : playing.inUse;
      gripBlend += (target - gripBlend) * (1 - Math.exp(-GRIP_FOLLOW * deltaSeconds));
      const steadying = playing.armSwing * WRIST_STEADY;
      for (const [thing, held] of heldItems) {
        if (!held.group.visible) continue;
        carrying.copy(held.carry);
        if (held.steady !== null && steadying > 0) {
          carrying.slerp(steadyInHand(held.group, held.steady, model), steadying);
        }
        held.group.quaternion.slerpQuaternions(carrying, held.use, gripBlend);
        held.group.position.lerpVectors(held.carryOffset, held.useOffset, gripBlend);
        if (thing === eating && bites !== null) holdToMouth(held.group, model, bites.reach);
      }
      placeBody(pose, frame, group, rest, pivot, restSpot, clock);
      return pose;
    },
    dispose: () => {
      gear.dispose();
      animator?.dispose();
      instance.mixer.stopAllAction();
      for (const material of materials) material.dispose();
      // Geometry (and the template root it was cloned from) is shared across
      // every character instance, so only the per-instance materials are ours.
      nameplate.dispose();
      torchGlow?.dispose();
    },
  };
}

/** How quickly a held thing turns between its two grips, per second. */
const GRIP_FOLLOW = 22;

/** How long a shovel stays out to dig, in seconds. */
const GESTURE_DIG_SECONDS = 1.35;

/** A mouthful held crosswise: a fish's length, along its own Z, turned side to side. */
const MOUTHFUL_TURN = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI / 2,
);
const wantedTurn = new THREE.Quaternion();
const handTurn = new THREE.Quaternion();
const carrying = new THREE.Quaternion();
const steadied = new THREE.Quaternion();

/**
 * A carry held against the body - `steady`, in the model's own frame - as
 * the hand holding `held` is turned right now.
 */
function steadyInHand(
  held: THREE.Object3D,
  steady: THREE.Quaternion,
  model: THREE.Object3D,
): THREE.Quaternion {
  if (held.parent === null) return steadied.copy(steady);
  model.getWorldQuaternion(wantedTurn).multiply(steady);
  held.parent.getWorldQuaternion(handTurn);
  return steadied.copy(handTurn.invert().multiply(wantedTurn));
}

/**
 * Turn food up at the mouth crosswise, centred in the hand - whichever way
 * the hand has turned to get it there - as far as `reach` has brought it.
 */
function holdToMouth(food: THREE.Object3D, model: THREE.Object3D, reach: number): void {
  if (food.parent === null || reach <= 0) return;
  model.getWorldQuaternion(wantedTurn).multiply(MOUTHFUL_TURN);
  food.parent.getWorldQuaternion(handTurn);
  food.quaternion.slerp(handTurn.invert().multiply(wantedTurn), reach);
  food.position.multiplyScalar(1 - reach);
}

/**
 * Move the drawn body for the move under way: onto the seat or mattress
 * while resting, tumbling through a roll, trembling as a charge winds up.
 */
function placeBody(
  pose: MovePose,
  frame: CharacterFrame,
  group: THREE.Group,
  rest: THREE.Group,
  pivot: THREE.Group,
  restSpot: RestSpot | null,
  clock: number,
): void {
  // Onto the seat or the mattress: the rest spot, seen from where they stand.
  if (restSpot !== null && pose.rest > 0) {
    const yaw = group.rotation.y;
    const dx = restSpot.x - group.position.x;
    const dz = restSpot.z - group.position.z;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    // Into the group's own turned frame: the inverse of Three's own turn.
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    // Climbing onto it goes up before it goes across.
    const up = Math.min(1, pose.rest * 1.6);
    rest.position.set(localX * pose.rest, (restSpot.y - group.position.y) * up, localZ * pose.rest);
    rest.rotation.y = shortestTurn(yaw, restSpot.yaw) * pose.rest;
  } else {
    rest.position.set(0, 0, 0);
    rest.rotation.y = 0;
  }

  // A roll: over the head for forward and back, over the shoulder for the sides.
  pivot.rotation.set(0, 0, 0);
  pivot.position.set(0, ROLL_PIVOT_HEIGHT, 0);
  pivot.scale.set(1, 1, 1);
  if (pose.roll !== null) {
    const turn = easeInOut(pose.roll) * Math.PI * 2;
    const arc = Math.sin(pose.roll * Math.PI);
    pivot.rotation.x = frame.move.roll === 'backward' ? turn : -turn;
    pivot.position.y = ROLL_PIVOT_HEIGHT + ROLL_HOP * arc;
    // Tucked up small over the top of the roll.
    const tuck = 1 - 0.22 * arc;
    pivot.scale.set(tuck, tuck, tuck);
  }

  if (pose.aerialTurn !== undefined) {
    const turn = pose.aerialTurn * Math.PI * 2;
    if (pose.somersault) pivot.rotation.x = -turn;
    else pivot.rotation.y = turn;
  }

  // Coiled for a swing: twisted back to the weapon side and leaning away
  // from the blow to come, so it can be seen coming from any side.
  if (pose.coil > 0) {
    pivot.rotation.y += COIL_TWIST * pose.coil;
    pivot.rotation.x += COIL_LEAN * pose.coil;
  }

  // Gathering power: a tremble that builds as the charge does.
  if (pose.charge > 0) {
    const shake = 0.012 * pose.charge * pose.charge;
    pivot.position.x += Math.sin(clock * 53) * shake;
    pivot.position.z += Math.cos(clock * 47) * shake;
  }
}

function shortestTurn(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * The character model's own four clips, under the names the animator knows
 * them by - so walking about still animates if the library failed to load.
 */
function fallbackClips(template: AnimatedModel): CharacterClips | null {
  const names: Record<string, MoveClip> = {
    Idle_A_Rig_Medium: 'idle',
    Walking_A_Rig_Medium: 'walk',
    Running_A_Rig_Medium: 'run',
    Jump_Idle_Rig_Medium: 'jumpAir',
  };
  const whole = new Map<MoveClip, THREE.AnimationClip>();
  for (const clip of template.clips) {
    const name = names[clip.name];
    if (name !== undefined) whole.set(name, clip);
  }
  if (whole.size === 0) return null;
  return { whole, upper: whole, lower: whole };
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
    setEquippedItem: () => {},
    setGear: () => {},
    playGesture: () => {},
    setFishing: () => {},
    setRestSpot: () => {},
    hitStop: () => {},
    heldTip: () => null,
    handPosition: () => null,
    update: () => null,
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
