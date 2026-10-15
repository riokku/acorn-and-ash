import {
  ITEM_KINDS as DEFAULT_ITEMS,
  ITEM_ORDER,
  EQUIPMENT_BONUSES as DEFAULT_BONUSES,
  characterStats as baseStats,
  statsWithItem as baseComparison,
  catalogItem,
  catalogBonuses,
  EMPTY_CATALOG,
  parsePublishedCatalog,
  type ItemKind,
  type PublishedCatalog,
  type ItemId,
  type WornGear,
  type GearSlot,
  type EquipmentBonuses,
} from '@acorn/shared';

/** Presentation belongs to this client; shared defaults are never mutated. */
export const ITEM_KINDS: Record<ItemId, ItemKind> = { ...DEFAULT_ITEMS };
export let EQUIPMENT_BONUSES: EquipmentBonuses = DEFAULT_BONUSES;
let published: PublishedCatalog = EMPTY_CATALOG;
export function applyItemCatalog(value: PublishedCatalog): void {
  published = parsePublishedCatalog(value);
  EQUIPMENT_BONUSES = catalogBonuses(published.overrides);
  for (const id of ITEM_ORDER) {
    const view = catalogItem(id, published.overrides);
    ITEM_KINDS[id] = {
      ...DEFAULT_ITEMS[id],
      displayName: view.displayName,
      pluralName: view.pluralName,
    };
  }
}
export function itemDescription(item: ItemId): string {
  const view = catalogItem(item, published.overrides);
  return `${view.description}${view.rarity === 'common' ? '' : ` Rarity: ${view.rarity}.`}`;
}
export function characterStats(
  worn: Readonly<WornGear>,
  held: ItemId | null = worn.mainHand ?? null,
) {
  return baseStats(worn, held, EQUIPMENT_BONUSES);
}
export function statsWithItem(
  worn: Readonly<WornGear>,
  held: ItemId | null,
  item: ItemId,
  slot?: GearSlot | null,
) {
  return baseComparison(worn, held, item, slot, EQUIPMENT_BONUSES);
}
