/**
 * The item table.
 *
 * Content lives in typed data tables, not scattered through code, so adding a
 * new thing to carry means adding a row here.
 */

import type { GearSlot } from './gear';

export type ItemId =
  | 'refinedAxe'
  | 'refinedRod'
  | 'axe'
  | 'log'
  | 'rod'
  | 'perch'
  | 'trout'
  | 'goldenCarp'
  | 'stick'
  | 'meat'
  | 'flower'
  | 'bag'
  | 'torch'
  | 'bone'
  | 'roastedPerch'
  | 'roastedTrout'
  | 'roastedGoldenCarp'
  | 'roastedMeat'
  | 'teepeeBlueprint'
  | 'cabinBlueprint'
  | 'largeCabinBlueprint'
  | 'berry'
  | 'mushroom'
  | 'trailRation'
  | 'forestStew'
  | 'berryTea'
  | 'guardianTrophy'
  | 'sentinelTrophy'
  | 'reed'
  | 'rope'
  | 'knightHelmet'
  | 'mageHat'
  | 'bearHat'
  | 'rogueMask'
  | 'travelerTunic'
  | 'travelerTrousers'
  | 'leatherBoots'
  | 'leatherGloves'
  | 'ironSword'
  | 'huntingKnife'
  | 'woodenShield';

export interface ItemKind {
  readonly id: ItemId;
  readonly displayName: string;
  /** What more than one is called: logs, but two trout and not two trouts. */
  readonly pluralName: string;
  /**
   * How many fit in one slot of a player's pack - ten of anything gathered,
   * while a tool takes a whole slot to itself. More than a slot's worth just
   * spills into another slot (see decision 0060).
   */
  readonly stackSize: number;
  /**
   * The most of this one player can ever carry, however much room is left -
   * or undefined for no limit but the pack's own slots. One axe is all
   * anybody needs, so a tool stops at one rather than filling a slot apiece.
   */
  readonly maxCarry: number | undefined;
  /**
   * If this is a pack, how many slots it adds to the ones everybody starts
   * with. A pack never takes up a slot itself: it is what the slots are in.
   */
  readonly extraSlots: number | undefined;
  /** Placeholder colour, as 0xRRGGBB. */
  readonly placeholderColor: number;
  /** How much hunger eating one restores, or undefined if it cannot be eaten. */
  readonly restoresHunger?: number;
  /** Whether a knockout leaves this alone rather than burying half of it. */
  readonly keepOnKnockout: boolean;
  /**
   * Whether this can be the item shown in a player's hand.
   *
   * A tool or something you'd eat makes sense held up; a pile of logs or a
   * bag on your back does not, so this is its own flag rather than inferred
   * from `keepOnKnockout` (true for the bag too, for an unrelated reason) or
   * from being food alone.
   */
  readonly equippable: boolean;
  /**
   * If this is gear, the slots it can be worn in (see `data/gear.ts`). Gear is
   * worn rather than held: it leaves the pack for its slot and changes how a
   * character looks, nothing more.
   */
  readonly gearSlots?: readonly GearSlot[];
}

