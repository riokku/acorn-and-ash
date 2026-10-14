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
}

/** Fixed bonuses: no levels, random rolls or changes to attack/movement timing. */
export const EQUIPMENT_BONUSES: Readonly<Partial<Record<ItemId, EquipmentBonus>>> = {
  ironSword: { power: 50 },
  huntingKnife: { power: 25 },
  refinedAxe: { power: 25 },
  knightHelmet: { protection: 8 },
  bearHat: { vitality: 15 },
  mageHat: { vitality: 10 },
  rogueMask: { vitality: 5 },
  travelerTunic: { protection: 4, vitality: 10 },
  travelerTrousers: { protection: 3 },
  leatherBoots: { protection: 2 },
  leatherGloves: { protection: 2 },
  woodenShield: { protection: 15 },
};

export interface CharacterStats {
  /** 100 is the existing damage; 150 means an attack does 50% more damage. */
  readonly power: number;
  /** Percentage of hostile damage prevented; capped at 40%. */
  readonly protection: number;
  /** Maximum health, capped at 150; equipping does not heal. */
  readonly vitality: number;
}

/** `held` is the effective hand item, after the server resolves pack choices. */
export function characterStats(
  worn: Readonly<WornGear>,
  held: ItemId | null = worn.mainHand ?? null,
): CharacterStats {
  let protection = 0;
  let vitality = HEALTH_MAX;
  for (const slot of GEAR_SLOTS) {
    const item = worn[slot];
    if (item !== undefined && canWearIn(item, slot)) {
      protection += EQUIPMENT_BONUSES[item]?.protection ?? 0;
      vitality += EQUIPMENT_BONUSES[item]?.vitality ?? 0;
    }
  }
  return {
    power: 100 + (held === null ? 0 : (EQUIPMENT_BONUSES[held]?.power ?? 0)),
    protection: Math.min(40, protection),
    vitality: Math.min(150, vitality),
  };
}

/** Preview the slot the existing right-click/drag action will actually replace. */
export function statsWithItem(
  worn: Readonly<WornGear>,
  held: ItemId | null,
  item: ItemId,
  slot: GearSlot | null = slotToWear(item, worn),
): CharacterStats {
  if (slot !== null && gearSlotsOf(item).includes(slot))
    return characterStats({ ...worn, [slot]: item }, slot === 'mainHand' ? item : held);
  if (ITEM_KINDS[item].equippable) return characterStats(worn, item);
  return characterStats(worn, held);
}

/** Protection reduces hostile blows without granting equipment-based immunity. */
export function protectedDamage(amount: number, stats: CharacterStats): number {
  return amount <= 0 ? 0 : Math.max(1, amount * (1 - stats.protection / 100));
}
