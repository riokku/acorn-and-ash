/**
 * What a character is busy doing, move by move: a swing of the light combo,
 * winding up and landing a charged strike, a dodge roll, a flinch, being
 * knocked out and getting back up, sitting in the chair or lying in bed.
 *
 * The browser runs this for its own player on every input, the moment it
 * is made, and the server runs the very same thing as the authority - the
 * same arrangement `stepPlayer` has for walking. That is what lets a swing
 * start the instant you click, plant your feet and land on time, without the
 * server and the browser ever disagreeing about where you are.
 *
 * Only inputs move it on, one tick per input, never the passing of time on
 * its own: a player whose packets are late is simply late to finish their
 * swing, the same as they are late to finish their walk. Starting a knockout,
 * a flinch, or sitting down is the server's call alone (see `WorldSimulation`);
 * everything that follows from an input is decided here.
 */

import {
  CHARGE_WALK_SHARE,
  DODGE_DISTANCE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_TURN_RATE,
  TICK_SECONDS,
} from '../constants';
import {
  CHARGE_TICKS,
  DODGE_ATTACKS,
  DODGE,
  FLINCH,
  LIGHT_COMBO,
  RISE,
  SETTLE,
  STRIKE,
  WINDUP_TICKS,
  type ComboSwing,
} from '../data/moves';
import { resolveCapsule, type CollisionWorld } from '../collision/capsule';
import { rotateToward } from '../math/angles';
import type { ItemId } from '../data/items';
import { PlayerButton, worldMoveDirection, type PlayerInput, type PlayerMotion } from './player';

export const ActionKind = {
  /** Free to do anything. */
  Idle: 0,
  /** A swing of the light combo; `step` says which, 1 to 3. */
  Swing: 1,
  /** Winding up a charged strike, rooted to the spot. */
  Charge: 2,
  /** The charged strike itself. */
  Strike: 3,
  /** Rolling along `heading`. */
  Dodge: 4,
  /** Just took a hit. */
  Flinch: 5,
  /** Down, until the server wakes them up at home. */
  KnockedOut: 6,
  /** Getting back up; `step` says from where (see `RiseFrom`). */
  Rise: 7,
  /** Sitting in the chair. */
  Sit: 8,
  /** Lying in bed. */
  Lie: 9,
  /**
   * A raider drawing back before the first swing of a combo, so it is plain
   * to see coming; `step` says how quickly (see `WindupPace`). Creeping in,
   * weapon raised, and then straight into that swing. Nothing a player does
   * ever starts one: only a raider's own brain does (see `sim/raids.ts`).
   */
  Windup: 10,
  /** A rising spin slash started during a dodge. */
  DodgeLight: 11,
  /** A somersault slam started during a dodge. */
  DodgeHeavy: 12,
  /**
   * Sat in a rowboat, rowing it: the rider's position is the middle of the
   * boat (see `sim/rowing.ts`). Climbing in and out is the server's call
   * alone, like sitting down.
   */
  Row: 13,
  /**
   * Sat on the ground, wherever they happened to be standing. Unlike `Sit`
   * there is no chair to settle into: the player starts it themselves, with
   * the sit button, from any ground they are standing on.
   */
  SitGround: 14,
} as const;
export type ActionKind = (typeof ActionKind)[keyof typeof ActionKind];

/** Where a `Rise` gets up from. `Sat` is up from sitting on the ground (`SitGround`). */
export const RiseFrom = { Ground: 0, Bed: 1, Chair: 2, Sat: 3 } as const;
export type RiseFrom = (typeof RiseFrom)[keyof typeof RiseFrom];

/** Everything about a move in progress. Small on purpose: it all travels in a snapshot. */
export interface ActionState {
  kind: ActionKind;
  /** Which swing of the combo, or where a rise gets up from. Zero otherwise. */
  step: number;
  /** Inputs since it began, the one it began on being zero. Stops counting at 255. */
  age: number;
  /** Another swing has been asked for, to follow this one. */
  queued: boolean;
  /**
   * Which way a dodge or its follow-up carries you, in 256ths of a turn (see `headingDirection`)
   * - whole steps, so the server and the browser work it out alike.
   */
  heading: number;
  /** Inputs to go before another dodge. */
  dodgeCooldown: number;
}

