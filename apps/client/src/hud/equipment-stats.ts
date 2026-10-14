import {
  EQUIPMENT_BONUSES,
  gearSlotsOf,
  characterStats,
  statsWithItem,
  type ItemId,
  type WornGear,
} from '@acorn/shared';

export function equipmentDetail(item: ItemId): string | null {
  const bonus = EQUIPMENT_BONUSES[item];
  if (bonus?.power === undefined) return null;
  return `Power +${bonus.power}% when used in your main hand.`;
}

export function equipmentComparison(
  item: ItemId,
  worn: Readonly<WornGear>,
  held: ItemId | null,
): string | null {
  if (EQUIPMENT_BONUSES[item] === undefined && !gearSlotsOf(item).includes('mainHand')) return null;
  const before = characterStats(worn, held);
  const after = statsWithItem(worn, held, item);
  const delta = after.power - before.power;
  return delta === 0
    ? 'No change to your current Power.'
    : `Power ${before.power}% → ${after.power}% (${delta > 0 ? '+' : ''}${delta}%).`;
}
