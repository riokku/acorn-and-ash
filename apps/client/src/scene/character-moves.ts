/**
 * Which animation clip a character's move plays, how far into it they are,
 * and where their drawn body sits - worked out from the move itself (see
 * `sim/actions.ts`) and nothing else, so it can be tested without Three.js
 * and so everybody watching the same move sees the same frame of it.
 *
 * Every swing is lined up so the clip's own blow - the moment the weapon is
 * moving fastest, measured off the clip - lands on exactly the tick the rules
 * land it on (see `data/moves.ts`), whatever speed that asks of the clip.
 */

import {
  ActionKind,
  CHARGE_TICKS,
  DODGE,
  DODGE_ATTACKS,
  FLINCH,
  Gesture,
  KNOCKED_OUT_TICKS,
  LIGHT_COMBO,
  RISE,
  RiseFrom,
  SETTLE,
  STRIKE,
  TICK_SECONDS,
  windupTicks,
} from '@acorn/shared';

/** Every clip in the animation library, by the name the game gave it (see tools/import-animations.mjs). */
export type MoveClip =
  | 'idle'
  | 'idleLook'
  | 'walk'
  | 'run'
  | 'jumpStart'
  | 'jumpAir'
  | 'jumpLand'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'strike'
  | 'throw'
  | 'chargeHold'
  | 'chop'
  | 'dodgeForward'
  | 'dodgeBackward'
  | 'dodgeLeft'
  | 'dodgeRight'
  | 'hitA'
  | 'hitB'
  | 'knockedOut'
  | 'dig'
  | 'cast'
  | 'fishIdle'
  | 'fishBite'
  | 'reel'
  | 'fishCatch'
  | 'pickUp'
  | 'interact'
  | 'sitDown'
  | 'sitIdle'
  | 'sitUp'
  | 'lieDown'
  | 'lieIdle'
  | 'lieUp';

/** A clip's blow: when, in seconds into the clip, the weapon is moving fastest. */
const CLIP_BLOW_SECONDS: Partial<Record<MoveClip, number>> = {
  attack1: 0.42,
  attack2: 0.25,
  attack3: 0.6,
  strike: 0.73,
  chop: 0.32,
};

/**
 * How fast each swing plays: quick and snappy for the combo, a touch slower
 * for the finishing chop. The start point is then whatever puts its blow on
 * the right tick.
 */
const SWING_SPEED: Record<'attack1' | 'attack2' | 'attack3' | 'chop', number> = {
  attack1: 1.4,
  attack2: 1.25,
  attack3: 1.5,
  chop: 1.3,
};

/**
 * Where the charged strike picks up from as the charge lets go: rising out
 * of its crouch into the leap.
 */
const STRIKE_LEAP_SECONDS = 0.3;
/** Where a tucked-up roll holds: the crouch before a jump. */
const ROLL_TUCK_SECONDS = 0.3;

/**
 * How far into the first swing's clip a raider's wind-up draws back to and
 * holds: the weapon raised, just before it starts to come round. The swing
 * that follows plays on from exactly here (see `MoveView.afterWindup`).
 */
export const WINDUP_PEAK_SECONDS = 0.26;
/** How much of a wind-up is spent drawing back; the rest holds there, ready. */
const WINDUP_DRAW_SHARE = 0.55;

/** What a character's whole body is doing because of a move, rather than walking about. */
export interface MovePose {
  /** The clip playing over the top of walking, or null for none. */
  readonly clip: MoveClip | null;
  /** How far into it, in seconds. */
  readonly time: number;
  /** Plays on in a loop from `time` on, rather than holding its last frame. */
  readonly loop: boolean;
  /**
   * How far the drawn body has moved from where the character stands to
   * where it rests - the seat or the mattress - from 0 to 1 (see
   * `RestingPlace` in the shared rules).
   */
  readonly rest: number;
  /** A dodge roll: how far through the roll, from 0 to 1, or null when not rolling. */
  readonly roll: number | null;
  /** How far into a charged wind-up, from 0 to 1, for the tremble and glow. */
  readonly charge: number;
  /** Whether whatever is in hand is put away: nobody sleeps holding an axe. */
  readonly handsFree: boolean;
  /**
   * Whether the legs can walk on underneath while the arms keep the move
   * going: creeping through a charge's wind-up (see `CHARGE_WALK_SHARE`).
   */
  readonly legsFree: boolean;
  /**
   * How far through a raider's wind-up, from 0 to 1, for the glow in its
   * eyes that says a swing is coming; 0 for anything else.
   */
  readonly windup: number;
  /**
   * How far the body is twisted back and leaning away, from 0 to 1, coiled
   * for a raider's first swing - and unwinding again as the swing goes.
   */
  readonly coil: number;
  /** A full aerial spin/somersault; completed turns leave the landing upright. */
  readonly aerialTurn?: number;
  readonly somersault?: boolean;
}