export const MAX_ACTION_AGE = 255;
export const HEADING_STEPS = 256;

export function createActionState(): ActionState {
  return { kind: ActionKind.Idle, step: 0, age: 0, queued: false, heading: 0, dodgeCooldown: 0 };
}

export function copyActionState(from: Readonly<ActionState>, into: ActionState): ActionState {
  into.kind = from.kind;
  into.step = from.step;
  into.age = from.age;
  into.queued = from.queued;
  into.heading = from.heading;
  into.dodgeCooldown = from.dodgeCooldown;
  return into;
}

/** Start a move from scratch, keeping only the dodge cooldown. */
export function beginAction(state: ActionState, kind: ActionKind, step = 0): void {
  state.kind = kind;
  state.step = step;
  state.age = 0;
  state.queued = false;
}

/** What the rest of a tick needs to know about the player's situation, to decide a move. */
export interface ActionContext {
  /** Holding something to swing, outdoors, with no line in the water. */
  readonly canAttack: boolean;
  /** Raiders retain their existing moves. */
  readonly canDodgeAttack?: boolean;
  /** A preparation benefit changes recovery, never the invulnerable window. */
  readonly dodgeCooldown?: number;
  /** The rod is out and there is water in front: a fresh click casts instead of swinging. */
  readonly castInstead: boolean;
  /**
   * Free to sit down right here: on the ground, not in the air, with no line
   * in the water. Left out, it is no.
   */
  readonly canSit?: boolean;
}

/**
 * How the player's feet behave this tick.
 *
 * - `free`: walking as usual.
 * - `creeping`: walking at `CHARGE_WALK_SHARE` of the usual pace, with no
 *   sprinting or jumping - winding up a charged attack.
 * - `planted`: no walking or jumping, but still turning to face their aim.
 * - `still`: no walking, jumping or turning - sitting, lying, down, getting up.
 * - `dodging`: carried along the dodge instead of walking (see `stepDodge`).
 * - `rowing`: carried by the boat instead of walking (see `stepBoat`).
 */
export type Footing = 'free' | 'creeping' | 'planted' | 'still' | 'dodging' | 'aerial' | 'rowing';

/** A blow landing on this tick. */
export type Impact =
  | { readonly kind: 'swing'; readonly step: 1 | 2 | 3; readonly dodge?: true }
  | { readonly kind: 'strike'; readonly dodge?: true };

export interface ActionTick {
  readonly footing: Footing;
  readonly impact: Impact | null;
  /** A fresh click that casts a line rather than swinging. */
  readonly cast: boolean;
}

const FREE: ActionTick = { footing: 'free', impact: null, cast: false };

/**
 * Move `state` on by one input. `previousButtons` are the buttons on the
 * input before this one, to tell a fresh press from one still held down.
 */
