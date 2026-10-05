/**
 * What the Craft menu lists (see decision 0096).
 *
 * One list for everything you can make: things twisted or carved by hand, which
 * go into your pack, and pieces you place in the world, which go on the ground.
 * It used to be two menus, and the one you needed was never the one you had
 * opened. Both the panel on screen and the number keys read the list from here,
 * so a key always does what the entry beside its number says.
 */

import {
  BUILDABLE_KINDS,
  BUILDABLE_KIND_ORDER,
  ITEM_KINDS,
  MEAL_BENEFITS,
  RECIPE_ITEMS,
  canCraft,
  combineHomeSupplies,
  countOf,
  fishDisplayLearned,
  fishRecordsFromSaved,
  inventoryFromEntries,
  isHomeKind,
  isIndoorOnlyKind,
  isMealItem,
  knowsHome,
  nextHome,
  recipeFor,
  type BuildableKindId,
  type Inventory,
  type ItemId,
  type Recipe,
} from '@acorn/shared';

import type { HudState } from './store';

/** The kinds of thing the menu is sorted into, in the order the full list shows them. */
export type CraftGroupId = 'tools' | 'food' | 'home' | 'camp' | 'garden' | 'lake' | 'trophies';

/** Which page of the menu is showing: everything together, or one kind of thing. */
export type CraftTabId = 'all' | CraftGroupId;

export const CRAFT_GROUPS: readonly {
  readonly id: CraftGroupId;
  /** The heading over its entries in the full list. */
  readonly heading: string;
  /** The label on its tab. */
  readonly tab: string;
}[] = [
  { id: 'tools', heading: 'Tools', tab: 'Tools' },
  { id: 'food', heading: 'Food', tab: 'Food' },
  { id: 'home', heading: 'Home', tab: 'Home' },
  { id: 'camp', heading: 'Camp & lighting', tab: 'Camp' },
  { id: 'garden', heading: 'Garden & boundaries', tab: 'Yard' },
  { id: 'lake', heading: 'Lake', tab: 'Lake' },
  { id: 'trophies', heading: 'Trophies', tab: 'Trophies' },
];

/** How many entries have a number key: 1 to 9. */
export const CRAFT_HOTKEY_COUNT = 9;

/** What picking an entry does: make it into your pack, or start placing it. */
export type CraftAction =
  | { readonly kind: 'craft'; readonly item: ItemId }
  | { readonly kind: 'build'; readonly buildable: BuildableKindId };

/**
 * Why an entry cannot be picked yet, in the order that is worth saying first:
 * a lock, then something you hold none of, then a pile of materials that is
 * too small, then the things that are not about what you carry at all.
 */
export type CraftStatusId =
  | 'ready'
  | 'locked'
  /** A whole item (a tool or a trophy) the recipe uses up, and none is in the pack. */
  | 'needItem'
  /** Not enough of the materials; some may be there. */
  | 'needMore'
  | 'needBlueprint'
  | 'needRecipe'
  | 'needFire'
  | 'needWorkbench'
  /** Everything it takes is there, but no slot is free for what it makes. */
  | 'packFull';

/** One ingredient the pack falls short of, and how many of it there are. */
export interface CraftShortfall {
  readonly item: ItemId;
  readonly have: number;
}

export interface CraftEntry {
  readonly action: CraftAction;
  readonly group: CraftGroupId;
  /** What to draw the icon from: the item made, or the piece placed. */
  readonly icon: { readonly item: ItemId } | { readonly buildable: BuildableKindId };
  readonly displayName: string;
  readonly costs: Recipe['costs'];
  /** Whether picking it right now would work, going by what the pack holds. */
  readonly ready: boolean;
  /** What is in the way, or 'ready'; `statusLabel` is how the panel says it. */
  readonly status: CraftStatusId;
  readonly statusLabel: string;
  /** The ingredients there are too few of, for the panel to mark. */
  readonly shortfalls: readonly CraftShortfall[];
  /** Not yet learned: it shows, but it cannot be picked. */
  readonly locked: boolean;
  readonly supplyNote?: string;
  readonly benefitNote?: string;
}

/** What the list depends on: everything here already lives in the HUD's own state. */
export type CraftMenuState = Pick<
  HudState,
  | 'carrying'
  | 'discoveriesClaimed'
  | 'nearCampfire'
  | 'nearWorkbench'
  | 'homeKind'
  | 'homeSkills'
  | 'homeStoredSupplies'
  | 'expedition'
  | 'fishRecords'
  | 'home'
