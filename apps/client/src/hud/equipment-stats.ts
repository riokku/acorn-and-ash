import { EQUIPMENT_BONUSES, characterStats, statsWithItem } from '../item-catalog';
import {
  activeEquipmentTraits,
  slotToWear,
  isWeapon,
  gearSlotsOf,
  type ItemId,
  type WornGear,
} from '@acorn/shared';

export function equipmentDetail(item: ItemId): string | null {
  const bonus = EQUIPMENT_BONUSES[item];
  if (bonus === undefined) return null;
  const parts: string[] = [];
  if (bonus.power !== undefined)
    parts.push(`Attack power +${bonus.power}% when used in your main hand.`);
  if (bonus.protection !== undefined) parts.push(`Protection +${bonus.protection}% while worn.`);
  if (bonus.vitality !== undefined)
    parts.push(`Vitality +${bonus.vitality} maximum health while worn.`);
  if (bonus.warmth !== undefined) parts.push(`Warmth +${bonus.warmth} while worn.`);
  return parts.join(' ') || null;
}

export function equipmentComparison(
  item: ItemId,
  worn: Readonly<WornGear>,
  held: ItemId | null,
): string | null {
  if (EQUIPMENT_BONUSES[item] === undefined && gearSlotsOf(item).length === 0) return null;
  const before = characterStats(worn, held);
  const after = statsWithItem(worn, held, item, isWeapon(item) ? 'mainHand' : undefined);
  const parts: string[] = [];
  for (const [key, label] of [
    ['power', 'Attack power'],
    ['protection', 'Protection'],
    ['vitality', 'Vitality'],
    ['warmth', 'Warmth'],
  ] as const) {
    const delta = after[key] - before[key];
    const unit = key === 'power' || key === 'protection' ? '%' : '';
    if (delta !== 0)
      parts.push(
        `${label} ${before[key]}${unit} → ${after[key]}${unit} (${delta > 0 ? '+' : ''}${delta}${unit}).`,
      );
  }
  return parts.join(' ') || 'No change to your current equipment stats.';
}

/** Compare the primary equip action, including non-numeric traits that a stat total cannot explain. */
export function equipmentTraitComparison(
  item: ItemId,
  worn: Readonly<WornGear>,
  held: ItemId | null,
): string | null {
  const slot = isWeapon(item) ? 'mainHand' : slotToWear(item, worn);
  const heldTool = slot === null && EQUIPMENT_BONUSES[item]?.power !== undefined;
  if (slot === null && !heldTool) return null;
  const before = activeEquipmentTraits(worn, held);
  const after = activeEquipmentTraits(
    slot === null ? worn : { ...worn, [slot]: item },
    slot === 'mainHand' || heldTool ? item : held,
  );
  const lost = before.filter((old) => !after.some((next) => next.item === old.item));
  const gained = after.filter((next) => !before.some((old) => old.item === next.item));
  const parts = [
    ...gained.map(({ trait }) => `Gain ${trait.name}: ${trait.benefit}`),
    ...lost.map(({ trait }) => `Give up ${trait.name}: ${trait.benefit}`),
  ];
  return parts.length ? parts.join(' ') : null;
}