export function advanceAction(
  state: ActionState,
  input: Readonly<PlayerInput>,
  previousButtons: number,
  context: ActionContext,
): ActionTick {
  if ((input.buttons & PlayerButton.Fish) !== 0) {
    input = { ...input, buttons: input.buttons & ~(PlayerButton.Swing | PlayerButton.Charge) };
  }
  if (state.dodgeCooldown > 0) state.dodgeCooldown -= 1;
  if (state.kind !== ActionKind.Idle && state.age < MAX_ACTION_AGE) state.age += 1;

  const held = (button: number): boolean => (input.buttons & button) !== 0;
  const fresh = (button: number): boolean => held(button) && (previousButtons & button) === 0;
  const moving = input.moveX !== 0 || input.moveZ !== 0;

  const tryDodge = (): ActionTick | null => {
    if (!held(PlayerButton.Dodge) || state.dodgeCooldown > 0) return null;
    beginAction(state, ActionKind.Dodge);
    state.heading = dodgeHeading(input);
    state.dodgeCooldown = context.dodgeCooldown ?? DODGE.cooldown;
    return { footing: 'dodging', impact: null, cast: false };
  };

  switch (state.kind) {
    case ActionKind.Idle:
      return startFromIdle(state, input, previousButtons, context, tryDodge);

    case ActionKind.Swing: {
      const swing = comboSwing(state.step);
      if (fresh(PlayerButton.Fish) && context.castInstead && state.age > swing.impact) {
        beginAction(state, ActionKind.Idle);
        return { footing: 'free', impact: null, cast: true };
      }
      if (fresh(PlayerButton.Swing)) {
        if (!context.castInstead) state.queued = true;
        else if (state.age > swing.impact) {
          // Water decides, even mid-swing: once this one has landed, a
          // click at the water casts rather than swinging again.
          beginAction(state, ActionKind.Idle);
          return { footing: 'free', impact: null, cast: true };
        }
      }
      const dodged = tryDodge();
      if (dodged !== null) return dodged;
      // Holding on past the click, once this swing has landed, winds up a charge.
      if (held(PlayerButton.Charge) && context.canAttack && state.age > swing.impact) {
        beginAction(state, ActionKind.Charge);
        return { footing: 'creeping', impact: null, cast: false };
      }
      const impact: Impact | null =
        state.age === swing.impact ? { kind: 'swing', step: swingStep(state.step) } : null;
      if (state.queued && state.step < 3 && state.age >= swing.chain) {
        beginAction(state, ActionKind.Swing, state.step + 1);
        return { footing: 'free', impact, cast: false };
      }
      if (state.age >= swing.end) {
        // A button still held, or a click during the finishing chop, carries
        // straight on; otherwise the combo is over.
        if ((held(PlayerButton.Swing) || state.queued) && context.canAttack) {
          beginAction(state, ActionKind.Swing, state.step < 3 ? state.step + 1 : 1);
          return { footing: 'free', impact, cast: false };
        }
        beginAction(state, ActionKind.Idle);
        return { footing: 'free', impact, cast: false };
      }
      return { footing: 'free', impact, cast: false };
    }

    case ActionKind.Charge:
      // Hold the prepared blow until release. An early release still finishes
      // the wind-up, so a strong attack always pays its full preparation cost.
      if (state.age >= CHARGE_TICKS && !held(PlayerButton.Charge)) {
        beginAction(state, ActionKind.Strike);
        return { footing: 'planted', impact: null, cast: false };
      }
      return { footing: 'creeping', impact: null, cast: false };

    case ActionKind.Strike: {
      const impact: Impact | null = state.age === STRIKE.impact ? { kind: 'strike' } : null;
      if (state.age > STRIKE.impact) {
        const dodged = tryDodge();
        if (dodged !== null) return dodged;
      }
      if (state.age >= STRIKE.end || (state.age >= STRIKE.planted && moving)) {
        beginAction(state, ActionKind.Idle);
        return { footing: 'free', impact, cast: false };
      }
      return { footing: state.age < STRIKE.planted ? 'planted' : 'free', impact, cast: false };
    }

    case ActionKind.Dodge:
      if (
        state.age < DODGE.end &&
        context.canAttack &&
        context.canDodgeAttack !== false &&
        !context.castInstead
      ) {
        const heavy = fresh(PlayerButton.Charge);
        if (heavy || fresh(PlayerButton.Swing)) {
          beginAction(state, heavy ? ActionKind.DodgeHeavy : ActionKind.DodgeLight);
          // Keep the original dodge path. Attack aiming must never redirect travel.
          return { footing: 'aerial', impact: null, cast: false };
        }
      }
      if (state.age < DODGE.travel) return { footing: 'dodging', impact: null, cast: false };
      if (state.age >= DODGE.end) {
        beginAction(state, ActionKind.Idle);
        return startFromIdle(state, input, previousButtons, context, tryDodge);
      }
      return { footing: 'planted', impact: null, cast: false };

    case ActionKind.DodgeLight:
    case ActionKind.DodgeHeavy: {
      const heavy = state.kind === ActionKind.DodgeHeavy;
      const move = heavy ? DODGE_ATTACKS.heavy : DODGE_ATTACKS.light;
      const impact: Impact | null =
        state.age === move.impact
          ? heavy
            ? { kind: 'strike', dodge: true }
            : { kind: 'swing', step: 3, dodge: true }
          : null;
      if (state.age >= move.end) {
        beginAction(state, ActionKind.Idle);
        return { footing: 'free', impact, cast: false };
      }
      return { footing: state.age <= move.land ? 'aerial' : 'free', impact, cast: false };
    }

    case ActionKind.Flinch: {
      const dodged = tryDodge();
      if (dodged !== null) return dodged;
      if (state.age < FLINCH.planted) return { footing: 'planted', impact: null, cast: false };
      if (
        state.age >= FLINCH.end ||
        moving ||
        held(PlayerButton.Swing) ||
        held(PlayerButton.Charge)
      ) {
        beginAction(state, ActionKind.Idle);
        return startFromIdle(state, input, previousButtons, context, tryDodge);
      }
      return FREE;
    }

    case ActionKind.Windup:
      // Committed, like a charge: only a hit stops it.
      if (state.age >= windupTicks(state.step)) {
        beginAction(state, ActionKind.Swing, 1);
        return { footing: 'planted', impact: null, cast: false };
      }
      return { footing: 'creeping', impact: null, cast: false };

    case ActionKind.KnockedOut:
      return { footing: 'still', impact: null, cast: false };

    case ActionKind.Rise: {
      const length =
        state.step === RiseFrom.Chair
          ? RISE.chair
          : state.step === RiseFrom.Sat
            ? RISE.floor
            : state.step === RiseFrom.Bed
              ? RISE.bed
              : RISE.ground;
      if (state.age < length) return { footing: 'still', impact: null, cast: false };
      beginAction(state, ActionKind.Idle);
      return startFromIdle(state, input, previousButtons, context, tryDodge);
    }

    case ActionKind.Row:
      // Nothing to swing, roll or cast from a boat; only the server says when
      // the rider climbs out.
      return { footing: 'rowing', impact: null, cast: false };

    case ActionKind.Sit:
    case ActionKind.Lie:
    case ActionKind.SitGround: {
      // On the ground the sit button gets you up again, as it sat you down.
      const wantsUp =
        moving ||
        fresh(PlayerButton.Interact) ||
        fresh(PlayerButton.Jump) ||
        (state.kind === ActionKind.SitGround && fresh(PlayerButton.Sit));
      if (wantsUp && state.age >= SETTLE.earliestUp) {
        beginAction(
          state,
          ActionKind.Rise,
          state.kind === ActionKind.Sit
            ? RiseFrom.Chair
            : state.kind === ActionKind.SitGround
              ? RiseFrom.Sat
              : RiseFrom.Bed,
        );
      }
      return { footing: 'still', impact: null, cast: false };
    }
  }
  return FREE;
}