>;

/** Which group a thing made by hand belongs to. Rope is for the boat, so it sits with the lake. */
export function recipeGroup(item: ItemId): CraftGroupId {
  if (item === 'rope') return 'lake';
  return isMealItem(item) ? 'food' : 'tools';
}

/** Which group a placed piece belongs to. */
export function buildableGroup(kind: BuildableKindId): CraftGroupId {
  if (isHomeKind(kind)) return 'home';
  if (kind === 'campfire' || kind === 'lantern' || kind === 'fernLantern' || kind === 'moonLantern')
    return 'camp';
  if (kind === 'rowboat') return 'lake';
  if (kind === 'flowerBed' || kind === 'fence' || kind === 'gardenPath' || kind === 'flowerPlanter')
    return 'garden';
  return 'trophies';
}

/** Whether a page lists anything you place, so the home's building boundary is worth showing. */
export function tabListsPlacedPieces(tab: CraftTabId): boolean {
  return tab !== 'tools' && tab !== 'food';
}

/**
 * Whether the player is picking a piece to place right now: the Craft menu is
 * open on a page that lists pieces. The home's building boundary shows then, so
 * what can be placed is clear before the choice is made.
 */
export function choosingPiece(
  state: Pick<HudState, 'craftMenuOpen' | 'journalTab' | 'craftTab'>,
): boolean {
  return (
    state.craftMenuOpen && state.journalTab === 'craft' && tabListsPlacedPieces(state.craftTab)
  );
}

/** The ingredients `supplies` do not cover, with how many of each there are. */
function shortfallsOf(supplies: Inventory, costs: Recipe['costs']): CraftShortfall[] {
  return costs.flatMap((cost) => {
    const have = countOf(supplies, cost.item);
    return have >= cost.amount ? [] : [{ item: cost.item, have }];
  });
}

/**
 * What stops an entry, said as plainly as the panel can. A whole item that is
 * missing (the axe a refined axe is made from, a trophy to mount) is named,
 * because "need more" reads as a pile of materials that is only a little short.
 */
function statusOf(
  shortfalls: readonly CraftShortfall[],
  blocks: readonly CraftStatusId[],
  locked: boolean,
): { status: CraftStatusId; label: string } {
  if (locked) return { status: 'locked', label: STATUS_LABELS.locked };
  const wholeItem = shortfalls.find((short) => ITEM_KINDS[short.item].stackSize === 1);
  if (wholeItem !== undefined) {
    return {
      status: 'needItem',
      label: `Need ${ITEM_KINDS[wholeItem.item].displayName.toLowerCase()}`,
    };
  }
  if (shortfalls.length > 0) return { status: 'needMore', label: STATUS_LABELS.needMore };
  const blocked = blocks[0];
  if (blocked !== undefined) return { status: blocked, label: STATUS_LABELS[blocked] };
  return { status: 'ready', label: STATUS_LABELS.ready };
}

const STATUS_LABELS: Record<CraftStatusId, string> = {
  ready: 'Ready',
  locked: 'Locked',
  needItem: 'Need item',
  needMore: 'Need more',
  needBlueprint: 'Need blueprint',
  needRecipe: 'Recipe unknown',
  needFire: 'Need lit campfire',
  needWorkbench: 'Need workbench',
  packFull: 'Pack full',
};

function craftedEntries(state: CraftMenuState): CraftEntry[] {
  const inventory = inventoryFromEntries(state.carrying);
  return RECIPE_ITEMS.flatMap((item): CraftEntry[] => {
    const recipe = recipeFor(item);
    if (recipe === null) return [];
    const needsDiscovery =
      recipe.discoveryId !== undefined && !(state.discoveriesClaimed & (1 << recipe.discoveryId));
    const needsFire = recipe.station === 'campfire' && state.nearCampfire !== 'lit';
    const needsWorkbench = recipe.station === 'workbench' && !state.nearWorkbench;
    const shortfalls = shortfallsOf(inventory, recipe.costs);
    const blocks: CraftStatusId[] = [];
    if (needsDiscovery) blocks.push('needRecipe');
    if (needsFire) blocks.push('needFire');
    if (needsWorkbench) blocks.push('needWorkbench');
    // Everything is there and nothing else is in the way: the pack is what is full.
    if (blocks.length === 0 && !canCraft(inventory, item, state.discoveriesClaimed))
      blocks.push('packFull');
    const { status, label } = statusOf(shortfalls, blocks, false);
    return [
      {
        action: { kind: 'craft', item },
        group: recipeGroup(item),
        icon: { item },
        displayName: `${ITEM_KINDS[item].displayName}${
          needsDiscovery
            ? ' · discover its recipe'
            : needsFire
              ? ' · lit campfire needed'
              : needsWorkbench
                ? ' · cabin workbench needed'
                : ''
        }`,
        costs: recipe.costs,
        ready: status === 'ready',
        status,
        statusLabel: label,
        shortfalls,
        locked: false,
        benefitNote: isMealItem(item)
          ? `${MEAL_BENEFITS[item]} · 10 active minutes · replaces your previous meal`
          : undefined,
      },
    ];
  });
}

