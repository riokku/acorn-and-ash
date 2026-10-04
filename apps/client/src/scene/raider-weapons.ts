import * as THREE from 'three/webgpu';

import type { RaiderKindId } from '@acorn/shared';

import { plainMaterial } from '../art/materials';
import { ModelBuilder, placed } from '../art/shapes';
import type { CharacterWeapon } from './character';
import type { ModelPart } from './model-loading';

/**
 * What each skeleton fights with. The pack Chris sent has the skeletons but
 * not their weapons, so these are simple shapes standing in until real ones
 * come along (see decision 0063): a rusty sword for the minion, a dagger
 * for the rogue, a greatsword for the warrior and a staff with a glowing
 * orb for the mage, who swings it like the rest.
 *
 * Each is built upright along +Y from where the hand grips it, at the
 * origin, with its edges out along ±X like the axe's blade, so it sits in
 * the hand and leads every swing the way the axe does.
 */

const STEEL = 0xb8c0c8;
const OLD_STEEL = 0x8f979e;
const GRIP = 0x4a3426;
const GUARD = 0x8a6a3a;
const STAFF_WOOD = 0x5b4030;
const ORB = 0xc59bff;

interface BladeShape {
  /** From the grip to the very tip, in metres. */
  readonly length: number;
  /** How long the handle is, from the pommel up to the guard. */
  readonly grip: number;
  /** How wide the blade is across its edges. */
  readonly width: number;
  /** How wide the crossguard is. */
  readonly guard: number;
  readonly steel: number;
}

/** A sword of any size: pommel, grip, crossguard, and a blade tapering to a point. */
function blade(shape: BladeShape): ModelPart[] {
  const steel = plainMaterial(shape.steel, { roughness: 0.35, flatShading: true });
  const grip = plainMaterial(GRIP, { roughness: 0.9, flatShading: true });
  const guard = plainMaterial(GUARD, { roughness: 0.6, flatShading: true });
  const thickness = Math.max(0.012, shape.width * 0.18);
  const bladeStart = shape.grip + 0.03;
  const tipLength = shape.width * 1.2;
  const bladeLength = shape.length - bladeStart - tipLength;
  const builder = new ModelBuilder()
    .add(guard, new THREE.IcosahedronGeometry(0.028, 0), placed(0, -0.04, 0))
    .add(
      grip,
      new THREE.CylinderGeometry(0.018, 0.02, shape.grip + 0.04, 6),
      placed(0, (shape.grip - 0.04) / 2, 0),
    )
    .add(guard, new THREE.BoxGeometry(shape.guard, 0.035, 0.05), placed(0, shape.grip + 0.012, 0))
    .add(
      steel,
      new THREE.BoxGeometry(shape.width, bladeLength, thickness),
      placed(0, bladeStart + bladeLength / 2, 0),
    )
    // The point: a four-sided cone, flattened to the blade's own thickness.
    .add(
      steel,
      new THREE.ConeGeometry(shape.width / Math.SQRT2, tipLength, 4),
      placed(
        0,
        bladeStart + bladeLength + tipLength / 2,
        0,
        { y: Math.PI / 4 },
        {
          x: 1,
          y: 1,
          z: thickness / shape.width,
        },
      ),
    );
  return partsOf(builder);
}

/**
 * The mage's staff: held a little way up, so some of it reaches below the
 * hand, with three prongs at the top cradling a glowing orb.
 */
function staff(): ModelPart[] {
  const wood = plainMaterial(STAFF_WOOD, { roughness: 0.9, flatShading: true });
  const orb = plainMaterial(ORB, { roughness: 0.4, emissive: ORB, emissiveIntensity: 1.6 });
  const below = 0.32;
  const above = 0.88;
  const builder = new ModelBuilder().add(
    wood,
    new THREE.CylinderGeometry(0.024, 0.03, below + above, 6),
    placed(0, (above - below) / 2, 0),
  );
  for (let prong = 0; prong < 3; prong++) {
    const turn = (prong / 3) * Math.PI * 2;
    builder.add(
      wood,
      new THREE.ConeGeometry(0.018, 0.2, 4),
      placed(Math.sin(turn) * 0.05, above + 0.08, Math.cos(turn) * 0.05, {
        x: Math.cos(turn) * 0.35,
        z: -Math.sin(turn) * 0.35,
      }),
    );
  }
  builder.add(orb, new THREE.IcosahedronGeometry(0.065, 1), placed(0, above + 0.1, 0));
  return partsOf(builder);
}

function partsOf(builder: ModelBuilder): ModelPart[] {
  const { group } = builder.build();
  const parts: ModelPart[] = [];
  for (const child of group.children) {
    if (child instanceof THREE.Mesh)
      parts.push({ geometry: child.geometry, material: child.material });
  }
  return parts;
}

/** Each kind's weapon, built once the first time it is asked for and shared by every skeleton of that kind. */
const weapons = new Map<RaiderKindId, CharacterWeapon>();

export function raiderWeapon(kind: RaiderKindId): CharacterWeapon {
  const existing = weapons.get(kind);
  if (existing !== undefined) return existing;
  const weapon = buildWeapon(kind);
  weapons.set(kind, weapon);
  return weapon;
}

function buildWeapon(kind: RaiderKindId): CharacterWeapon {
  switch (kind) {
    case 'minion':
      return {
        parts: blade({ length: 0.78, grip: 0.13, width: 0.07, guard: 0.18, steel: OLD_STEEL }),
        length: 0.78,
      };
    case 'rogue':
      return {
        parts: blade({ length: 0.46, grip: 0.11, width: 0.055, guard: 0.12, steel: STEEL }),
        length: 0.46,
      };
    case 'sentinel':
      return {
        parts: blade({ length: 1.14, grip: 0.22, width: 0.14, guard: 0.35, steel: 0x8ea79c }),
        length: 1.14,
      };
    case 'warrior':
      return {
        parts: blade({ length: 1.05, grip: 0.2, width: 0.1, guard: 0.3, steel: OLD_STEEL }),
        length: 1.05,
      };
    case 'mage':
      return { parts: staff(), length: 1 };
  }
}