function startFromIdle(
  state: ActionState,
  input: Readonly<PlayerInput>,
  previousButtons: number,
  context: ActionContext,
  tryDodge: () => ActionTick | null,
): ActionTick {
  const held = (button: number): boolean => (input.buttons & button) !== 0;
  const freshSwing = held(PlayerButton.Swing) && (previousButtons & PlayerButton.Swing) === 0;

  const dodged = tryDodge();
  if (dodged !== null) return dodged;
  if (
    held(PlayerButton.Sit) &&
    (previousButtons & PlayerButton.Sit) === 0 &&
    context.canSit === true
  ) {
    beginAction(state, ActionKind.SitGround);
    return { footing: 'still', impact: null, cast: false };
  }
  if (!context.canAttack) return FREE;
  if (held(PlayerButton.Fish)) {
    const freshFish = (previousButtons & PlayerButton.Fish) === 0;
    return freshFish && context.castInstead ? { footing: 'free', impact: null, cast: true } : FREE;
  }
  if (held(PlayerButton.Charge)) {
    beginAction(state, ActionKind.Charge);
    return { footing: 'creeping', impact: null, cast: false };
  }
  if (!held(PlayerButton.Swing)) return FREE;
  if (context.castInstead) {
    // Water decides: a fresh click with the rod out casts. Holding the
    // button down afterwards does nothing at all, rather than swinging the
    // rod at the pond once the line is out.
    return freshSwing ? { footing: 'free', impact: null, cast: true } : FREE;
  }
  beginAction(state, ActionKind.Swing, 1);
  return { footing: 'free', impact: null, cast: false };
}

