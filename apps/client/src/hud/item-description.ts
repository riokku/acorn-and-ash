import { ITEM_KINDS } from '../item-catalog';
import {
  blueprintHome,
  isMealItem,
  isDiscardable,
  isGear,
  isWeapon,
  type ItemId,
} from '@acorn/shared';

export { itemDescription } from '../item-catalog';

export function itemUseHint(item: ItemId): string {
  if (isWeapon(item)) return 'Click to equip · drag to pin';
  if (isGear(item)) return 'Right-click to wear · drag onto a slot · Shift+right-click to drop';
  if (blueprintHome(item) !== null) return 'Click to learn · right-click to drop';
  if (isMealItem(item))
    return 'Click to hold · click again to eat · E near a companion shares 2 servings';
  const kind = ITEM_KINDS[item];
  if (!kind.equippable)
    return isDiscardable(item)
      ? 'Crafting and building material · drag to pin · right-click to drop'
      : 'Pack upgrade · always active';
  return kind.restoresHunger !== undefined
    ? 'Click to hold · click again to eat · use a lit fire to cook raw food'
    : 'Click to equip · drag to pin · right-click to drop';
}