export const ITEM_KINDS = {
  refinedAxe: {
    id: 'refinedAxe',
    displayName: 'Refined axe',
    pluralName: 'Refined axes',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0xa3b2b0,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: true,
  },
  refinedRod: {
    id: 'refinedRod',
    displayName: 'Refined fishing rod',
    pluralName: 'Refined fishing rods',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x759c8b,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: true,
  },
  axe: {
    id: 'axe',
    displayName: 'Axe',
    pluralName: 'Axes',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x9a7b4f,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: true,
    gearSlots: ['mainHand'],
  },
  log: {
    id: 'log',
    displayName: 'Log',
    pluralName: 'Logs',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x8c6239,
    restoresHunger: undefined,
    keepOnKnockout: false,
    equippable: false,
  },
  rod: {
    id: 'rod',
    displayName: 'Fishing rod',
    pluralName: 'Fishing rods',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0xb89a5e,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: true,
    gearSlots: ['mainHand'],
  },
  perch: {
    id: 'perch',
    displayName: 'Perch',
    pluralName: 'Perch',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x8fa35a,
    restoresHunger: 40,
    keepOnKnockout: false,
    equippable: true,
  },
  trout: {
    id: 'trout',
    displayName: 'Trout',
    pluralName: 'Trout',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xc98f86,
    restoresHunger: 40,
    keepOnKnockout: false,
    equippable: true,
  },
  goldenCarp: {
    id: 'goldenCarp',
    displayName: 'Golden carp',
    pluralName: 'Golden carp',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xe8b53a,
    restoresHunger: 40,
    keepOnKnockout: false,
    equippable: true,
  },
  stick: {
    id: 'stick',
    displayName: 'Stick',
    pluralName: 'Sticks',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xb5895a,
    restoresHunger: undefined,
    keepOnKnockout: false,
    equippable: false,
  },
  meat: {
    id: 'meat',
    displayName: 'Meat',
    pluralName: 'Meat',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xb5573f,
    // A catch takes a real chase, unlike a fish that only takes a click at
    // the right moment, so it is worth a little more than one.
    restoresHunger: 50,
    keepOnKnockout: false,
    equippable: true,
  },
  flower: {
    id: 'flower',
    displayName: 'Flower',
    pluralName: 'Flowers',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xdd5fa8,
    restoresHunger: undefined,
    keepOnKnockout: false,
    equippable: false,
  },
  bag: {
    id: 'bag',
    displayName: 'Bag',
    pluralName: 'Bags',
    stackSize: 1,
    maxCarry: 1,
    // Six slots become ten - see decision 0060.
    extraSlots: 4,
    placeholderColor: 0x5f6b45,
    restoresHunger: undefined,
    // Never lose the four extra slots everything else you carry may be
    // sitting in.
    keepOnKnockout: true,
    equippable: false,
  },
  torch: {
    id: 'torch',
    displayName: 'Torch',
    pluralName: 'Torches',
    // A permanent tool once made, the same as the axe and rod - no fuel to
    // track, matching the campfire's own atmosphere-only fire (see decision
    // 0033).
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x7a5230,
    restoresHunger: undefined,
    // As essential at night as the axe and rod are for gathering, so a
    // knockout leaves it alone the same way.
    keepOnKnockout: true,
    equippable: true,
  },
  bone: {
    id: 'bone',
    displayName: 'Bone',
    pluralName: 'Bones',
    // What a skeleton raider leaves behind once beaten (see decision 0063).
    // Nothing uses it yet: a material waiting for its first recipe.
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xe8e0c8,
    restoresHunger: undefined,
    keepOnKnockout: false,
    equippable: false,
  },
  roastedPerch: {
    id: 'roastedPerch',
    displayName: 'Roasted perch',
    pluralName: 'Roasted perch',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x9a6a43,
    restoresHunger: 60,
    keepOnKnockout: false,
    equippable: true,
  },
  roastedTrout: {
    id: 'roastedTrout',
    displayName: 'Roasted trout',
    pluralName: 'Roasted trout',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xaa6652,
    restoresHunger: 60,
    keepOnKnockout: false,
    equippable: true,
  },
  roastedGoldenCarp: {
    id: 'roastedGoldenCarp',
    displayName: 'Roasted golden carp',
    pluralName: 'Roasted golden carp',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xc58b32,
    restoresHunger: 75,
    keepOnKnockout: false,
    equippable: true,
  },
  roastedMeat: {
    id: 'roastedMeat',
    displayName: 'Roasted meat',
    pluralName: 'Roasted meat',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x874737,
    restoresHunger: 75,
    keepOnKnockout: false,
    equippable: true,
  },
  teepeeBlueprint: {
    id: 'teepeeBlueprint',
    displayName: 'Teepee blueprint',
    pluralName: 'Teepee blueprints',
    stackSize: 1,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x6f8f9a,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
  },
  cabinBlueprint: {
    id: 'cabinBlueprint',
    displayName: 'Small cabin blueprint',
    pluralName: 'Small cabin blueprints',
    stackSize: 1,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x6f8f9a,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
  },
  largeCabinBlueprint: {
    id: 'largeCabinBlueprint',
    displayName: 'Larger cabin blueprint',
    pluralName: 'Larger cabin blueprints',
    stackSize: 1,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x6f8f9a,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
  },
  berry: {
    id: 'berry',
    displayName: 'Forest berries',
    pluralName: 'Forest berries',
    stackSize: 8,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 9261925,
    restoresHunger: 8,
    keepOnKnockout: false,
    equippable: true,
  },
  mushroom: {
    id: 'mushroom',
    displayName: 'Forest mushroom',
    pluralName: 'Forest mushrooms',
    stackSize: 8,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 13213040,
    restoresHunger: 6,
    keepOnKnockout: false,
    equippable: true,
  },
  trailRation: {
    id: 'trailRation',
    displayName: 'Trail ration',
    pluralName: 'Trail rations',
    stackSize: 8,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 11960661,
    restoresHunger: 32,
    keepOnKnockout: false,
    equippable: true,
  },
  forestStew: {
    id: 'forestStew',
    displayName: 'Forest stew',
    pluralName: 'Forest stews',
    stackSize: 8,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 12090186,
    restoresHunger: 42,
    keepOnKnockout: false,
    equippable: true,
  },
  berryTea: {
    id: 'berryTea',
    displayName: 'Berry tea',
    pluralName: 'Berry teas',
    stackSize: 8,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 8412535,
    restoresHunger: 18,
    keepOnKnockout: false,
    equippable: true,
  },
  guardianTrophy: {
    id: 'guardianTrophy',
    displayName: 'Guardian trophy',
    pluralName: 'Guardian trophies',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x8baf6e,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
  },
  sentinelTrophy: {
    id: 'sentinelTrophy',
    displayName: 'Ruin sentinel trophy',
    pluralName: 'Ruin sentinel trophies',
    stackSize: 1,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x9ea997,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
  },
  reed: {
    id: 'reed',
    displayName: 'Reed',
    pluralName: 'Reeds',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0x8a9a4a,
    restoresHunger: undefined,
    keepOnKnockout: false,
    equippable: false,
  },
  rope: {
    id: 'rope',
    displayName: 'Rope',
    pluralName: 'Rope',
    stackSize: 10,
    maxCarry: undefined,
    extraSlots: undefined,
    placeholderColor: 0xc9a46a,
    restoresHunger: undefined,
    keepOnKnockout: false,
    equippable: false,
  },
  knightHelmet: {
    id: 'knightHelmet',
    displayName: "Knight's helmet",
    pluralName: "Knight's helmets",
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x8f9aa5,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['helm'],
  },
  mageHat: {
    id: 'mageHat',
    displayName: "Mage's hat",
    pluralName: "Mage's hats",
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x6a5a9c,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['helm'],
  },
  bearHat: {
    id: 'bearHat',
    displayName: 'Bear hat',
    pluralName: 'Bear hats',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x7a5a3c,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['helm'],
  },
  rogueMask: {
    id: 'rogueMask',
    displayName: "Rogue's mask",
    pluralName: "Rogue's masks",
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x3f4048,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['helm'],
  },
  travelerTunic: {
    id: 'travelerTunic',
    displayName: "Traveler's tunic",
    pluralName: "Traveler's tunics",
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x5f8a55,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['upperBody'],
  },
  travelerTrousers: {
    id: 'travelerTrousers',
    displayName: "Traveler's trousers",
    pluralName: "Traveler's trousers",
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x6b5a45,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['lowerBody'],
  },
  leatherBoots: {
    id: 'leatherBoots',
    displayName: 'Leather boots',
    pluralName: 'Leather boots',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x5a4030,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['feet'],
  },
  leatherGloves: {
    id: 'leatherGloves',
    displayName: 'Leather gloves',
    pluralName: 'Leather gloves',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x7b5a3a,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['hands'],
  },
  ironSword: {
    id: 'ironSword',
    displayName: 'Iron sword',
    pluralName: 'Iron swords',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0xb8c0c8,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['mainHand'],
  },
  huntingKnife: {
    id: 'huntingKnife',
    displayName: 'Hunting knife',
    pluralName: 'Hunting knives',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0xa9b0b6,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['mainHand', 'offHand'],
  },
  woodenShield: {
    id: 'woodenShield',
    displayName: 'Wooden shield',
    pluralName: 'Wooden shields',
    stackSize: 1,
    maxCarry: 1,
    extraSlots: undefined,
    placeholderColor: 0x8a6a3a,
    restoresHunger: undefined,
    keepOnKnockout: true,
    equippable: false,
    gearSlots: ['offHand'],
  },
} as const satisfies Record<ItemId, ItemKind>;

