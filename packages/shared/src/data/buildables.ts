/**
 * The buildable table.
 *
 * What you can place in the world, and what it costs. Content lives in typed
 * data tables, not scattered through code, so a new buildable means a new row
 * here.
 */

import type { RecipeCost } from './recipes';

export type BuildableKindId =
  | 'campfire'
  | 'cabin'
  | 'flowerBed'
  | 'lantern'
  | 'fence'
  | 'gardenPath'
  | 'tent'
  | 'teepee'
  | 'largeCabin'
  | 'guardianTrophy'
  | 'cedarBench'
  | 'timberTable'
  | 'wovenRug'
  | 'fernLantern'
  | 'moonLantern'
  | 'flowerPlanter'
  | 'trailPennant'
  | 'sentinelTrophy'
  | 'fishDisplay'
  | 'goldenFishDisplay';

export interface BuildableKind {
  readonly id: BuildableKindId;
  readonly displayName: string;
  readonly costs: readonly RecipeCost[];
  /**
   * How much room it needs, so two of them - or one and a tree - don't
   * overlap. For something round, its radius. For something long and thin
   * (see `footprintHalfLength`), how far it reaches either side of its line.
   */
  readonly footprintRadius: number;
  /**
   * Present on a long, thin piece like a fence: its footprint is a line this
   * far either side of its middle, along its own length, rather than a circle.
   * Its ends are where another piece of the same kind joins on.
   */
  readonly footprintHalfLength?: number;
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
    displayName: 'Small cabin',
    // Later upgrades draw on supplies carried home over several expeditions.
    costs: [
      { item: 'log', amount: 40 },
      { item: 'stick', amount: 24 },
      { item: 'bone', amount: 8 },
    ],
    footprintRadius: 3,
    isHome: true,
    capPerPlayer: true,
    triangleBudget: 6000,
    placeholderColor: 0x8a6642,
  },
  tent: {
    id: 'tent',
    displayName: 'Tent',
    costs: [{ item: 'stick', amount: 6 }],
    footprintRadius: 2.2,
    isHome: true,
    capPerPlayer: true,
    triangleBudget: 3000,
    placeholderColor: 0xc6a574,
  },
  teepee: {
    id: 'teepee',
    displayName: 'Teepee',
    costs: [
      { item: 'stick', amount: 16 },
      { item: 'log', amount: 12 },
    ],
    footprintRadius: 2.65,
    isHome: true,
    capPerPlayer: true,
    triangleBudget: 3500,
    placeholderColor: 0xdbc6a0,
  },
  largeCabin: {
    id: 'largeCabin',
    displayName: 'Larger cabin',
    costs: [
      { item: 'log', amount: 120 },
      { item: 'stick', amount: 24 },
      { item: 'bone', amount: 20 },
    ],
    footprintRadius: 3.8,
    isHome: true,
    capPerPlayer: true,
    triangleBudget: 9000,
    placeholderColor: 0x9b7046,
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
    // A slot holds ten flowers, split so a single slot's worth can afford
    // either a bed on its own or a bed and a lantern together.
    costs: [{ item: 'flower', amount: 4 }],
    footprintRadius: 0.35,
    isHome: false,
    capPerPlayer: true,
    triangleBudget: 500,
    placeholderColor: 0x3a3226,
  },
  fence: {
    id: 'fence',
    displayName: 'Fence',
    // Cheap per segment on purpose: a single fence post decorates nothing on
    // its own, so the real cost of a fence is however many of these a player
    // places in a row, not this number.
    costs: [{ item: 'log', amount: 2 }],
    // A line from post to post, not a circle: the posts stand 1.4 m apart,
    // and a circle that covered both would keep everything a metre away
    // from the middle of the rails.
    footprintRadius: 0.12,
    footprintHalfLength: 0.7,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 600,
    placeholderColor: 0x9c7a52,
  },
  gardenPath: {
    id: 'gardenPath',
    displayName: 'Garden path',
    // Sticks, the same no-tool-needed resource the flower bed's own flowers
    // are - laying a trail of stones should not need an axe first.
    costs: [{ item: 'stick', amount: 2 }],
    footprintRadius: 0.25,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 150,
    placeholderColor: 0x8f8a7d,
  },
  guardianTrophy: {
    id: 'guardianTrophy',
    displayName: 'Guardian trophy',
    costs: [{ item: 'guardianTrophy', amount: 1 }],
    footprintRadius: 0.45,
    isHome: false,
    capPerPlayer: true,
    triangleBudget: 2000,
    placeholderColor: 0x73995d,
  },
  cedarBench: {
    id: 'cedarBench',
    displayName: 'Cedar bench',
    costs: [
      { item: 'log', amount: 4 },
      { item: 'stick', amount: 2 },
    ],
    footprintRadius: 0.95,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 2000,
    placeholderColor: 0x9b7952,
  },
  timberTable: {
    id: 'timberTable',
    displayName: 'Timber table',
    costs: [
      { item: 'log', amount: 6 },
      { item: 'stick', amount: 4 },
    ],
    footprintRadius: 0.8,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 2000,
    placeholderColor: 0xb19167,
  },
  wovenRug: {
    id: 'wovenRug',
    displayName: 'Woven forest rug',
    costs: [
      { item: 'stick', amount: 4 },
      { item: 'flower', amount: 6 },
    ],
    footprintRadius: 1.05,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 2000,
    placeholderColor: 0x739c7b,
  },
  fernLantern: {
    id: 'fernLantern',
    displayName: 'Fern lantern',
    costs: [
      { item: 'log', amount: 1 },
      { item: 'stick', amount: 2 },
    ],
    footprintRadius: 0.3,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 2000,
    placeholderColor: 0x93bb84,
  },
  moonLantern: {
    id: 'moonLantern',
    displayName: 'Moonlit lantern',
    costs: [
      { item: 'log', amount: 1 },
      { item: 'stick', amount: 2 },
    ],
    footprintRadius: 0.3,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 2000,
    placeholderColor: 0x94bddd,
  },
  flowerPlanter: {
    id: 'flowerPlanter',
    displayName: 'Woodland flower planter',
    costs: [
      { item: 'log', amount: 1 },
      { item: 'flower', amount: 3 },
    ],
    footprintRadius: 0.35,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 2000,
    placeholderColor: 0xc8af78,
  },
  trailPennant: {
    id: 'trailPennant',
    displayName: 'Trail pennant',
    costs: [
      { item: 'stick', amount: 2 },
      { item: 'flower', amount: 2 },
    ],
    footprintRadius: 0.25,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 800,
    placeholderColor: 0x73918b,
  },
  fishDisplay: {
    id: 'fishDisplay',
    displayName: 'Carved fish display',
    costs: [
      { item: 'log', amount: 2 },
      { item: 'stick', amount: 2 },
    ],
    footprintRadius: 0.38,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 2000,
    placeholderColor: 0x9a9772,
  },
  goldenFishDisplay: {
    id: 'goldenFishDisplay',
    displayName: 'Golden collection display',
    costs: [
      { item: 'log', amount: 3 },
      { item: 'flower', amount: 3 },
    ],
    footprintRadius: 0.38,
    isHome: false,
    capPerPlayer: false,
    triangleBudget: 2000,
    placeholderColor: 0xc6a34d,
  },
  sentinelTrophy: {
    id: 'sentinelTrophy',
    displayName: 'Ruin sentinel trophy',
    costs: [{ item: 'sentinelTrophy', amount: 1 }],
    footprintRadius: 0.38,
    isHome: false,
    capPerPlayer: true,
    triangleBudget: 2000,
    placeholderColor: 0x9ea997,
  },
} as const satisfies Record<BuildableKindId, BuildableKind>;

/** A stable order, so a buildable kind can be sent over the wire as a small number. */
export const BUILDABLE_KIND_ORDER: readonly BuildableKindId[] = [
  'campfire',
  'cabin',
  'flowerBed',
  'lantern',
  'fence',
  'gardenPath',
  'tent',
  'teepee',
  'largeCabin',
  'guardianTrophy',
  'cedarBench',
  'timberTable',
  'wovenRug',
  'fernLantern',
  'moonLantern',
  'flowerPlanter',
  'trailPennant',
  'sentinelTrophy',
  'fishDisplay',
  'goldenFishDisplay',
];

export function buildableKindIndex(id: BuildableKindId): number {
  const index = BUILDABLE_KIND_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown buildable kind: ${id}`);
  return index;
}

export function buildableKindFromIndex(index: number): BuildableKindId | null {
  return BUILDABLE_KIND_ORDER[index] ?? null;
}
