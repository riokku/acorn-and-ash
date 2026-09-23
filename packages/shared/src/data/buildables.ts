/**
 * The buildable table.
 *
 * What you can place in the world, and what it costs. Content lives in typed
 * data tables, not scattered through code, so a new buildable means a new row
 * here. One kind for now, the same way `ANIMAL_KINDS` started with one.
 */

import type { RecipeCost } from './recipes';

export type BuildableKindId = 'campfire';

export interface BuildableKind {
  readonly id: BuildableKindId;
  readonly displayName: string;
  readonly costs: readonly RecipeCost[];
  /** How much room it needs, so two of them - or one and a tree - don't overlap. */
  readonly footprintRadius: number;
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
    triangleBudget: 1500,
    placeholderColor: 0x6b4a32,
  },
} as const satisfies Record<BuildableKindId, BuildableKind>;

/** A stable order, so a buildable kind can be sent over the wire as a small number. */
export const BUILDABLE_KIND_ORDER: readonly BuildableKindId[] = ['campfire'];

export function buildableKindIndex(id: BuildableKindId): number {
  const index = BUILDABLE_KIND_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown buildable kind: ${id}`);
  return index;
}

export function buildableKindFromIndex(index: number): BuildableKindId | null {
  return BUILDABLE_KIND_ORDER[index] ?? null;
}
