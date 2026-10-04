import { isMealItem, MEAL_BENEFITS } from '@acorn/shared';
import {
  blueprintHome,
  BUILDABLE_KINDS,
  ITEM_KINDS,
  cookedItemFor,
  isDiscardable,
  type ItemId,
} from '@acorn/shared';

const DESCRIPTIONS: Partial<Record<ItemId, string>> = {
  guardianTrophy:
    'Earned by helping defeat the woodland guardian. Place it inside your home area from Build. Kept through a knockout.',
  refinedAxe:
    'Made at a cabin workbench. Chops twice as much per light swing; combat damage stays the same.',
  refinedRod:
    'Made at a cabin workbench. Fish bite 25% sooner; use the same click timing to catch them.',
  berry: 'Forage in woodland glades. Eat fresh or use in trail rations and berry tea.',
  mushroom: 'An edible forest cap. Gather in the grove and cook a filling stew.',
  trailRation: 'A wrapped meal for the trail. Learned at the forgotten camp.',
  forestStew: 'A hearty meal of roasted meat and woodland mushrooms. Learned in the grove.',
  berryTea: 'A fragrant berry infusion. Learned at the mossy shrine.',
  axe: 'Equip to chop trees and fight. Hold left click for a heavy swing.',
  rod: 'Equip beside water to fish. Click when the float goes under.',
  torch: 'Equip for firelight and protection from prowling raccoons at night.',
  log: 'Build a home, a campfire, fences, and garden paths.',
  stick: 'Craft tools and torches, or build a garden lantern.',
  flower: 'Plant a flower bed to brighten your home.',
  bone: 'Left behind by skeletons in the wilderness.',
};

export function itemDescription(item: ItemId): string {
  const home = blueprintHome(item);
  if (home !== null)
    return `Learn to permanently unlock the ${BUILDABLE_KINDS[home].displayName.toLowerCase()} upgrade in this world. Materials are still required.`;
  const kind = ITEM_KINDS[item];
  if (kind.extraSlots !== undefined)
    return `Adds ${kind.extraSlots} pack slots. Your bag stays with you.`;
  if (kind.restoresHunger !== undefined) {
    const cooked = cookedItemFor(item);
    if (isMealItem(item))
      return `${DESCRIPTIONS[item]} Restores ${kind.restoresHunger} hunger. ${MEAL_BENEFITS[item]} for 10 active minutes. Can be eaten at full hunger; replaces your previous meal benefit. Pauses while disconnected.`;
    return `${DESCRIPTIONS[item] === undefined ? '' : `${DESCRIPTIONS[item]} `}Restores ${kind.restoresHunger} hunger. Click to eat.${cooked !== null ? ' Equip beside a lit campfire or home cooker and press E to roast it.' : ''}`;
  }
  return DESCRIPTIONS[item] ?? 'A useful find from the woods.';
}

export function itemUseHint(item: ItemId): string {
  if (blueprintHome(item) !== null) return 'Click to learn · right-click to drop';
  const kind = ITEM_KINDS[item];
  if (!kind.equippable)
    return isDiscardable(item)
      ? 'Crafting and building material · drag to pin · right-click to drop'
      : 'Pack upgrade · always active';
  return kind.restoresHunger !== undefined
    ? 'Click to eat · drag to pin · right-click to drop'
    : 'Click to equip · drag to pin · right-click to drop';
}
