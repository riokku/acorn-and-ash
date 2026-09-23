/**
 * The wildlife table.
 *
 * Content as data, the same as trees and fish: what a rabbit is - how it
 * moves, how easily it startles - lives here, so tuning it is a change to
 * this table and nothing else. Phase 0's rule still applies: drawn as a
 * placeholder shape until the mechanic around it is fun.
 */

import { CHOP_REACH, PLAYER_SPRINT_SPEED, PLAYER_WALK_SPEED } from '../constants';
import type { ItemId } from './items';

export type AnimalKindId = 'rabbit' | 'maskedRaccoon';

/**
 * How a threat fights, once it has closed in. Present only on a kind that
 * can hurt you - absent on prey, which only ever flees.
 */
export interface ThreatBehavior {
  /** How fast it closes the distance once it has noticed you, in m/s. */
  readonly chaseSpeed: number;
  /** Close enough to actually take a swing, once it has caught up. */
  readonly attackRadius: number;
  /** How long it stands stock-still, plainly telegraphing, before it swings. */
  readonly windupSeconds: number;
  /** How long it waits after a swing - landed or dodged - before winding up again. */
  readonly attackCooldownSeconds: number;
  /** Health it takes off if the wind-up finishes while you are still this close. */
  readonly damage: number;
  /** Swings of your own it takes to fight one off. */
  readonly hitsToDefeat: number;
}

export interface AnimalKind {
  readonly id: AnimalKindId;
  readonly displayName: string;
  /** How fast it ambles about near its den, in m/s. */
  readonly wanderSpeed: number;
  /**
   * How fast it runs once startled, in m/s. Faster than a walking player,
   * slower than a sprint. Only prey flees - absent on anything with `threat`.
   */
  readonly fleeSpeed?: number;
  /** A player this close gets its attention, to flee from or to fight. */
  readonly alertRadius: number;
  /**
   * Once it has noticed you, a player has to fall back this far before it
   * calms down. Bigger than `alertRadius` on purpose, so it does not flicker
   * in and out right at the edge of noticing you.
   */
  readonly safeRadius: number;
  /** How far from its den it wanders while calm. */
  readonly leashRadius: number;
  /** What a swing gets you, once it lands - absent if fighting one off pays out nothing. */
  readonly catchItem?: ItemId;
  /** Present on something dangerous. Absent on prey, which only ever flees. */
  readonly threat?: ThreatBehavior;
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
    catchItem: 'meat',
    triangleBudget: 5000,
    placeholderColor: 0xbfa88f,
  },
  maskedRaccoon: {
    id: 'maskedRaccoon',
    displayName: 'Masked raccoon',
    wanderSpeed: 1.3,
    alertRadius: 8,
    safeRadius: 12,
    leashRadius: 10,
    triangleBudget: 3000,
    placeholderColor: 0x4a4038,
    threat: {
      // Between a walk and a sprint: it is a real threat you cannot simply
      // outwalk, but a fair one you can always outrun.
      chaseSpeed: (PLAYER_WALK_SPEED + PLAYER_SPRINT_SPEED) / 2,
      // The same reach a swing of your own has, so the fight is symmetric.
      attackRadius: CHOP_REACH,
      windupSeconds: 0.6,
      attackCooldownSeconds: 1.5,
      damage: 25,
      hitsToDefeat: 3,
    },
  },
} as const satisfies Record<AnimalKindId, AnimalKind>;
