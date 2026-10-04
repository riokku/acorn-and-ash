/**
 * Skeleton raiders: who turns up, how tough each one is, and how a raid is
 * paced (see decision 0063).
 *
 * Content as data: making the rogue quicker, the warrior tougher or raids
 * rarer is a change to this file and nothing else. Every raider fights with
 * the player's own moves - the light combo, the charged strike, the dodge
 * roll (see `sim/actions.ts`) - so what tells them apart is all here: how
 * hard and how often they swing, how readily they roll out of the way, and
 * how much it takes to put them down.
 */

import type { ItemId } from './items';
import type { WindupPace } from './moves';

export type RaiderKindId = 'minion' | 'rogue' | 'warrior' | 'mage' | 'sentinel';

export interface RaiderKind {
  readonly id: RaiderKindId;
  readonly displayName: string;
  /**
   * How much it takes to put down, counted in blows: a light swing is one,
   * the combo's heavy finisher two and a charged strike four (see
   * `RAIDER_BLOW_WEIGHT`).
   */
  readonly toughness: number;
  /** Health one of its light swings takes off a player, out of `HEALTH_MAX`. */
  readonly swingDamage: number;
  /** Health its charged strike takes. */
  readonly strikeDamage: number;
  /**
   * How fast it runs, in metres a second. Always short of a player's sprint,
   * so running away is always an answer.
   */
  readonly runSpeed: number;
  /** How long it draws back before the first swing of a combo: see `WINDUP_TICKS`. */
  readonly windup: WindupPace;
  /** The most swings of the light combo it throws in one go. */
  readonly comboLength: 1 | 2 | 3;
  /** The chance an attack is a charged strike rather than the light combo. */
  readonly strikeChance: number;
  /** The chance it rolls out of the way of a swing it sees coming. */
  readonly dodgeChance: number;
  /**
   * Whether a light swing fails to stop it mid-attack. It still counts, and
   * a charged strike still stops it; only a light swing is shrugged off
   * while it winds up or swings.
   */
  readonly steadfast: boolean;
  /** How often it turns up, against the others. */
  readonly weight: number;
  /** What it leaves behind once beaten. */
  readonly loot: { readonly item: ItemId; readonly count: number };
}

export const RAIDER_KINDS = {
  minion: {
    id: 'minion',
    displayName: 'Skeleton Minion',
    toughness: 4,
    swingDamage: 10,
    strikeDamage: 22,
    runSpeed: 4.2,
    windup: 0,
    comboLength: 2,
    strikeChance: 0.15,
    dodgeChance: 0.2,
    steadfast: false,
    weight: 4,
    loot: { item: 'bone', count: 1 },
  },
  rogue: {
    id: 'rogue',
    displayName: 'Skeleton Rogue',
    toughness: 4,
    swingDamage: 8,
    strikeDamage: 20,
    // The quick one: faster than a walking player, still short of a sprint.
    runSpeed: 5.4,
    windup: 1,
    comboLength: 3,
    strikeChance: 0.1,
    dodgeChance: 0.5,
    steadfast: false,
    weight: 3,
    loot: { item: 'bone', count: 1 },
  },
  warrior: {
    id: 'warrior',
    displayName: 'Skeleton Warrior',
    toughness: 7,
    swingDamage: 14,
    strikeDamage: 30,
    runSpeed: 3.8,
    windup: 2,
    comboLength: 3,
    strikeChance: 0.3,
    dodgeChance: 0.1,
    steadfast: true,
    weight: 2,
    loot: { item: 'bone', count: 2 },
  },
  mage: {
    id: 'mage',
    displayName: 'Skeleton Mage',
    toughness: 4,
    swingDamage: 12,
    strikeDamage: 28,
    runSpeed: 4,
    windup: 0,
    comboLength: 2,
    // Fights up close with its staff like the rest, but likes a big swing.
    strikeChance: 0.35,
    dodgeChance: 0.35,
    steadfast: false,
    weight: 2,
    loot: { item: 'bone', count: 1 },
  },
  sentinel: {
    id: 'sentinel',
    displayName: 'Ruin Sentinel',
    toughness: 24,
    swingDamage: 14,
    strikeDamage: 28,
    runSpeed: 3.4,
    windup: 2,
    comboLength: 2,
    strikeChance: 0.5,
    dodgeChance: 0,
    steadfast: true,
    weight: 0,
    loot: { item: 'bone', count: 0 },
  },
} as const satisfies Record<RaiderKindId, RaiderKind>;

