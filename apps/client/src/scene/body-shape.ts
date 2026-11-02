import * as THREE from 'three/webgpu';

import type { CharacterId } from '@acorn/shared';

/**
 * The body shapes on the shared skeleton (Rig_Medium): the Adventurers'
 * (skeleton raiders and the like), the players' short, round, faceted dwarves
 * (tools/art/dwarf_bodies.py) and the soft dwarves that are replacing them
 * (tools/art/meshy_body.py: the same legs, a longer chest, so the arms and
 * head sit higher). Same bones, different lengths, so each shape plays moves
 * fitted to it and reaches to different places.
 */
export type BodyShape = 'adventurer' | 'dwarf' | 'softDwarf';

/**
 * A dwarf's skeleton is marked `dwarf` or `softDwarf` when it is exported
 * from Blender.
 */
export function bodyShapeOf(model: THREE.Object3D): BodyShape {
  let shape: BodyShape = 'adventurer';
  model.traverse((child) => {
    if (child.userData.softDwarf === true) shape = 'softDwarf';
    else if (child.userData.dwarf === true && shape === 'adventurer') shape = 'dwarf';
  });
  return shape;
}

/**
 * Where the right hand goes for moves steered by hand rather than played
 * from a clip, in the rig's own space (the model's metres, facing +Z, the
 * right hand out along -X): a mouthful just in front of the mouth, the food
 * between bites, the elbow meanwhile, and the weapon arm held out for a
 * whirlwind.
 */
export interface BodyReach {
  readonly mouthful: THREE.Vector3;
  readonly betweenBites: THREE.Vector3;
  readonly eatingElbow: THREE.Vector3;
  readonly whirlwindHand: THREE.Vector3;
  readonly whirlwindElbow: THREE.Vector3;
}

export const BODY_REACH: Readonly<Record<BodyShape, BodyReach>> = {
  // Measured off the Adventurers' own big heads.
  adventurer: {
    mouthful: new THREE.Vector3(-0.1, 1.36, 0.66),
    betweenBites: new THREE.Vector3(-0.16, 1.26, 0.84),
    eatingElbow: new THREE.Vector3(-0.9, 0.7, 0),
    whirlwindHand: new THREE.Vector3(-1.1, 1.05, 0.08),
    whirlwindElbow: new THREE.Vector3(-0.6, 0.6, -0.35),
  },
  // A dwarf's mouth is at about 0.81 m and 0.22 m forward; its arm is 0.37 m long from a shoulder at 0.27 m out.
  dwarf: {
    mouthful: new THREE.Vector3(-0.05, 0.84, 0.42),
    betweenBites: new THREE.Vector3(-0.12, 0.76, 0.52),
    eatingElbow: new THREE.Vector3(-0.9, 0.45, 0),
    whirlwindHand: new THREE.Vector3(-0.72, 0.66, 0.06),
    whirlwindElbow: new THREE.Vector3(-0.45, 0.4, -0.25),
  },
  // A soft dwarf's mouth is at about 1.05 m and 0.125 m forward; its arm is 0.43 m long from a shoulder at 0.25 m out and 0.86 m up.
  softDwarf: {
    mouthful: new THREE.Vector3(-0.05, 1.08, 0.33),
    betweenBites: new THREE.Vector3(-0.12, 1.0, 0.43),
    eatingElbow: new THREE.Vector3(-0.9, 0.63, 0),
    whirlwindHand: new THREE.Vector3(-0.66, 0.84, 0),
    whirlwindElbow: new THREE.Vector3(-0.43, 0.58, -0.3),
  },
};

/**
 * How big a tool or shield is in the hand, against the same item on the
 * ground. The items were sized for the Adventurers; at full size an axe is
 * nearly as tall as a dwarf and its swing scrapes the ground.
 */
export const HELD_SIZE: Readonly<Record<BodyShape, number>> = {
  adventurer: 1,
  dwarf: 0.75,
  softDwarf: 0.75,
};

/** The beards every dwarf body carries, each its own `<body>_Beard_<style>` piece. */
export type BeardStyle = 'braids' | 'long' | 'full' | 'stache' | 'chops';

/** Each body's own beard, as Chris approved them; none for Bodies 2, 4 and 6. */
export const BODY_BEARD: Readonly<Record<CharacterId, BeardStyle | null>> = {
  knight: 'braids',
  barbarian: null,
  mage: 'long',
  ranger: null,
  rogue: 'full',
  rogueHooded: null,
};

const BEARD_PIECE = /_Beard_([a-z]+)(?:_\d+)?$/;

/** Shows this beard and hides every other one (all of them for null). */
export function showBeard(model: THREE.Object3D, style: BeardStyle | null): void {
  model.traverse((child) => {
    const match = BEARD_PIECE.exec(child.name);
    if (match !== null) child.visible = match[1] === style;
  });
}
