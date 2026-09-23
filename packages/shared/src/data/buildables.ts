/**
 * The buildable table.
 *
 * What you can place in the world, and what it costs. Content lives in typed
 * data tables, not scattered through code, so a new buildable means a new row
 * here.
 */

import type { RecipeCost } from './recipes';

export type BuildableKindId = 'campfire' | 'cabin' | 'flowerBed' | 'lantern';

export interface BuildableKind {
  readonly id: BuildableKindId;
  readonly displayName: string;
  readonly costs: readonly RecipeCost[];
  /** How much room it needs, so two of them - or one and a tree - don't overlap. */
  readonly footprintRadius: number;
  /**
   * Whether this is the kind of thing a player calls home: where they start
   * next time, instead of the shared clearing spawn or wherever they last
   * stood. A home is always also `capPerPlayer` - a second one would only
   * confuse which is "the" one to come back to.
   */
  readonly isHome: boolean;
  /**
   * Whether a player may only ever have one of these built at once, anywhere
   * in the world. True for a home and for a personal decoration; false for
   * anything communal, like the campfire, that anyone can build any number of.
   */
  readonly capPerPlayer: boolean;
  /** Triangle budget for the art that eventually replaces the placeholder. */
  readonly triangleBudget: number;
  /** Placeholder colour, as 0xRRGGBB. */
  readonly placeholderColor: number;
}

export const BUILDABLE_KINDS = {
  campfire: {
    id: 'campfire',
    displayName: 'Campfire',
    costs: [{ item: 'log', amount: 4 }],
    footprintRadius: 0.6,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 1500,
    placeholderColor: 0x6b4a32,
  },
  cabin: {
    id: 'cabin',
    displayName: 'Cabin',
    // Logs have a maxCarry of 10 - the most a player can ever hold at once -
    // so this is as much as a single trip can possibly pay for, and the most
    // this recipe could ever cost without becoming unbuildable.
    costs: [{ item: 'log', amount: 10 }],
    footprintRadius: 3,
    isHome: true,
    capPerPlayer: true,
    triangleBudget: 6000,
    placeholderColor: 0x8a6642,
  },
  flowerBed: {
    id: 'flowerBed',
    displayName: 'Flower bed',
    costs: [{ item: 'flower', amount: 6 }],
    footprintRadius: 0.55,
    isHome: false,
    capPerPlayer: true,
    triangleBudget: 800,
    placeholderColor: 0x5c4632,
  },
  lantern: {
    id: 'lantern',
    displayName: 'Lantern',
    // A flower's own maxCarry is 10, split so a single trip can afford
    // either a bed on its own or a bed and a lantern together.
    costs: [{ item: 'flower', amount: 4 }],
    footprintRadius: 0.35,
    isHome: false,
    capPerPlayer: true,
    triangleBudget: 500,
    placeholderColor: 0x3a3226,
  },
} as const satisfies Record<BuildableKindId, BuildableKind>;

/** A stable order, so a buildable kind can be sent over the wire as a small number. */
export const BUILDABLE_KIND_ORDER: readonly BuildableKindId[] = [
  'campfire',
  'cabin',
  'flowerBed',
  'lantern',
];

export function buildableKindIndex(id: BuildableKindId): number {
  const index = BUILDABLE_KIND_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown buildable kind: ${id}`);
  return index;
}

export function buildableKindFromIndex(index: number): BuildableKindId | null {
  return BUILDABLE_KIND_ORDER[index] ?? null;
}
