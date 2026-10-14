/** Small, deterministic bonuses from equipment. Character appearance has no effect. */
import { gearSlotsOf, slotToWear, type GearSlot, type WornGear } from './gear';
import { ITEM_KINDS, type ItemId } from './items';

export interface EquipmentBonus {
  /** Added percentage points over the existing attack's base damage. */
  readonly power?: number;
}

/** Fixed bonuses: no levels, random rolls or changes to attack/movement timing. */
export const EQUIPMENT_BONUSES: Readonly<Partial<Record<ItemId, EquipmentBonus>>> = {
  ironSword: { power: 50 },
  huntingKnife: { power: 25 },
  refinedAxe: { power: 25 },
};

export interface CharacterStats {
  /** 100 is the existing damage; 150 means an attack does 50% more damage. */
  readonly power: number;
}

/** `held` is the effective hand item, after the server resolves pack choices. */
export function characterStats(
  _worn: Readonly<WornGear>,
  held: ItemId | null = _worn.mainHand ?? null,
): CharacterStats {
  return { power: 100 + (held === null ? 0 : (EQUIPMENT_BONUSES[held]?.power ?? 0)) };
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
