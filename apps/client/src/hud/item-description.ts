import { ITEM_KINDS, cookedItemFor, isDiscardable, type ItemId } from '@acorn/shared';

const DESCRIPTIONS: Partial<Record<ItemId, string>> = {
  axe: 'Equip to chop trees and fight. Hold left click for a heavy swing.',
  rod: 'Equip beside water to fish. Click when the float goes under.',
  torch: 'Equip for firelight and protection from prowling raccoons at night.',
  log: 'Build a home, a campfire, fences, and garden paths.',
  stick: 'Craft tools and torches, or build a garden lantern.',
  flower: 'Plant a flower bed to brighten your home.',
  bone: 'Left behind by skeletons in the wilderness.',
};

export function itemDescription(item: ItemId): string {
  const kind = ITEM_KINDS[item];
  if (kind.extraSlots !== undefined)
    return `Adds ${kind.extraSlots} pack slots. Your bag stays with you.`;
  if (kind.restoresHunger !== undefined) {
    const cooked = cookedItemFor(item);
    return `Restores ${kind.restoresHunger} hunger. Click to eat.${cooked !== null ? ' Equip beside a lit campfire and press E to roast it.' : ''}`;
  }
  return DESCRIPTIONS[item] ?? 'A useful find from the woods.';
}

export function itemUseHint(item: ItemId): string {
  const kind = ITEM_KINDS[item];
  if (!kind.equippable)
    return isDiscardable(item)
      ? 'Crafting and building material · drag to pin · right-click to drop'
      : 'Pack upgrade · always active';
  return kind.restoresHunger !== undefined
    ? 'Click to eat · drag to pin · right-click to drop'
    : 'Click to equip · drag to pin · right-click to drop';
}