function placedEntries(state: CraftMenuState): CraftEntry[] {
  const inventory = inventoryFromEntries(state.carrying);
  const cosmetics = state.expedition?.cosmetics ?? 0;
  const fishRecords = fishRecordsFromSaved(state.fishRecords);
  return BUILDABLE_KIND_ORDER.flatMap((original): CraftEntry[] => {
    if (isIndoorOnlyKind(original) || (isHomeKind(original) && original !== 'cabin')) return [];
    // The cabin slot is whichever home comes next for you: a first tent, then each upgrade.
    const target = nextHome(state.homeKind);
    if (original === 'cabin' && target === null) return [];
    const kind = original === 'cabin' && target !== null ? target : original;
    const buildable = BUILDABLE_KINDS[kind];
    const home = isHomeKind(kind);
    const pennantLocked = kind === 'trailPennant' && !(cosmetics & 1);
    const fishLocked = !fishDisplayLearned(kind, fishRecords);
    const supplies =
      home && state.homeKind !== null
        ? combineHomeSupplies(inventory, state.homeStoredSupplies)
        : inventory;
    const shortfalls = shortfallsOf(supplies, buildable.costs);
    const needsBlueprint = home && !knowsHome(state.homeSkills, kind);
    const { status, label } = statusOf(
      shortfalls,
      needsBlueprint ? ['needBlueprint'] : [],
      pennantLocked || fishLocked,
    );
    return [
      {
        action: { kind: 'build', buildable: original },
        group: buildableGroup(kind),
        icon: { buildable: kind },
        displayName: `${state.homeKind !== null && home ? 'Upgrade to ' : ''}${buildable.displayName}${
          needsBlueprint ? ' · blueprint needed' : ''
        }`,
        costs: buildable.costs,
        locked: pennantLocked || fishLocked,
        supplyNote:
          home && state.homeKind !== null
            ? 'Uses backpack first, then your private home chest'
            : pennantLocked
              ? 'Complete three outings to learn this recipe'
              : fishLocked
                ? 'Earn this recipe in your fishing collection'
                : undefined,
        ready: status === 'ready',
        status,
        statusLabel: label,
        shortfalls,
      },
    ];
  });
}

/**
 * Everything this player could pick, sorted into its groups: what you make by
 * hand first in each, then what you place.
 *
 * Indoors there is nothing to place - decorating a room has a panel of its own
 * - but crafting still happens there, since the workbench stands inside.
 */
export function craftMenuEntries(state: CraftMenuState): CraftEntry[] {
  const all = [...craftedEntries(state), ...(state.home === null ? placedEntries(state) : [])];
  return CRAFT_GROUPS.flatMap((group) => all.filter((entry) => entry.group === group.id));
}

/** What one page of the menu lists, in the order the number keys count them. */
export function entriesOnTab(entries: readonly CraftEntry[], tab: CraftTabId): CraftEntry[] {
  return tab === 'all' ? [...entries] : entries.filter((entry) => entry.group === tab);
}

/** The pages worth showing: everything, then each group that has something in it. */
export function craftTabs(entries: readonly CraftEntry[]): CraftTabId[] {
  return [
    'all',
    ...CRAFT_GROUPS.map((group) => group.id).filter((id) =>
      entries.some((entry) => entry.group === id),
    ),
  ];
}

/** The tab that really shows: one with nothing left in it (indoors, say) falls back to everything. */
export function shownTab(entries: readonly CraftEntry[], tab: CraftTabId): CraftTabId {
  return craftTabs(entries).includes(tab) ? tab : 'all';
}
