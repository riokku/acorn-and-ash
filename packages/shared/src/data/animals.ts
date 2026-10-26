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

export type AnimalKindId =
  | 'rabbit'
  | 'maskedRaccoon'
  | 'fox'
  | 'elk'
  | 'curiousRaccoon'
  | 'woodlandGuardian'
  | 'jackrabbit'
  | 'coyote'
  | 'cedarStag';

/**
 * How a threat fights, once it has closed in. Present only on a kind that
 * can hurt you - absent on prey, which only ever flees.
 */
export interface ThreatBehavior {
  /** Stalk in an arc before closing, once per approach; point-blank threats still telegraph immediately. */
  readonly circle?: {
    readonly seconds: number;
    readonly speed: number;
    readonly radius: number;
    readonly noticeRadius: number;
  };
  /** Lock the intended victim and bite direction during wind-up. Absent for radial attacks. */
  readonly attackArcCosine?: number;
  /** Maximum pursuit distance from its den; absent for older unrestricted threats. */
  readonly leashRadius?: number;
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
  /** Calm animals pause at the end of a wander before picking another route. */
  readonly restSeconds?: readonly [number, number];
  readonly seeksRockShelter?: boolean;
  /**
   * How fast it runs once startled, in m/s. Faster than a walking player,
   * slower than a sprint. Only prey flees - absent on anything with `threat`.
   */
  readonly fleeSpeed?: number;
  /** Multiplies time to alarm; alert quarry reacts sooner without changing ordinary prey. */
  readonly awarenessTimeScale?: number;
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
  /**
   * Kinds this one hunts down on its own, chasing one to catch it the same
   * way a knockout catch works - gone until `ANIMAL_RESPAWN_SECONDS` is up.
   * Fleeing the player still comes first: a fox spooked by a player mid-chase
   * runs like any other prey rather than finishing the catch.
   */
  readonly preysOn?: readonly AnimalKindId[];
  /** How far away a hunter notices something worth chasing. Meaningless without `preysOn`. */
  readonly preyDetectionRadius?: number;
  /** How fast it closes in once it has noticed prey, in m/s. Meaningless without `preysOn`. */
  readonly preyChaseSpeed?: number;
  /** Triangle budget for the art that eventually replaces the placeholder. */
  readonly collider?: { readonly radius: number; readonly height: number };
  readonly triangleBudget: number;
  /** Placeholder colour, as 0xRRGGBB. */
  readonly placeholderColor: number;
}

export const ANIMAL_KINDS = {
  cedarStag: {
    id: 'cedarStag',
    displayName: 'Old Cedar Stag',
    wanderSpeed: 0.7,
    fleeSpeed: PLAYER_SPRINT_SPEED * 1.12,
    alertRadius: 8.5,
    safeRadius: 16,
    leashRadius: 10,
    awarenessTimeScale: 0.55,
    restSeconds: [5, 9],
    catchItem: 'cedarHide',
    collider: { radius: 0.42, height: 2.1 },
    triangleBudget: 5000,
    placeholderColor: 0x667345,
  },
  elk: {
    id: 'elk',
    displayName: 'Roosevelt elk',
    wanderSpeed: 0.85,
    fleeSpeed: 6.2,
    alertRadius: 4,
    safeRadius: 8,
    leashRadius: 7,
    catchItem: 'meat',
    restSeconds: [4, 7],
    triangleBudget: 5000,
    placeholderColor: 0x9d8162,
  },
  curiousRaccoon: {
    id: 'curiousRaccoon',
    displayName: 'Curious raccoon',
    wanderSpeed: 0.65,
    alertRadius: 4,
    safeRadius: 6,
    leashRadius: 4,
    restSeconds: [2, 4],
    triangleBudget: 5000,
    placeholderColor: 0x8d8981,
  },
  woodlandGuardian: {
    id: 'woodlandGuardian',
    displayName: 'Woodland guardian',
    wanderSpeed: 0.65,
    alertRadius: 9,
    safeRadius: 16,
    leashRadius: 7,
    triangleBudget: 5000,
    placeholderColor: 0x535338,
    threat: {
      chaseSpeed: PLAYER_WALK_SPEED * 0.9,
      attackRadius: CHOP_REACH,
      windupSeconds: 1.1,
      attackCooldownSeconds: 2.3,
      damage: 20,
      hitsToDefeat: 6,
    },
  },
  rabbit: {
    id: 'rabbit',
    displayName: 'Rabbit',
    wanderSpeed: 1.1,
    fleeSpeed: 6,
    alertRadius: 7,
    safeRadius: 11,
    leashRadius: 9,
    catchItem: 'meat',
    restSeconds: [2, 4],
    seeksRockShelter: true,
    collider: { radius: 0.16, height: 0.45 },
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
    restSeconds: [1.5, 3],
    collider: { radius: 0.2, height: 0.55 },
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
  fox: {
    id: 'fox',
    displayName: 'Fox',
    // Flees the player exactly like a rabbit - no threat to people, only prey.
    wanderSpeed: 1.3,
    fleeSpeed: 6.5,
    alertRadius: 8,
    safeRadius: 12,
    // Wider than a rabbit's: it has to actually roam to find one to chase,
    // rather than a hunt that is guaranteed the moment it wakes up.
    leashRadius: 16,
    catchItem: 'meat',
    preysOn: ['rabbit'],
    preyDetectionRadius: 10,
    // Faster than a rabbit's fleeSpeed (6), so a chase can actually end in a
    // catch, but not by so much that "sometimes" becomes "always".
    preyChaseSpeed: 6.8,
    restSeconds: [1.5, 3],
    seeksRockShelter: true,
    collider: { radius: 0.21, height: 0.6 },
    triangleBudget: 5000,
    placeholderColor: 0xc9622a,
  },
  jackrabbit: {
    id: 'jackrabbit',
    displayName: 'Plains jackrabbit',
    wanderSpeed: 1.2,
    fleeSpeed: 6.8,
    alertRadius: 8,
    safeRadius: 13,
    leashRadius: 11,
    catchItem: 'meat',
    collider: { radius: 0.18, height: 0.5 },
    restSeconds: [2, 4],
    seeksRockShelter: true,
    triangleBudget: 5000,
    placeholderColor: 0xb7a17a,
  },
  coyote: {
    id: 'coyote',
    displayName: 'Sunreach coyote',
    wanderSpeed: 1.15,
    alertRadius: 9,
    safeRadius: 17,
    leashRadius: 17,
    catchItem: 'meat',
    collider: { radius: 0.35, height: 0.9 },
    restSeconds: [1.5, 3],
    triangleBudget: 5000,
    placeholderColor: 0x9c896c,
    preysOn: ['jackrabbit'],
    preyDetectionRadius: 13,
    preyChaseSpeed: 7,
    threat: {
      leashRadius: 40,
      circle: { seconds: 1.1, speed: 2.1, radius: 2.8, noticeRadius: 6 },
      attackArcCosine: 0.4,
      chaseSpeed: 5.6,
      attackRadius: 1.65,
      windupSeconds: 0.8,
      attackCooldownSeconds: 1.65,
      damage: 28,
      hitsToDefeat: 4,
    },
  },
} as const satisfies Record<AnimalKindId, AnimalKind>;