const NO_MOVE: MovePose = {
  clip: null,
  time: 0,
  loop: false,
  rest: 0,
  roll: null,
  charge: 0,
  handsFree: false,
  legsFree: false,
  windup: 0,
  coil: 0,
};

/** A move as it reaches the drawing code: the shared state, with `age` in fractional ticks. */
export interface MoveView {
  readonly kind: ActionKind;
  readonly step: number;
  readonly age: number;
  /** Swinging at a tree, which gets the woodcutter's chop rather than a fighting swing. */
  readonly atTree: boolean;
  /** Which flinch to play, so two hits in a row do not look the same. */
  readonly flinchVariant: 0 | 1;
  /** Which way a dodge goes, as the character sees it. */
  readonly roll: 'forward' | 'backward' | 'left' | 'right';
  /**
   * A first swing straight out of a wind-up, which carries on from where the
   * wind-up drew back to rather than starting over. Only raiders wind up.
   */
  readonly afterWindup?: boolean;
}

/** How long a whole-body move takes to take over from walking, and to hand back, in seconds. */
export function blendSeconds(kind: ActionKind): number {
  switch (kind) {
    case ActionKind.Swing:
    case ActionKind.Strike:
    case ActionKind.DodgeLight:
    case ActionKind.DodgeHeavy:
      return 0.06;
    case ActionKind.Dodge:
      return 0.05;
    case ActionKind.Flinch:
      return 0.05;
    case ActionKind.Windup:
      return 0.1;
    default:
      return 0.18;
  }
}

