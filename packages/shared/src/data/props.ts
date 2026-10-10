/**
 * The scenery table.
 *
 * Content lives in typed data tables, not scattered through code, so that adding
 * a new tree means adding a row here. Phase 0 draws every one of these as a
 * placeholder shape; art replaces them once the mechanic around them is fun.
 */

export type PropFamily = 'tree' | 'rock' | 'stump';

export interface TreeShape {
  readonly family: 'tree';
  readonly trunkRadius: number;
  readonly trunkHeight: number;
  readonly canopyRadius: number;
  readonly canopyHeight: number;
}

export interface RockShape {
  readonly family: 'rock';
  readonly radius: number;
  readonly height: number;
}

/** What a tree leaves behind. Also where the first axe is waiting. */
export interface StumpShape {
  readonly family: 'stump';
  readonly radius: number;
  readonly height: number;
}

/**
 * How a tree comes down. Only trees have one.
 *
 * Bigger trees take more swings and give more wood, so choosing what to chop
 * means something even before there is anything to build with it.
 */
export interface ChoppingRule {
  /** Swings with an axe before it falls. */
  readonly swingsToFell: number;
  /** Logs it gives when it does. */
  readonly logs: number;
}

export interface PropKind {
  readonly id: PropKindId;
  readonly displayName: string;
  readonly shape: TreeShape | RockShape | StumpShape;
  /** Present on trees, absent on everything else. */
  readonly chopping?: ChoppingRule;
  /** Trees only: turns colour in autumn and stands bare in winter. */
  readonly deciduous?: true;
  /** What the player bumps into, as a radius in metres. */
  readonly colliderRadius: number;
  /** Triangle budget for the art that eventually replaces the placeholder. */
  readonly triangleBudget: number;
  /** Placeholder colour, as 0xRRGGBB. */
  readonly placeholderColor: number;
}

export type PropKindId =
  'pine' | 'birch' | 'oak' | 'boulder' | 'mossyRock' | 'stump' | 'maple' | 'alder';

export const PROP_KINDS = {
  pine: {
    id: 'pine',
    displayName: 'Douglas-fir',
    shape: {
      family: 'tree',
      trunkRadius: 0.3,
      trunkHeight: 3.8,
      canopyRadius: 2.6,
      canopyHeight: 10.2,
    },
    chopping: { swingsToFell: 4, logs: 3 },
    colliderRadius: 0.5,
    triangleBudget: 4000,
    placeholderColor: 0x3f6b4a,
  },
  birch: {
    id: 'birch',
    displayName: 'Western redcedar',
    shape: {
      family: 'tree',
      trunkRadius: 0.34,
      trunkHeight: 2.8,
      canopyRadius: 2.8,
      canopyHeight: 9.2,
    },
    chopping: { swingsToFell: 3, logs: 2 },
    colliderRadius: 0.42,
    triangleBudget: 4000,
    placeholderColor: 0x7fa85c,
  },
  oak: {
    id: 'oak',
    displayName: 'Sitka spruce',
    shape: {
      family: 'tree',
      trunkRadius: 0.4,
      trunkHeight: 3,
      canopyRadius: 2.4,
      canopyHeight: 13,
    },
    chopping: { swingsToFell: 5, logs: 4 },
    colliderRadius: 0.72,
    triangleBudget: 4000,
    placeholderColor: 0x4e7c42,
  },
  boulder: {
    id: 'boulder',
    displayName: 'Boulder',
    shape: { family: 'rock', radius: 1.2, height: 1.1 },
    colliderRadius: 1.2,
    triangleBudget: 2000,
    placeholderColor: 0x8a8f96,
  },
  mossyRock: {
    id: 'mossyRock',
    displayName: 'Mossy rock',
    shape: { family: 'rock', radius: 0.62, height: 0.55 },
    colliderRadius: 0.62,
    triangleBudget: 2000,
    placeholderColor: 0x6f7d63,
  },
  maple: {
    id: 'maple',
    displayName: 'Big-leaf maple',
    shape: {
      family: 'tree',
      trunkRadius: 0.36,
      trunkHeight: 3.2,
      canopyRadius: 4.6,
      canopyHeight: 8.8,
    },
    chopping: { swingsToFell: 4, logs: 3 },
    deciduous: true,
    colliderRadius: 0.55,
    triangleBudget: 4000,
    placeholderColor: 0x5a9a34,
  },
  alder: {
    id: 'alder',
    displayName: 'Red alder',
    shape: {
      family: 'tree',
      trunkRadius: 0.24,
      trunkHeight: 4.2,
      canopyRadius: 2.5,
      canopyHeight: 8.8,
    },
    chopping: { swingsToFell: 3, logs: 2 },
    deciduous: true,
    colliderRadius: 0.38,
    triangleBudget: 4000,
    placeholderColor: 0x6f9a4a,
  },
  stump: {
    id: 'stump',
    displayName: 'Stump',
    shape: { family: 'stump', radius: 0.42, height: 0.5 },
    colliderRadius: 0.42,
    triangleBudget: 500,
    placeholderColor: 0x6b5336,
  },
} as const satisfies Record<PropKindId, PropKind>;

/** Legacy keys pine/birch/oak remain stable for saves and network indices; their art and labels are now PNW species. */

/** A stable order, so a prop kind can be sent over the wire as a small number. */
export const PROP_KIND_ORDER: readonly PropKindId[] = [
  'pine',
  'birch',
  'oak',
  'boulder',
  'mossyRock',
  'stump',
  // Added after the others so the numbers saved worlds and the network already use do not move.
  'maple',
  'alder',
];

export function propKindIndex(id: PropKindId): number {
  const index = PROP_KIND_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown prop kind: ${id}`);
  return index;
}

export function propKindFromIndex(index: number): PropKindId {
  const id = PROP_KIND_ORDER[index];
  if (id === undefined) throw new Error(`Unknown prop kind index: ${index}`);
  return id;
}

/** Height of the prop, used to size its collider. */
export function propHeight(kind: PropKind): number {
  return kind.shape.family === 'tree'
    ? kind.shape.trunkHeight + kind.shape.canopyHeight
    : kind.shape.height;
}

/** What it takes to fell this kind of thing, or null if it is not a tree. */
export function choppingRuleFor(kind: PropKind): ChoppingRule | null {
  return kind.chopping ?? null;
}

/** The stump a felled tree of this size leaves behind. */
export function stumpScaleFor(kind: PropKind, scale: number): number {
  if (kind.shape.family !== 'tree') return scale;
  // Roughly as wide as the trunk was, so the stump reads as its remains.
  return (kind.shape.trunkRadius / PROP_KINDS.stump.shape.radius) * scale;
}
