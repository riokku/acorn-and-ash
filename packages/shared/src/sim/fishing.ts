/**
 * Fishing: cast, wait for the bite, click in time.
 *
 * Everything that decides whether you catch something lives here and runs on
 * the server. The browser draws the float and says when you clicked; it never
 * decides when a fish bites or what it was.
 *
 * The click is timed on the player's side of the wire. The server decides when
 * the fish bites, but word of that takes a while to reach the browser, and the
 * click takes a while to come back. Timed on the server, a player on a slow
 * connection would see the float go under with the moment already half gone.
 * So every input the browser makes while it is showing the bite carries a flag,
 * and the window is counted in the player's own inputs from the first of those.
 * Inputs are made at a steady twenty a second of the player's own time, so the
 * window is one second for everybody, whatever their connection.
 */

import {
  BITE_DELAY_MAX_SECONDS,
  BITE_DELAY_MIN_SECONDS,
  BITE_GIVE_UP_SECONDS,
  BITE_WINDOW_SECONDS,
  CAST_COOLDOWN_SECONDS,
  FISHING_LEASH,
  TICK_HZ,
} from '../constants';
import { POND_FISH, fishForRoll } from '../data/fish';
import type { ItemId } from '../data/items';
import type { Vec3 } from '../math/vec3';
import { createRng, hashSeed } from '../rng';
import type { FloatSpot } from '../world/water';

/** How many of the player's own inputs they have to click in once they see the bite. */
export const BITE_WINDOW_INPUTS = Math.round(BITE_WINDOW_SECONDS * TICK_HZ);
/** How long the server waits on a browser that has gone quiet mid-bite. */
export const BITE_GIVE_UP_TICKS = Math.round(BITE_GIVE_UP_SECONDS * TICK_HZ);
export const CAST_COOLDOWN_TICKS = Math.round(CAST_COOLDOWN_SECONDS * TICK_HZ);

/** A line in the water. */
export interface Cast {
  /** Counts every cast in the world, so no two share a roll. */
  readonly castNumber: number;
  readonly float: FloatSpot;
  /** Where the player stood to cast. Wander off and the line comes in. */
  readonly fromX: number;
  readonly fromZ: number;
  /** The tick the float goes under. */
  readonly biteTick: number;
  /** The tick the server stops waiting, whatever the browser has to say. */
  readonly giveUpTick: number;
  /** Whether the bite has happened yet. */
  biting: boolean;
  /**
   * The first input the player made after their browser showed the bite, or
   * null until one arrives. The window to click is counted from here.
   */
  sawBiteSeq: number | null;
}

/** How a cast finished. */
export type CastEnd =
  | { readonly outcome: 'caught'; readonly item: ItemId }
  /** Clicked before the bite: whatever was nibbling swims off. */
  | { readonly outcome: 'tooSoon' }
  /** The float went under and came back up without a click. */
  | { readonly outcome: 'tooLate' }
  /** Walked away from the water with the line still out. */
  | { readonly outcome: 'walkedAway' };

/** What a tick did to a cast. */
export interface CastProgress {
  /** The float went under on this tick. */
  readonly bit: boolean;
  /** Set when the cast is over. */
  readonly end: CastEnd | null;
}

/** One input from the player holding the line, as far as the line cares. */
export interface CastInput {
  readonly seq: number;
  /** A fresh press of the button, not one being held down. */
  readonly clicked: boolean;
  /** Their browser was showing a fish on the line when this input was made. */
  readonly sawBite: boolean;
}

/**
 * How many ticks until a fish bites this cast.
 *
 * Drawn from the world seed, the cast and the tick it was made on. The tick
 * matters: a browser that knows the seed could otherwise work out every bite
 * before it happened.
 */
export function biteDelayTicks(worldSeed: number, castNumber: number, tick: number): number {
  const rng = createRng(hashSeed('bite', worldSeed, castNumber, tick));
  const seconds = rng.nextRange(BITE_DELAY_MIN_SECONDS, BITE_DELAY_MAX_SECONDS);
  return Math.round(seconds * TICK_HZ);
}

/** Throw a line: the float is at `float`, and the fish is on its way. */
export function startCast(
  worldSeed: number,
  castNumber: number,
  tick: number,
  from: Readonly<Vec3>,
  float: FloatSpot,
): Cast {
  const biteTick = tick + biteDelayTicks(worldSeed, castNumber, tick);
  return {
    castNumber,
    float,
    fromX: from.x,
    fromZ: from.z,
    biteTick,
    giveUpTick: biteTick + BITE_GIVE_UP_TICKS,
    biting: false,
    sawBiteSeq: null,
  };
}

/**
 * Which fish is on the end of the line.
 *
 * Decided at the moment it is hooked, from the tick of the click, so it cannot
 * be known in advance and fishing again cannot be timed to land a rare one.
 */
export function fishOnTheLine(worldSeed: number, castNumber: number, tick: number): ItemId {
  const rng = createRng(hashSeed('catch', worldSeed, castNumber, tick));
  return fishForRoll(POND_FISH, rng.nextFloat());
}

/**
 * The server's side of a tick with a line out, before any inputs are read:
 * the fish bites on time, wandering off brings the line in, and a browser that
 * never answers loses the fish.
 */
export function tickCast(cast: Cast, tick: number, position: Readonly<Vec3>): CastProgress {
  if (Math.hypot(position.x - cast.fromX, position.z - cast.fromZ) > FISHING_LEASH) {
    return { bit: false, end: { outcome: 'walkedAway' } };
  }

  let bit = false;
  if (!cast.biting && tick >= cast.biteTick) {
    cast.biting = true;
    bit = true;
  }

  if (cast.biting && tick > cast.giveUpTick) return { bit, end: { outcome: 'tooLate' } };
  return { bit, end: null };
}

/**
 * One of the player's inputs, read against the line.
 *
 * A click before their browser has shown the bite loses the fish, even one
 * that reaches the server after the bite: it was made while the float was
 * still only nibbling. A click within the window hooks it, and letting the
 * window pass lets it go.
 */
export function readCastInput(
  cast: Cast,
  worldSeed: number,
  tick: number,
  input: CastInput,
): CastEnd | null {
  if (!cast.biting) return input.clicked ? { outcome: 'tooSoon' } : null;

  if (cast.sawBiteSeq === null && input.sawBite) cast.sawBiteSeq = input.seq;
  const since = cast.sawBiteSeq === null ? null : input.seq - cast.sawBiteSeq;

  if (input.clicked) {
    if (since === null) return { outcome: 'tooSoon' };
    if (since <= BITE_WINDOW_INPUTS) {
      return { outcome: 'caught', item: fishOnTheLine(worldSeed, cast.castNumber, tick) };
    }
    return { outcome: 'tooLate' };
  }

  if (since !== null && since > BITE_WINDOW_INPUTS) return { outcome: 'tooLate' };
  return null;
}
