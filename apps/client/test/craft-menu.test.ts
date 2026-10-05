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

  it('gives every entry a name', () => {
    expect(names(craftMenuEntries(OUTSIDE)).every((name) => name.length > 0)).toBe(true);
  });
});
