/**
 * The wildlife table.
 *
 * Content as data, the same as trees and fish: what a rabbit is - how it
 * moves, how easily it startles - lives here, so tuning it is a change to
 * this table and nothing else. Phase 0's rule still applies: drawn as a
 * placeholder shape until the mechanic around it is fun.
 */

export type AnimalKindId = 'rabbit';

export interface AnimalKind {
  readonly id: AnimalKindId;
  readonly displayName: string;
  /** How fast it ambles about near its den, in m/s. */
  readonly wanderSpeed: number;
  /** How fast it runs once startled, in m/s. Faster than a walking player, slower than a sprint. */
  readonly fleeSpeed: number;
  /** A player this close startles it into fleeing. */
  readonly alertRadius: number;
  /**
   * Once fleeing, a player has to fall back this far before it calms down.
   * Bigger than `alertRadius` on purpose, so it does not flicker in and out
   * of fleeing right at the edge of noticing you.
   */
  readonly safeRadius: number;
  /** How far from its den it wanders while calm. */
  readonly leashRadius: number;
  /** Triangle budget for the art that eventually replaces the placeholder. */
  readonly triangleBudget: number;
  /** Placeholder colour, as 0xRRGGBB. */
  readonly placeholderColor: number;
}

export const ANIMAL_KINDS = {
  rabbit: {
    id: 'rabbit',
    displayName: 'Rabbit',
    wanderSpeed: 1.1,
    fleeSpeed: 6,
    alertRadius: 7,
    safeRadius: 11,
    leashRadius: 9,
    triangleBudget: 5000,
    placeholderColor: 0xbfa88f,
  },
} as const satisfies Record<AnimalKindId, AnimalKind>;
