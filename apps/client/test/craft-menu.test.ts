import { BUILDABLE_KIND_ORDER, RECIPE_ITEMS, fishRecordsFromSaved } from '@acorn/shared';
import { describe, expect, it } from 'vitest';

import {
  CRAFT_GROUPS,
  choosingPiece,
  craftMenuEntries,
  craftTabs,
  entriesOnTab,
  shownTab,
  type CraftMenuState,
} from '../src/hud/craft-menu';

const OUTSIDE: CraftMenuState = {
  carrying: [],
  discoveriesClaimed: 0,
  nearCampfire: null,
  nearWorkbench: false,
  homeKind: null,
  homeSkills: 0,
  homeStoredSupplies: [],
  fishRecords: fishRecordsFromSaved(null),
  home: null,
};

const names = (entries: ReturnType<typeof craftMenuEntries>): string[] =>
  entries.map((entry) => entry.displayName.split(' · ')[0] ?? '');

describe('the Craft menu list', () => {
  it('lists rope, and says it is ready once there are three reeds in the pack', () => {
    const empty = craftMenuEntries(OUTSIDE).find(
      (entry) => entry.action.kind === 'craft' && entry.action.item === 'rope',
    );
    expect(empty?.ready).toBe(false);
    const withReeds = craftMenuEntries({
      ...OUTSIDE,
      carrying: [{ item: 'reed', count: 3 }],
    }).find((entry) => entry.action.kind === 'craft' && entry.action.item === 'rope');
    expect(withReeds?.ready).toBe(true);
    expect(withReeds?.locked).toBe(false);
  });

  it('puts everything you can make and everything you can place in one list outdoors', () => {
    const entries = craftMenuEntries(OUTSIDE);
    const crafted = entries.filter((entry) => entry.action.kind === 'craft');
    expect(crafted).toHaveLength(RECIPE_ITEMS.length);
    // Every placed piece but the indoor-only ones and the later home upgrades is there.
    expect(entries.filter((entry) => entry.action.kind === 'build').length).toBeGreaterThan(5);
    expect(entries.filter((entry) => entry.action.kind === 'build').length).toBeLessThan(
      BUILDABLE_KIND_ORDER.length,
    );
  });

  it('lists only what you make by hand indoors, where decorating has its own panel', () => {
    const entries = craftMenuEntries({
      ...OUTSIDE,
      home: { yours: true, locked: false } as CraftMenuState['home'],
    });
    expect(entries.every((entry) => entry.action.kind === 'craft')).toBe(true);
    expect(entries.length).toBe(RECIPE_ITEMS.length);
  });

  it('keeps each group together, in the order the tabs run', () => {
    const entries = craftMenuEntries(OUTSIDE);
    const order = CRAFT_GROUPS.map((group) => group.id);
    const positions = entries.map((entry) => order.indexOf(entry.group));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('numbers the entries on a page the same way the keys count them', () => {
    const entries = craftMenuEntries(OUTSIDE);
    const tools = entriesOnTab(entries, 'tools');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((entry) => entry.group === 'tools')).toBe(true);
    expect(entriesOnTab(entries, 'all')).toEqual(entries);
  });

  it('only offers tabs that have something in them', () => {
    const outdoors = craftTabs(craftMenuEntries(OUTSIDE));
    expect(outdoors[0]).toBe('all');
    expect(outdoors).toContain('lake');
    const indoors = craftTabs(
      craftMenuEntries({
        ...OUTSIDE,
        home: { yours: true, locked: false } as CraftMenuState['home'],
      }),
    );
    // Nothing placed indoors, so a page for garden fences would only be empty.
    expect(indoors).not.toContain('garden');
  });

  it('falls back to everything when the chosen page has nothing left', () => {
    const indoors = craftMenuEntries({
      ...OUTSIDE,
      home: { yours: true, locked: false } as CraftMenuState['home'],
    });
    expect(shownTab(indoors, 'garden')).toBe('all');
    expect(shownTab(indoors, 'tools')).toBe('tools');
  });

  it('shows the home boundary only while picking from a page that lists pieces', () => {
    const open = { craftMenuOpen: true, journalTab: 'craft' as const };
    expect(choosingPiece({ ...open, craftTab: 'all' })).toBe(true);
    expect(choosingPiece({ ...open, craftTab: 'home' })).toBe(true);
    expect(choosingPiece({ ...open, craftTab: 'tools' })).toBe(false);
    expect(choosingPiece({ ...open, craftTab: 'food' })).toBe(false);
    expect(choosingPiece({ ...open, journalTab: 'fishing', craftTab: 'all' })).toBe(false);
    expect(choosingPiece({ craftMenuOpen: false, journalTab: 'craft', craftTab: 'all' })).toBe(
      false,
    );
  });

  describe('says what is in the way, not just "need more"', () => {
    const craftEntry = (state: CraftMenuState, item: string) =>
      craftMenuEntries(state).find(
        (entry) => entry.action.kind === 'craft' && entry.action.item === item,
      );

    it('names a whole item that is missing, even with all the materials for it', () => {
      const refined = craftEntry(
        {
          ...OUTSIDE,
          nearWorkbench: true,
          carrying: [
            { item: 'log', count: 6 },
            { item: 'bone', count: 4 },
          ],
        },
        'refinedAxe',
      );
      expect(refined?.ready).toBe(false);
      expect(refined?.status).toBe('needItem');
      expect(refined?.statusLabel).toBe('Need axe');
      expect(refined?.shortfalls).toEqual([{ item: 'axe', have: 0 }]);
    });

    it('names the trophy a mounted trophy is made from', () => {
      const trophy = craftMenuEntries({
        ...OUTSIDE,
        carrying: [{ item: 'log', count: 10 }],
      }).find((entry) => entry.costs.some((cost) => cost.item === 'guardianTrophy'));
      expect(trophy?.status).toBe('needItem');
      expect(trophy?.statusLabel).toBe('Need guardian trophy');
    });

    it('keeps "need more" for materials that are only a few short, and counts them', () => {
      const rope = craftEntry({ ...OUTSIDE, carrying: [{ item: 'reed', count: 1 }] }, 'rope');
      expect(rope?.status).toBe('needMore');
      expect(rope?.statusLabel).toBe('Need more');
      expect(rope?.shortfalls).toEqual([{ item: 'reed', have: 1 }]);
    });

    it('says the pack is full when the materials are all there but no slot is left for the result', () => {
      // Twenty logs fill two slots and stay at two after a rod is made from two of them.
      const fullPack = [
        { item: 'log' as const, count: 20 },
        { item: 'flower' as const, count: 1 },
        { item: 'bone' as const, count: 1 },
        { item: 'berry' as const, count: 1 },
        { item: 'mushroom' as const, count: 1 },
      ];
      const rod = craftEntry({ ...OUTSIDE, carrying: fullPack }, 'rod');
      expect(rod?.ready).toBe(false);
      expect(rod?.status).toBe('packFull');
      expect(rod?.statusLabel).toBe('Pack full');
      expect(rod?.shortfalls).toEqual([]);
    });

    it('says "already owned", not "pack full", for a one-of-a-kind item the pack already holds', () => {
      const rod = craftEntry(
        {
          ...OUTSIDE,
          carrying: [
            { item: 'rod' as const, count: 1 },
            { item: 'stick' as const, count: 5 },
          ],
        },
        'rod',
      );
      expect(rod?.ready).toBe(false);
      expect(rod?.status).toBe('alreadyOwned');
      expect(rod?.statusLabel).toBe('Already owned');
    });

    it('lets the materials it uses up free the slot it needs', () => {
      const axe = craftEntry(
        {
          ...OUTSIDE,
          carrying: [
            { item: 'stick', count: 3 },
            { item: 'log', count: 1 },
            { item: 'flower', count: 1 },
            { item: 'bone', count: 1 },
            { item: 'berry', count: 1 },
            { item: 'mushroom', count: 1 },
          ],
        },
        'axe',
      );
      expect(axe?.status).toBe('ready');
    });

    it('says a blueprint is missing once a home upgrade has every material', () => {
      const upgrade = craftMenuEntries({
        ...OUTSIDE,
        homeKind: 'tent',
        carrying: [
          { item: 'stick', count: 16 },
          { item: 'log', count: 12 },
        ],
      }).find((entry) => entry.action.kind === 'build' && entry.action.buildable === 'cabin');
      expect(upgrade?.status).toBe('needBlueprint');
      expect(upgrade?.statusLabel).toBe('Need blueprint');
      expect(upgrade?.shortfalls).toEqual([]);
    });

    it('says which station is missing', () => {
      const rations = craftEntry(
        { ...OUTSIDE, discoveriesClaimed: 1 << 3, carrying: [{ item: 'berry', count: 3 }] },
        'berryTea',
      );
      expect(rations?.status).toBe('needFire');
      expect(rations?.statusLabel).toBe('Need lit campfire');
      const lit = craftEntry(
        {
          ...OUTSIDE,
          nearCampfire: 'lit',
          discoveriesClaimed: 1 << 3,
          carrying: [{ item: 'berry', count: 3 }],
        },
        'berryTea',
      );
      expect(lit?.status).toBe('ready');
    });

    it('calls a recipe you have not learned unknown', () => {
      const stew = craftEntry(
        {
          ...OUTSIDE,
          carrying: [
            { item: 'roastedMeat', count: 1 },
            { item: 'mushroom', count: 3 },
          ],
        },
        'forestStew',
      );
      expect(stew?.status).toBe('needRecipe');
    });
  });

  it('gives every entry a name', () => {
    expect(names(craftMenuEntries(OUTSIDE)).every((name) => name.length > 0)).toBe(true);
  });
});