export function movePose(move: MoveView): MovePose {
  const seconds = Math.max(0, move.age) * TICK_SECONDS;
  switch (move.kind) {
    case ActionKind.Idle:
      return NO_MOVE;

    case ActionKind.Swing: {
      const step = Math.min(Math.max(move.step, 1), 3);
      const clip = move.atTree
        ? 'chop'
        : step === 1
          ? 'attack1'
          : step === 2
            ? 'attack2'
            : 'attack3';
      const impact = LIGHT_COMBO[step - 1]?.impact ?? 4;
      // Out of a wind-up, the weapon is already raised: it comes round from
      // there, still landing on the tick.
      const unwinding = clip === 'attack1' && move.afterWindup === true;
      const speed = unwinding
        ? ((CLIP_BLOW_SECONDS.attack1 ?? 0.42) - WINDUP_PEAK_SECONDS) / (impact * TICK_SECONDS)
        : SWING_SPEED[clip];
      return {
        ...NO_MOVE,
        clip,
        legsFree: move.afterWindup !== true,
        time: lineUp(clip, speed, impact, move.age),
        // Untwisting into the blow, all the way round by the time it lands.
        coil: unwinding ? 1 - smoothstep(0, impact, move.age) : 0,
      };
    }

    case ActionKind.Windup: {
      // A raider drawing back for the first swing of a combo, slowly enough
      // to see coming, then holding there until it goes. Creeping in, the
      // legs walk on underneath.
      const ticks = windupTicks(move.step);
      const drawn = smoothstep(0, ticks * WINDUP_DRAW_SHARE, move.age);
      return {
        ...NO_MOVE,
        clip: 'attack1',
        time: WINDUP_PEAK_SECONDS * drawn,
        legsFree: true,
        windup: Math.min(1, Math.max(0, move.age / ticks)),
        coil: drawn,
      };
    }

    case ActionKind.Charge:
      // Crouched, arm wound right back, gathering: held, trembling harder
      // the longer it winds up. Creeping along, the legs walk instead.
      return {
        ...NO_MOVE,
        clip: 'chargeHold',
        time: 0,
        charge: Math.min(1, move.age / CHARGE_TICKS),
        legsFree: true,
      };

    case ActionKind.Strike: {
      const blow = CLIP_BLOW_SECONDS.strike ?? 0.73;
      const speed = (blow - STRIKE_LEAP_SECONDS) / (STRIKE.impact * TICK_SECONDS);
      return { ...NO_MOVE, clip: 'strike', time: STRIKE_LEAP_SECONDS + seconds * speed };
    }

    case ActionKind.DodgeLight: {
      const rules = DODGE_ATTACKS.light;
      return {
        ...NO_MOVE,
        clip: 'attack2',
        time: lineUp('attack2', 1.1, rules.impact, move.age),
        aerialTurn: smoothstep(0, rules.impact, move.age),
        somersault: false,
      };
    }
    case ActionKind.DodgeHeavy: {
      const rules = DODGE_ATTACKS.heavy;
      const blow = CLIP_BLOW_SECONDS.strike ?? 0.73;
      return {
        ...NO_MOVE,
        clip: 'strike',
        time:
          STRIKE_LEAP_SECONDS +
          seconds * ((blow - STRIKE_LEAP_SECONDS) / (rules.impact * TICK_SECONDS)),
        aerialTurn: smoothstep(0, rules.land, move.age),
        somersault: true,
      };
    }

    case ActionKind.Dodge: {
      // Forward and back are a tucked-up roll, turned over by the character
      // drawing it; to the sides, the pack's own quick hop across.
      if (move.roll === 'left' || move.roll === 'right') {
        const clip = move.roll === 'left' ? 'dodgeLeft' : 'dodgeRight';
        return { ...NO_MOVE, clip, time: seconds * (0.4 / (DODGE.end * TICK_SECONDS)) };
      }
      return {
        ...NO_MOVE,
        clip: 'jumpStart',
        time: ROLL_TUCK_SECONDS,
        roll: Math.min(1, move.age / DODGE.travel),
      };
    }

    case ActionKind.Flinch:
      return {
        ...NO_MOVE,
        clip: move.flinchVariant === 0 ? 'hitA' : 'hitB',
        time: seconds * (0.67 / (FLINCH.end * TICK_SECONDS)),
      };

    case ActionKind.KnockedOut:
      return {
        ...NO_MOVE,
        clip: 'knockedOut',
        time: Math.min(seconds, 0.8),
        handsFree: move.age > KNOCKED_OUT_TICKS * 0.3,
      };

    case ActionKind.Rise: {
      if (move.step === RiseFrom.Chair) {
        return {
          ...NO_MOVE,
          clip: 'sitUp',
          time: seconds * (0.8 / (RISE.chair * TICK_SECONDS)),
          rest: 1 - smoothstep(2, 12, move.age),
          handsFree: move.age < RISE.chair * 0.6,
        };
      }
      const length = move.step === RiseFrom.Bed ? RISE.bed : RISE.ground;
      return {
        ...NO_MOVE,
        clip: 'lieUp',
        time: seconds * (2.33 / (length * TICK_SECONDS)),
        rest: move.step === RiseFrom.Bed ? 1 - smoothstep(10, 26, move.age) : 0,
        handsFree: move.age < length * 0.8,
      };
    }

    case ActionKind.Sit: {
      const settle = SETTLE.chair;
      const down = move.age < settle;
      return {
        ...NO_MOVE,
        clip: down ? 'sitDown' : 'sitIdle',
        time: down ? seconds * (0.8 / (settle * TICK_SECONDS)) : (move.age - settle) * TICK_SECONDS,
        loop: !down,
        rest: smoothstep(0, 9, move.age),
        handsFree: true,
      };
    }

    case ActionKind.Lie: {
      const settle = SETTLE.bed;
      const down = move.age < settle;
      return {
        ...NO_MOVE,
        clip: down ? 'lieDown' : 'lieIdle',
        time: down ? seconds * (3 / (settle * TICK_SECONDS)) : (move.age - settle) * TICK_SECONDS,
        loop: !down,
        rest: smoothstep(0, 14, move.age),
        handsFree: true,
      };
    }
  }
  return NO_MOVE;
}