/** How long a wind-up of this `step` (its `WindupPace`) lasts, in ticks. */
export function windupTicks(step: number): number {
  return WINDUP_TICKS[Math.min(Math.max(step, 0), WINDUP_TICKS.length - 1)] ?? WINDUP_TICKS[0];
}

function comboSwing(step: number): ComboSwing {
  return LIGHT_COMBO[Math.min(Math.max(step, 1), 3) - 1] ?? LIGHT_COMBO[0];
}

function swingStep(step: number): 1 | 2 | 3 {
  return step <= 1 ? 1 : step === 2 ? 2 : 3;
}

/**
 * Which way a dodge rolls, as a whole number of 256ths of a turn: whatever
 * direction is held, relative to the camera, the same as walking - or
 * straight back, away from the aim, if nothing is.
 */
export function dodgeHeading(input: Readonly<PlayerInput>): number {
  const held = worldMoveDirection(input.moveX, input.moveZ, input.yaw);
  const dx = held.x !== 0 || held.z !== 0 ? held.x : Math.sin(input.aimYaw);
  const dz = held.x !== 0 || held.z !== 0 ? held.z : Math.cos(input.aimYaw);
  const turns = Math.atan2(dx, dz) / (Math.PI * 2);
  return ((Math.round(turns * HEADING_STEPS) % HEADING_STEPS) + HEADING_STEPS) % HEADING_STEPS;
}

/** The world direction a heading points, the way `dodgeHeading` measures it. */
export function headingDirection(heading: number): { x: number; z: number } {
  const angle = (heading / HEADING_STEPS) * Math.PI * 2;
  return { x: Math.sin(angle), z: Math.cos(angle) };
}

/** How fast a dodge carries you, so it covers `DODGE_DISTANCE` over its roll. */
export const DODGE_SPEED = DODGE_DISTANCE / (DODGE.travel * TICK_SECONDS);

/**
 * One tick of a dodge roll: carried along its heading at `DODGE_SPEED`, kept
 * out of anything solid, and on the ground throughout. Facing is left alone,
 * so rolling back still faces whatever you were facing. The last tick of
 * the roll stops dead rather than sliding on.
 */
export function stepDodge(
  motion: PlayerMotion,
  state: Readonly<ActionState>,
  world: CollisionWorld,
): void {
  const direction = headingDirection(state.heading);
  const { position, velocity } = motion;
  velocity.x = direction.x * DODGE_SPEED;
  velocity.y = 0;
  velocity.z = direction.z * DODGE_SPEED;
  position.x += velocity.x * TICK_SECONDS;
  position.z += velocity.z * TICK_SECONDS;
  resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
  position.y = world.terrain.heightAt(position.x, position.z);
  motion.grounded = true;
  if (state.age >= DODGE.travel - 1) {
    velocity.x = 0;
    velocity.z = 0;
  }
}

/**
 * The input walking actually sees, given how the feet are this tick: only a
 * creep while winding up, no walking or jumping once they are planted, and
 * not even turning once still.
 */
export function footedInput(
  input: Readonly<PlayerInput>,
  footing: Footing,
  facingYaw: number,
): PlayerInput {
  if (footing === 'free') return input;
  const buttons = input.buttons & ~(PlayerButton.Jump | PlayerButton.Sprint);
  if (footing === 'creeping') {
    // Scaled after evening out a diagonal, so a creep is no quicker that way.
    const length = Math.sqrt(input.moveX * input.moveX + input.moveZ * input.moveZ);
    const share = CHARGE_WALK_SHARE / Math.max(1, length);
    return { ...input, moveX: input.moveX * share, moveZ: input.moveZ * share, buttons };
  }
  if (footing === 'still') {
    return { ...input, moveX: 0, moveZ: 0, buttons, aimYaw: facingYaw };
  }
  return { ...input, moveX: 0, moveZ: 0, buttons };
}

/**
 * Whether they are down: knocked out, or getting back up after it (or out of
 * bed). Raiders leave somebody down alone. Getting up out of a chair, or up
 * from sitting on the ground, is nothing like it: they are only sat there.
 */
