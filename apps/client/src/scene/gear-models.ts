import * as THREE from 'three/webgpu';

import type { ItemId } from '@acorn/shared';

import { plainMaterial } from '../art/materials';
import { ModelBuilder, placed } from '../art/shapes';
import type { ModelPart } from './model-loading';
import { blade, partsOf } from './raider-weapons';

/**
 * Simple stand-ins for the things a character can wear or hold, until the
 * real pieces come out of a Blender session (decision 0113). Each is a few
 * plain shapes in a plain colour, built once and shared by everyone wearing it.
 */

/** A weapon for the hand: its parts built along +Y from the grip, and how long it is. */
export interface WornWeapon {
  readonly parts: readonly ModelPart[];
  readonly length: number;
}

const BRIGHT_STEEL = 0xcfd6dc;
const KNIFE_STEEL = 0xb4bcc4;

const weapons = new Map<ItemId, WornWeapon>();

/** The weapon this piece of gear is, or undefined for anything that is not one. */
export function wornWeapon(item: ItemId): WornWeapon | undefined {
  const existing = weapons.get(item);
  if (existing !== undefined) return existing;
  let built: WornWeapon | undefined;
  if (item === 'ironSword') {
    built = {
      parts: blade({ length: 0.85, grip: 0.13, width: 0.065, guard: 0.2, steel: BRIGHT_STEEL }),
      length: 0.85,
    };
  } else if (item === 'huntingKnife') {
    built = {
      parts: blade({ length: 0.42, grip: 0.1, width: 0.045, guard: 0.1, steel: KNIFE_STEEL }),
      length: 0.42,
    };
  }
  if (built !== undefined) weapons.set(item, built);
  return built;
}

let shieldParts: ModelPart[] | undefined;

/**
 * A round wooden shield with an iron boss, standing on its edge facing +Z with
 * its middle at the origin, ready to hang from the off hand.
 */
export function woodenShieldParts(): ModelPart[] {
  if (shieldParts !== undefined) return shieldParts;
  const wood = plainMaterial(0x8a6a3a, { roughness: 0.85, flatShading: true });
  const rim = plainMaterial(0x5b4030, { roughness: 0.9, flatShading: true });
  const iron = plainMaterial(0x8f979e, { roughness: 0.4, flatShading: true });
  const builder = new ModelBuilder()
    .add(wood, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14), placed(0, 0, 0, { x: Math.PI / 2 }))
    .add(rim, new THREE.TorusGeometry(0.2, 0.018, 5, 14), placed(0, 0, 0.02))
    .add(iron, new THREE.SphereGeometry(0.055, 8, 6), placed(0, 0, 0.04));
  shieldParts = partsOf(builder);
  return shieldParts;
}