/** A stable order, so a kind can travel as a small number. Only ever add to the end. */
export const RAIDER_KIND_ORDER: readonly RaiderKindId[] = [
  'minion',
  'rogue',
  'warrior',
  'mage',
  'sentinel',
];

export function raiderKindIndex(id: RaiderKindId): number {
  return RAIDER_KIND_ORDER.indexOf(id);
}

export function raiderKindFromIndex(index: number): RaiderKindId | null {
  return RAIDER_KIND_ORDER[index] ?? null;
}

/** How much each of a player's blows counts against a raider's `toughness`. */
export const RAIDER_BLOW_WEIGHT = {
  /** The first two swings of the light combo. */
  swing: 1,
  /** The combo's third, heavier swing. */
  finisher: 2,
  /** A charged strike. */
  strike: 4,
} as const;

/** How raids are paced and how raiders hold themselves in a fight. Times are in seconds, distances in metres. */
export const RAID = {
  /**
   * Time spent outdoors between one raid and the next, by day. Night counts
   * `nightPace` times as fast, so raids come twice as often after dark.
   */
  intervalSeconds: { min: 240, max: 360 },
  nightPace: 2,
  /**
   * How likely a raid is to be one, two or three strong. Nights bring
   * bigger groups.
   */
  groupOdds: { day: [0.55, 0.33, 0.12], night: [0.25, 0.45, 0.3] },
  /** How far from the player a raid turns up. Comfortably in view, well out of reach. */
  spawnDistance: { min: 32, max: 38 },
  /** How far apart a group stands when it turns up. */
  groupSpacing: 2.2,
  /** Walking pace, while still marching in from a distance. */
  marchSpeed: 3.2,
  /** Closer than this, they break into a run. */
  runWithin: 18,
  /**
   * How far from the player raiders hang back while it is not their turn to
   * attack. Only one raider attacks a player at a time; the others circle.
   */
  standoff: 4.2,
  /** Pace while circling. */
  circleSpeed: 1.6,
  /** Close enough to start an attack from. */
  attackRange: 1.8,
  /** How far one of their blows reaches, from where they stand. */
  reach: 2.2,
  /**
   * After one raider's attack, how long before another may start one on
   * the same player, in seconds: a breath for the player between attacks.
   */
  turnGapSeconds: { min: 0.35, max: 0.9 },
  /** How long they wait outside for a player who went indoors, before giving up. */
  indoorPatienceSeconds: 18,
  /** A player who outruns them this far for this long is let go. */
  loseTrackDistance: 70,
  loseTrackSeconds: 8,
  /** Longest a raid lasts, start to finish, before whatever is left gives up. */
  maxSeconds: 180,
  /** How long raiders spend walking off before they are gone. */
  leaveSeconds: 6,
  /** How long a beaten raider takes to fall apart, before its loot is left behind. */
  crumbleSeconds: 1.6,
  /** No more raids than this at once in one world. */
  maxConcurrent: 4,
  /** A raid due on somebody this close to another raid waits instead. */
  crowdedRadius: 40,
  /** And waits this long before trying again. */
  postponeSeconds: 30,
  /** Raiders this close to each other step apart. */
  personalSpace: 1.3,
} as const;

/** Each actual helper adds eight blows, capped at four fighters. */
export function sentinelToughness(contributors: number): number {
  return 24 + 8 * (Math.min(4, Math.max(1, Math.floor(contributors))) - 1);
}
