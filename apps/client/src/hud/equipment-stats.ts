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
  if (bonus === undefined) return null;
  const parts: string[] = [];
  if (bonus.power !== undefined) parts.push(`Power +${bonus.power}% when used in your main hand.`);
  if (bonus.protection !== undefined) parts.push(`Protection +${bonus.protection}% while worn.`);
  if (bonus.vitality !== undefined)
    parts.push(`Vitality +${bonus.vitality} maximum health while worn.`);
  return parts.join(' ') || null;
}

export function equipmentComparison(
  item: ItemId,
  worn: Readonly<WornGear>,
  held: ItemId | null,
): string | null {
  if (EQUIPMENT_BONUSES[item] === undefined && gearSlotsOf(item).length === 0) return null;
  const before = characterStats(worn, held);
  const after = statsWithItem(worn, held, item);
  const parts: string[] = [];
  for (const [key, label] of [
    ['power', 'Power'],
    ['protection', 'Protection'],
    ['vitality', 'Vitality'],
  ] as const) {
    const delta = after[key] - before[key];
    const unit = key === 'vitality' ? '' : '%';
    if (delta !== 0)
      parts.push(
        `${label} ${before[key]}${unit} → ${after[key]}${unit} (${delta > 0 ? '+' : ''}${delta}${unit}).`,
      );
  }
  return parts.join(' ') || 'No change to your current equipment stats.';
}
