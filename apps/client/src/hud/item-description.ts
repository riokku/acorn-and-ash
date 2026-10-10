import { isMealItem, MEAL_BENEFITS } from '@acorn/shared';
import {
  blueprintHome,
  BUILDABLE_KINDS,
  ITEM_KINDS,
  cookedItemFor,
  isDiscardable,
  isGear,
  type ItemId,
} from '@acorn/shared';

const DESCRIPTIONS: Partial<Record<ItemId, string>> = {
  sentinelTrophy:
    'A personal reward for your first ruin sentinel victory. Place this carved crown inside or outside your home. Kept through knockout.',
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
  stone: 'Loose stone from the mountain slopes. Lash three to sticks to make a shovel.',
  ironOre: 'Rusty-red ore from the bare rock high on the mountain. Nothing smelts it yet.',
  shovel:
    'Made from sticks and stone. Equip it, then click to dig a tunnel ahead of you, or hold the click to dig a step down. Not in the home clearing, near water or near buildings.',
  mineSupport:
    'Two posts and a beam cut from logs. Equip it inside a tunnel and click a spot on the floor to prop the roof there. The tunnel must be two metres wide, two tall.',
  clay: 'Soft red clay from low, damp ground. Nothing uses it yet.',
  torch: 'Equip for firelight and protection from prowling raccoons at night.',
  log: 'Build a home, a campfire, fences, and garden paths.',
  stick: 'Craft tools and torches, or build a garden lantern.',
  flower: 'Plant a flower bed to brighten your home.',
  reed: 'Cut from the tall golden mature reeds at the pond and the lake, which return somewhere else along the same shore. Twist three together into a length of rope.',
  rope: 'Twisted from lake reeds. Strong enough to lash a rowboat together.',
  bone: 'Left behind by skeletons in the wilderness.',
  knightHelmet: "A knight's steel helmet. Wear it on your head from the character screen (Z).",
  mageHat: "A tall, pointed mage's hat. Wear it on your head from the character screen (Z).",
  bearHat: 'A shaggy bear-ear hat. Wear it on your head from the character screen (Z).',
  rogueMask: 'A dark mask for a quiet face. Wear it on your head from the character screen (Z).',
  travelerTunic:
    "A plain traveler's tunic. Wear it on your upper body from the character screen (Z).",
  travelerTrousers:
    "Sturdy traveler's trousers. Wear them on your lower body from the character screen (Z).",
  leatherBoots: 'Hard-wearing leather boots. Wear them on your feet from the character screen (Z).',
  leatherGloves: 'Soft leather gloves. Wear them on your hands from the character screen (Z).',
  ironSword: 'An iron sword. Wear it in your main hand and you swing it. Looks only, for now.',
  huntingKnife: 'A short hunting knife. Wear it in either hand; in your main hand you swing it.',
  woodenShield: 'A round wooden shield. Wear it in your off hand from the character screen (Z).',
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
  if (isGear(item)) return 'Right-click to wear · drag onto a slot · Shift+right-click to drop';
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