/**
 * A stable order, so an item can be sent over the wire as a small number.
 *
 * Only ever add to the end. Packs are saved by these numbers, so reordering
 * would turn somebody's logs into fish.
 */
export const ITEM_ORDER: readonly ItemId[] = [
  'axe',
  'log',
  'rod',
  'perch',
  'trout',
  'goldenCarp',
  'stick',
  'meat',
  'flower',
  'bag',
  'torch',
  'bone',
  // Only add new ids at the end: these numbers are persisted in saved packs.
  'roastedPerch',
  'roastedTrout',
  'roastedGoldenCarp',
  'roastedMeat',
  'teepeeBlueprint',
  'cabinBlueprint',
  'largeCabinBlueprint',
  'berry',
  'mushroom',
  'trailRation',
  'forestStew',
  'berryTea',
  'guardianTrophy',
  'refinedAxe',
  'refinedRod',
  'sentinelTrophy',
  'reed',
  'rope',
  'knightHelmet',
  'mageHat',
  'bearHat',
  'rogueMask',
  'travelerTunic',
  'travelerTrousers',
  'leatherBoots',
  'leatherGloves',
  'ironSword',
  'huntingKnife',
  'woodenShield',
];

export function itemIndex(id: ItemId): number {
  const index = ITEM_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown item: ${id}`);
  return index;
}

export function itemFromIndex(index: number): ItemId | null {
  return ITEM_ORDER[index] ?? null;
}

/** Whether eating this does anything. */
export function isFood(item: ItemId): boolean {
  return ITEM_KINDS[item].restoresHunger !== undefined;
}

/** Every item that can be eaten, in the wire order. Common fish go first. */
export const FOOD_ITEMS: readonly ItemId[] = ITEM_ORDER.filter(isFood);

/**
 * Tools, in the order a fresh equip should default to - the axe first, since
 * chopping is the more common reason to have a hand free at all.
 */
export const TOOL_ITEMS: readonly ItemId[] = ['refinedAxe', 'axe', 'refinedRod', 'rod'];
export function toolKind(item: ItemId | null): 'axe' | 'rod' | null {
  return item === 'axe' || item === 'refinedAxe'
    ? 'axe'
    : item === 'rod' || item === 'refinedRod'
      ? 'rod'
      : null;
}

/** Whether this is a pack: something that adds slots rather than taking one. */
export function isPack(item: ItemId): boolean {
  return ITEM_KINDS[item].extraSlots !== undefined;
}

/** Every pack there is to find, in the wire order. */
export const PACK_ITEMS: readonly ItemId[] = ITEM_ORDER.filter(isPack);
