import { ITEM_KINDS, type ItemId } from '@acorn/shared';

/**
 * How many of something, in words: "the axe" for something you only ever
 * carry one of, and otherwise the number with the right name for it - "1
 * stick", "3 sticks".
 */
export function amountOf(item: ItemId, count: number): string {
  const kind = ITEM_KINDS[item];
  if (kind.maxCarry === 1 && count === 1) return `the ${kind.displayName.toLowerCase()}`;
  const name = count === 1 ? kind.displayName : kind.pluralName;
  return `${count} ${name.toLowerCase()}`;
}

/** What a toast says: "+3 Sticks", "+1 Axe". */
export function gainedLabel(item: ItemId, count: number): string {
  const kind = ITEM_KINDS[item];
  return `+${count} ${count === 1 ? kind.displayName : kind.pluralName}`;
}