/**
 * Where to be in a swing clip `age` ticks into the swing, playing at
 * `speed`, so its blow lands on tick `impact`.
 */
export function lineUp(clip: MoveClip, speed: number, impact: number, age: number): number {
  const blow = CLIP_BLOW_SECONDS[clip] ?? 0;
  const start = blow - impact * TICK_SECONDS * speed;
  return Math.max(0, start + Math.max(0, age) * TICK_SECONDS * speed);
}

/** When a clip's blow lands, in seconds into it, if it has one. */
export function clipBlowSeconds(clip: MoveClip): number | undefined {
  return CLIP_BLOW_SECONDS[clip];
}

/** How long, in the clip's own seconds, a swing sweeps round fast before its blow, and after. */
const SWEEP_BEFORE = 0.2;
const SWEEP_AFTER = 0.08;

/** Whether a swing is sweeping round fast right now, fast enough to leave a streak behind it. */
export function isSweeping(pose: MovePose): boolean {
  if (pose.clip === null) return false;
  const blow = CLIP_BLOW_SECONDS[pose.clip];
  if (blow === undefined) return false;
  return pose.time >= blow - SWEEP_BEFORE && pose.time <= blow + SWEEP_AFTER;
}

/** A gesture's clip, how fast it plays, how long it lasts, and whether the legs join in when standing still. */
export interface GesturePlay {
  readonly clip: MoveClip;
  readonly speed: number;
  readonly seconds: number;
  readonly wholeBody: boolean;
}

/** Every gesture but eating, which has no clip of its own: see `eatingPose`. */
export const GESTURE_PLAYS: Record<Exclude<Gesture, typeof Gesture.Eat>, GesturePlay> = {
  [Gesture.PickUp]: { clip: 'pickUp', speed: 1.4, seconds: 0.9, wholeBody: true },
  [Gesture.Dig]: { clip: 'dig', speed: 1, seconds: 1.4, wholeBody: true },
  [Gesture.Reach]: { clip: 'interact', speed: 1.4, seconds: 0.9, wholeBody: false },
};

/** When each mouthful is taken, in seconds into eating. */
export const EAT_BITES: readonly number[] = [0.42, 0.66, 0.9, 1.14];
/** How long eating takes, from lifting the food to lowering an empty hand. */
export const EAT_SECONDS = 1.5;
/** How long the hand takes to come up to the mouth, and to go back down. */
const EAT_LIFT_SECONDS = 0.32;
/** How long either side of a bite the hand takes to come in to the mouth. */
const EAT_BITE_HALF_SECONDS = 0.12;

/**
 * Where eating is at: the pack has no clip for it, and nothing in it brings
 * a hand anywhere near these characters' big heads, so the hand is steered
 * up to the mouth instead, over whatever the body is already doing.
 */
export interface EatingPose {
  /** How far the hand has come up to the mouth, from 0 (hanging) to 1. */
  readonly reach: number;
  /** How far into a mouthful, from 0 (holding it just away) to 1 (in). */
  readonly bite: number;
  /** How much of the food is left, from 1 down to 0 once the last bite is gone. */
  readonly left: number;
}

export function eatingPose(seconds: number): EatingPose {
  const reach =
    smoothstep(0, EAT_LIFT_SECONDS, seconds) *
    (1 - smoothstep(EAT_SECONDS - EAT_LIFT_SECONDS, EAT_SECONDS, seconds));
  let bite = 0;
  let taken = 0;
  for (const at of EAT_BITES) {
    bite = Math.max(bite, 1 - smoothstep(0, EAT_BITE_HALF_SECONDS, Math.abs(seconds - at)));
    if (seconds >= at) taken += 1;
  }
  return { reach, bite, left: 1 - taken / EAT_BITES.length };
}

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}
