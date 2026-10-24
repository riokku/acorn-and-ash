import { HEALTH_MAX } from '../constants';
/** Small, deterministic bonuses from equipment. Character appearance has no effect. */
import {
  GEAR_SLOTS,
  canWearIn,
  gearSlotsOf,
  slotToWear,
  type GearSlot,
  type WornGear,
} from './gear';
import { ITEM_KINDS, type ItemId } from './items';

export interface EquipmentBonus {
  /** Added percentage points over the existing attack's base damage. */
  readonly power?: number;
  /** Percentage points of hostile damage reduction while worn. */
  readonly protection?: number;
  /** Extra maximum health points while worn. */
  readonly vitality?: number;
  /** Insulation rating against winter exposure. */
  readonly warmth?: number;
}

export type EquipmentBonuses = Readonly<Partial<Record<ItemId, EquipmentBonus>>>;

/** Fixed bonuses: no levels, random rolls or changes to attack/movement timing. */
export const EQUIPMENT_BONUSES: Readonly<Partial<Record<ItemId, EquipmentBonus>>> = {
  axe: { power: 10 },
  ironSword: { power: 50 },
  rustySword: { power: 25 },
  raiderDagger: { power: 25 },
  raiderGreatsword: { power: 45 },
  boneStaff: { power: 35 },
  watchGreatsword: { power: 55 },

  huntingKnife: { power: 25 },
  refinedAxe: { power: 25 },
  shovel: { power: 5 },
  rod: { power: 5 },
  refinedRod: { power: 10 },
  torch: { power: 5 },
  kingCrown: { protection: 12, vitality: 10, warmth: 20 },
  watchCaptainHelm: { protection: 10, vitality: 5, warmth: 10 },
  knightHelmet: { protection: 8, warmth: 5 },
  bearHat: { protection: 2, vitality: 15, warmth: 25 },
  mageHat: { protection: 1, vitality: 10, warmth: 15 },
  rogueMask: { protection: 1, vitality: 5, warmth: 5 },
  travelerTunic: { protection: 4, vitality: 10, warmth: 10 },
  travelerTrousers: { protection: 3, warmth: 10 },
  leatherBoots: { protection: 2, warmth: 5 },
  leatherGloves: { protection: 2, warmth: 5 },
  woodenShield: { protection: 15 },
  winterJacket: { protection: 4, warmth: 60 },
  woolCap: { protection: 1, warmth: 15 },
  linenShirt: { protection: 2, warmth: 5 },
  workTrousers: { protection: 2, warmth: 10 },
};

export interface CharacterStats {
  /** 100 is the existing damage; 150 means an attack does 50% more damage. */
  readonly power: number;
  /** Percentage of hostile damage prevented; capped at 40%. */
  readonly protection: number;
  /** Maximum health, capped at 150; equipping does not heal. */
  readonly vitality: number;
  /** Winter insulation, capped at 100. Ordinary winter needs 60; blizzards 80. */
  readonly warmth: number;
}

/** `held` is the effective hand item, after the server resolves pack choices. */
export function characterStats(
  worn: Readonly<WornGear>,
  held: ItemId | null = worn.mainHand ?? null,
  bonuses: EquipmentBonuses = EQUIPMENT_BONUSES,
): CharacterStats {
  let protection = 0;
  let vitality = HEALTH_MAX;
  let warmth = 0;
  for (const slot of GEAR_SLOTS) {
    const item = worn[slot];
    if (item !== undefined && canWearIn(item, slot)) {
      protection += bonuses[item]?.protection ?? 0;
      vitality += bonuses[item]?.vitality ?? 0;
      warmth += bonuses[item]?.warmth ?? 0;
    }
  }
  return {
    power: 100 + (held === null ? 0 : (bonuses[held]?.power ?? 0)),
    protection: Math.min(40, protection),
    vitality: Math.min(150, vitality),
    warmth: Math.min(100, warmth),
  };
}

/** Preview the slot the existing right-click/drag action will actually replace. */
export function statsWithItem(
  worn: Readonly<WornGear>,
  held: ItemId | null,
  item: ItemId,
  slot: GearSlot | null = slotToWear(item, worn),
  bonuses: EquipmentBonuses = EQUIPMENT_BONUSES,
): CharacterStats {
  if (slot !== null && gearSlotsOf(item).includes(slot))
    return characterStats({ ...worn, [slot]: item }, slot === 'mainHand' ? item : held, bonuses);
  if (ITEM_KINDS[item].equippable) return characterStats(worn, item, bonuses);
  return characterStats(worn, held, bonuses);
}

/** Protection reduces hostile blows without granting equipment-based immunity. */
export function protectedDamage(amount: number, stats: CharacterStats): number {
  return amount <= 0 ? 0 : Math.max(1, amount * (1 - stats.protection / 100));
}
