import { MAX_PACK_SLOTS } from '../sim/inventory';
import { EQUIPMENT_SPECIALTIES } from './equipment-specialties';
import { isMealItem, MEAL_BENEFITS } from '../sim/meals';
import { blueprintHome } from './housing';
import { BUILDABLE_KINDS } from './buildables';
import { ITEM_KINDS, type ItemId } from './items';
import { cookedItemFor } from '../sim/cooking';

const DESCRIPTIONS: Partial<Record<ItemId, string>> = {
  kingsRequiem:
    'An epic greatsword claimed from the Hollow King. Violet soul ribbons coil around cold, luminous steel; motes of the First Bell rise along its blade. Wield it in your main hand. Every recent contributor earns a personal sword on victory. Survives knockout.',
  kingCrown:
    'A royal helm earned by helping defeat the Hollow King at Crownbreaker Hold. Wear it on your head. Kept through a knockout.',
  firstBellRelic:
    'A personal keepsake from the Hollow King. Place the ancient bell at home from Build/Trophies. Kept through a knockout.',
  watchCaptainHelm:
    'The bronze-crested helm of Bonehollow’s fallen watch. Complete The Last Bell of Bonehollow and claim it at your home board. Wear it from the character screen (Z). Kept through knockout.',
  sunreachPennant:
    'Recovered through The Sunreach Survey. Place this ranger pennant at home from Build. Kept through a knockout.',
  lastBellTrophy:
    'A bronze keepsake of The Last Bell of Bonehollow. Claim it at your home board after completing the expedition, then place it inside or outside your home from Build. Kept through knockout.',
  sentinelTrophy:
    'A personal reward for your first ruin sentinel victory. Place this carved crown inside or outside your home. Kept through knockout.',
  guardianTrophy:
    'Earned by helping defeat the woodland guardian. Place it inside your home area from Build. Kept through a knockout.',
  refinedAxe:
    'Made at a cabin workbench. Chops twice as much per light swing and hits harder than a basic axe in combat.',
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
    'Made from sticks and stone. Equip it and press E beside buried treasure to dig it up. Click to dig a tunnel ahead, or hold the click to dig a step down. Terrain digging is restricted in the home clearing, near water and near buildings.',
  mineSupport:
    'Two posts and a beam cut from logs. Equip it inside a tunnel and click a spot on the floor to prop the roof there. The tunnel must be two metres wide, two tall.',
  clay: 'Soft red clay from low, damp ground. Nothing uses it yet.',
  torch: 'Equip for firelight and protection from prowling raccoons at night.',
  log: 'Build a home, a campfire, fences, and garden paths.',
  stick: 'Craft tools and torches, or build a garden lantern.',
  flower: 'Plant a flower bed to brighten your home.',
  reed: 'Cut from the tall golden mature reeds at the pond, lake and along the river, which return somewhere else along the same shore. Twist three together into a length of rope.',
  rope: 'Twisted from lake reeds. Strong enough to lash a rowboat together.',
  bone: 'Left behind by skeletons in the wilderness.',
  woolCap:
    'A simple wool cap found among creature loot. Wear it on your head for a little protection and winter warmth.',
  linenShirt:
    'A plain linen shirt found among creature loot. Wear it on your upper body for light protection and a little warmth.',
  workTrousers:
    'Sturdy work trousers found among creature loot. Wear them on your lower body for light protection and warmth.',
  winterJacket:
    'A padded jacket woven from reeds and rope. Wear it on your upper body to stay warm in winter; add a warm hat for blizzards.',
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
  rustySword:
    'A weathered sword carried by skeleton minions. Equip in your main hand from the character screen.',
  raiderDagger:
    'A quick-looking blade carried by skeleton rogues. Equip in your main hand from the character screen.',
  raiderGreatsword:
    'The broad blade carried by skeleton warriors. Equip in your main hand from the character screen.',
  boneStaff:
    'A glowing staff carried by skeleton mages. Used for melee attacks; it does not cast spells. Equip in your main hand from the character screen.',
  watchGreatsword:
    'The heavy blade carried by ruin sentinels and the Captain of the Last Bell. Equip in your main hand from the character screen.',
  ironSword:
    'An iron sword. Wear it in your main hand and you swing it. Increases the damage of your attacks.',
  huntingKnife: 'A short hunting knife. Wear it in either hand; in your main hand you swing it.',
  woodenShield: 'A round wooden shield. Wear it in your off hand from the character screen (Z).',
};

export function defaultItemDescription(item: ItemId): string {
  const home = blueprintHome(item);
  if (home !== null)
    return `Learn to permanently unlock the ${BUILDABLE_KINDS[home].displayName.toLowerCase()} upgrade in this world. Materials are still required.`;
  const kind = ITEM_KINDS[item];
  if (kind.extraSlots !== undefined)
    return `Each bag adds ${kind.extraSlots} pack slots, up to ${MAX_PACK_SLOTS} total. Bags stay with you.`;
  if (kind.restoresHunger !== undefined) {
    const cooked = cookedItemFor(item);
    if (isMealItem(item))
      return `${DESCRIPTIONS[item]} Restores ${kind.restoresHunger} hunger. ${MEAL_BENEFITS[item]} for 10 active minutes. Can be eaten at full hunger; replaces your previous meal benefit. Pauses while disconnected.`;
    return `${DESCRIPTIONS[item] === undefined ? '' : `${DESCRIPTIONS[item]} `}Restores ${kind.restoresHunger} hunger. Click to eat.${cooked !== null ? ' Equip beside a lit campfire or home cooker and press E to roast it.' : ''}`;
  }
  const description = DESCRIPTIONS[item] ?? 'A useful find from the woods.';
  const specialty = EQUIPMENT_SPECIALTIES[item];
  return specialty ? `${description} ${specialty}` : description;
}
