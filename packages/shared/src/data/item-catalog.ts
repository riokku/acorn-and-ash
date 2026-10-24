import { EQUIPMENT_BONUSES, type EquipmentBonus, type EquipmentBonuses } from './equipment-stats';
import { gearSlotsOf } from './gear';
import { defaultItemDescription } from './item-description';
import { ITEM_KINDS, ITEM_ORDER, type ItemId } from './items';

export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];
export interface CatalogItem {
  readonly displayName: string;
  readonly pluralName: string;
  readonly description: string;
  readonly rarity: ItemRarity;
  readonly bonuses: EquipmentBonus;
}
export type ItemOverrides = Partial<Record<ItemId, Partial<CatalogItem>>>;
export interface PublishedCatalog {
  readonly revision: number;
  readonly overrides: ItemOverrides;
}
export interface CatalogState {
  readonly draft: PublishedCatalog;
  readonly published: PublishedCatalog;
  readonly history: readonly { revision: number; publishedAt: string; changedItems: number }[];
}
export const EMPTY_CATALOG: PublishedCatalog = { revision: 0, overrides: {} };
export const BONUS_LIMITS = { power: 200, protection: 40, vitality: 50, warmth: 100 } as const;
export function allowedBonuses(item: ItemId): (keyof EquipmentBonus)[] {
  const slots = gearSlotsOf(item);
  const combat = EQUIPMENT_BONUSES[item]?.power !== undefined;
  return [
    ...(combat ? ['power' as const] : []),
    ...(slots.some((s) => s !== 'mainHand')
      ? ['protection' as const, 'vitality' as const, 'warmth' as const]
      : []),
  ];
}
export function catalogItem(item: ItemId, overrides: ItemOverrides = {}): CatalogItem {
  const kind = ITEM_KINDS[item];
  return {
    displayName: kind.displayName,
    pluralName: kind.pluralName,
    description: defaultItemDescription(item),
    rarity:
      item === 'kingCrown' || item === 'firstBellRelic' || item === 'kingsRequiem'
        ? 'epic'
        : item === 'watchCaptainHelm'
          ? 'rare'
          : 'common',
    bonuses: EQUIPMENT_BONUSES[item] ?? {},
    ...overrides[item],
  };
}
export function catalogBonuses(overrides: ItemOverrides): EquipmentBonuses {
  return Object.fromEntries(ITEM_ORDER.map((item) => [item, catalogItem(item, overrides).bonuses]));
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Validate every boundary, including records read from persistent storage. No mechanics/IDs are editable. */
export function parseItemOverrides(value: unknown): ItemOverrides {
  if (!record(value)) throw new Error('Expected an item catalogue');
  const result: ItemOverrides = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!ITEM_ORDER.includes(id as ItemId) || !record(raw)) throw new Error('Unknown item');
    const item = id as ItemId;
    const edit: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(raw)) {
      if (['displayName', 'pluralName', 'description'].includes(key)) {
        const max = key === 'description' ? 1000 : 80;
        if (
          typeof field !== 'string' ||
          !field.trim() ||
          field.length > max ||
          [...field].some((char) => {
            const code = char.codePointAt(0)!;
            return code < 32 && code !== 9 && code !== 10 && code !== 13;
          })
        )
          throw new Error(`Invalid ${key}`);
        edit[key] = field.trim();
      } else if (key === 'rarity') {
        if (!ITEM_RARITIES.includes(field as ItemRarity)) throw new Error('Invalid rarity');
        edit[key] = field;
      } else if (key === 'bonuses') {
        if (!record(field)) throw new Error('Invalid bonuses');
        const bonus: Record<string, number> = {};
        for (const [stat, amount] of Object.entries(field)) {
          if (
            !allowedBonuses(item).includes(stat as keyof EquipmentBonus) ||
            typeof amount !== 'number' ||
            !Number.isInteger(amount) ||
            amount < 0 ||
            amount > BONUS_LIMITS[stat as keyof EquipmentBonus]
          )
            throw new Error(`Invalid ${stat} bonus`);
          bonus[stat] = amount;
        }
        edit[key] = bonus;
      } else throw new Error('This item property cannot be edited');
    }
    if (Object.keys(edit).length) result[item] = edit;
  }
  return result;
}
export function parsePublishedCatalog(value: unknown): PublishedCatalog {
  if (!record(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0)
    throw new Error('Invalid catalogue revision');
  return { revision: value.revision as number, overrides: parseItemOverrides(value.overrides) };
}