export function isDown(state: Readonly<ActionState>): boolean {
  if (state.kind === ActionKind.KnockedOut) return true;
  return (
    state.kind === ActionKind.Rise &&
    (state.step === RiseFrom.Ground || state.step === RiseFrom.Bed)
  );
}

/** Whether a hit simply misses right now: mid-roll, or down, or getting up after being down. */
export function isUntouchable(state: Readonly<ActionState>): boolean {
  if (state.kind === ActionKind.Dodge) return state.age < DODGE.invulnerable;
  return isDown(state);
}

/** Whether they are sitting, lying or getting up: nothing else is theirs to do. */
export function isResting(state: Readonly<ActionState>): boolean {
  return (
    state.kind === ActionKind.Sit ||
    state.kind === ActionKind.SitGround ||
    state.kind === ActionKind.Lie ||
    state.kind === ActionKind.KnockedOut ||
    state.kind === ActionKind.Rise
  );
}

/** Whether they are free to pick something up, eat, or reach for something. */
export function isFreeToInteract(state: Readonly<ActionState>): boolean {
  return state.kind === ActionKind.Idle;
}

/** One byte for kind, step and queue, the way it travels in a snapshot. */
export function packActionByte(state: Readonly<ActionState>): number {
  return (state.kind & 0x1f) | ((state.step & 0x3) << 5) | (state.queued ? 0x80 : 0);
}

export function unpackActionByte(byte: number, into: ActionState): ActionState {
  const kind = byte & 0x1f;
  into.kind = kind <= ActionKind.SitGround ? (kind as ActionKind) : ActionKind.Idle;
  into.step = (byte >> 5) & 0x3;
  into.queued = (byte & 0x80) !== 0;
  return into;
}

/**
 * Something a player just did with their hands that is over in a moment
 * and changes nothing about where they can go: picking something up,
 * digging up a cache, reaching out to light a fire or build, eating. The
 * server says so to everybody nearby, and every browser plays it on that
 * player (see decision 0056). A dodge, a swing or sitting down are moves,
 * not gestures: those travel in every snapshot instead.
 */
export const Gesture = { PickUp: 0, Dig: 1, Reach: 2, Eat: 3 } as const;
export type Gesture = (typeof Gesture)[keyof typeof Gesture];
export const GESTURE_COUNT = 4;

export interface GestureEvent {
  readonly netId: number;
  readonly gesture: Gesture;
  /** What was picked up or eaten, to show in hand; null when it does not matter. */
  readonly item: ItemId | null;
}

/** A predictable, collision-checked hop shared by prediction and the server. */
export function stepDodgeAttack(
  motion: PlayerMotion,
  state: Readonly<ActionState>,
  world: CollisionWorld,
  aimYaw = motion.facingYaw,
): void {
  const move = state.kind === ActionKind.DodgeHeavy ? DODGE_ATTACKS.heavy : DODGE_ATTACKS.light;
  const direction = headingDirection(state.heading);
  motion.facingYaw = rotateToward(motion.facingYaw, aimYaw, PLAYER_TURN_RATE * TICK_SECONDS);
  const progress = Math.min(1, state.age / move.land);
  const height = 4 * move.height * progress * (1 - progress);
  const oldY = motion.position.y;
  // Carry the actual roll velocity rather than restarting a preset hop. The
  // linear envelope can resume from snapshot velocity at any airborne tick.
  const carried = Math.max(0, motion.velocity.x * direction.x + motion.velocity.z * direction.z);
  const remaining = Math.max(0, move.land - state.age);
  const speed =
    state.age === 0
      ? Math.min(DODGE_SPEED, carried)
      : (Math.min(DODGE_SPEED, carried) * remaining) / (remaining + 1);
  motion.velocity.x = direction.x * speed;
  motion.velocity.z = direction.z * speed;
  motion.position.x += motion.velocity.x * TICK_SECONDS;
  motion.position.z += motion.velocity.z * TICK_SECONDS;
  motion.position.y = world.terrain.heightAt(motion.position.x, motion.position.z) + height;
  resolveCapsule(motion.position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
  motion.velocity.y = (motion.position.y - oldY) / TICK_SECONDS;
  motion.grounded = state.age >= move.land;
  if (motion.grounded) motion.velocity.x = motion.velocity.y = motion.velocity.z = 0;
}
