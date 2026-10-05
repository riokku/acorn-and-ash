import { describe, expect, it } from 'vitest';

import {
  ActionKind,
  RiseFrom,
  advanceAction,
  beginAction,
  createActionState,
  dodgeHeading,
  footedInput,
  headingDirection,
  isDown,
  isResting,
  isUntouchable,
  packActionByte,
  unpackActionByte,
  type ActionContext,
  type ActionState,
  type ActionTick,
} from '../src/sim/actions';
import {
  CHARGE_TICKS,
  DODGE,
  FLINCH,
  LIGHT_COMBO,
  RISE,
  SETTLE,
  STRIKE,
  WINDUP_TICKS,
  WindupPace,
} from '../src/data/moves';
import { PlayerButton, createInput } from '../src/sim/player';
import { CHARGE_WALK_SHARE } from '../src/constants';

const ARMED: ActionContext = { canAttack: true, castInstead: false };
const UNARMED: ActionContext = { canAttack: false, castInstead: false };
const AT_THE_WATER: ActionContext = { canAttack: true, castInstead: true };
const ON_THE_GROUND: ActionContext = { canAttack: false, castInstead: false, canSit: true };

/**
 * Feeds inputs one at a time, remembering the buttons on the last one the
 * way the server and the browser both do.
 */
function player(context: ActionContext = ARMED) {
  const state: ActionState = createActionState();
  let previous = 0;
  let seq = 0;
  const feed = (buttons = 0, moveX = 0, moveZ = 0, ctx = context): ActionTick => {
    const input = createInput(++seq, moveX, moveZ, 0, buttons);
    const tick = advanceAction(state, input, previous, ctx);
    previous = buttons;
    return tick;
  };
  /** Feed plain inputs until something lands, and say which input it was on. */
  const untilImpact = (limit = 60): { tick: ActionTick; after: number } => {
    for (let i = 1; i <= limit; i++) {
      const tick = feed();
      if (tick.impact !== null) return { tick, after: i };
    }
    throw new Error('nothing landed');
  };
  return { state, feed, untilImpact };
}

describe('a swing of the light combo', () => {
  it('needs something in hand', () => {
    const { state, feed } = player(UNARMED);
    expect(feed(PlayerButton.Swing)).toEqual({ footing: 'free', impact: null, cast: false });
    expect(state.kind).toBe(ActionKind.Idle);
  });

  it('leaves movement free and lands partway in', () => {
    const { state, feed, untilImpact } = player();
    expect(feed(PlayerButton.Swing).footing).toBe('free');
    expect(state).toMatchObject({ kind: ActionKind.Swing, step: 1, age: 0 });
    const landed = untilImpact();
    expect(landed.after).toBe(LIGHT_COMBO[0].impact);
    expect(landed.tick.impact).toEqual({ kind: 'swing', step: 1 });
  });

  it('keeps movement free for the full swing without cancelling its impact or follow-through', () => {
    const { state, feed } = player();
    expect(feed(PlayerButton.Swing, 0, 1).footing).toBe('free');
    let hits = 0;
    for (let age = 1; age < LIGHT_COMBO[0].end; age++) {
      const tick = feed(0, 0, 1);
      expect(tick.footing).toBe('free');
      expect(state.kind).toBe(ActionKind.Swing);
      if (tick.impact !== null) hits++;
      const input = createInput(age, 0, 1, 0, PlayerButton.Sprint);
      expect(footedInput(input, tick.footing, 0)).toEqual(input);
    }
    expect(hits).toBe(1);
    feed(0, 0, 1);
    expect(state.kind).toBe(ActionKind.Idle);
  });

  it('chains three swings from three clicks, then starts over', () => {
    const { state, feed } = player();
    const landed: number[] = [];
    let clicks = 0;
    for (let i = 0; i < 80 && landed.length < 4; i++) {
      // A fresh click every few inputs: one per swing. Clicking faster than
      // that still only queues the one swing that follows.
      const clicking = i % 6 === 0 && clicks < 4;
      if (clicking) clicks++;
      const tick = feed(clicking ? PlayerButton.Swing : 0);
      if (tick.impact?.kind === 'swing') landed.push(tick.impact.step);
    }
    expect(landed).toEqual([1, 2, 3, 1]);
    expect(state.kind).toBe(ActionKind.Swing);
  });

  it('lets the combo lapse if you stop clicking', () => {
    const { state, feed } = player();
    feed(PlayerButton.Swing);
    for (let i = 1; i <= LIGHT_COMBO[0].end; i++) feed();
    expect(state.kind).toBe(ActionKind.Idle);
    feed(PlayerButton.Swing);
    expect(state).toMatchObject({ kind: ActionKind.Swing, step: 1 });
  });

  it('carries on swinging while the button is held down', () => {
    const { feed } = player();
    const landed: number[] = [];
    for (let i = 0; i < 60; i++) {
      const tick = feed(PlayerButton.Swing);
      if (tick.impact?.kind === 'swing') landed.push(tick.impact.step);
    }
    expect(landed.slice(0, 4)).toEqual([1, 2, 3, 1]);
  });

  it('is cut short by a dodge', () => {
    const { state, feed } = player();
    feed(PlayerButton.Swing);
    feed();
    expect(feed(PlayerButton.Dodge).footing).toBe('dodging');
    expect(state.kind).toBe(ActionKind.Dodge);
  });
});

describe('the rod at the water', () => {
  it('casts on a fresh click instead of swinging', () => {
    const { state, feed } = player(AT_THE_WATER);
    expect(feed(PlayerButton.Swing)).toEqual({ footing: 'free', impact: null, cast: true });
    expect(state.kind).toBe(ActionKind.Idle);
  });

  it('does not swing at the water with the button held down afterwards', () => {
    const { state, feed } = player(AT_THE_WATER);
    feed(PlayerButton.Swing);
    for (let i = 0; i < 10; i++) expect(feed(PlayerButton.Swing).cast).toBe(false);
    expect(state.kind).toBe(ActionKind.Idle);
  });

  it('swings as usual away from the water', () => {
    const { state, feed } = player(ARMED);
    feed(PlayerButton.Swing);
    expect(state.kind).toBe(ActionKind.Swing);
  });
});

describe('a fishing-only click', () => {
  it('casts at water, and never attacks on a late attempt or a held catch click', () => {
    const { state, feed } = player(AT_THE_WATER);
    expect(feed(PlayerButton.Fish).cast).toBe(true);
    expect(state.kind).toBe(ActionKind.Idle);
    for (let i = 0; i < 40; i++) {
      const tick = feed(PlayerButton.Fish, 0, 0, ARMED);
      expect(tick.impact).toBeNull();
      expect(state.kind).toBe(ActionKind.Idle);
    }
    feed();
    feed(PlayerButton.Swing, 0, 0, ARMED);
    expect(state.kind).toBe(ActionKind.Swing);
  });

  it('gives fishing precedence if an input also contains weapon buttons', () => {
    const { state, feed } = player(ARMED);
    feed(PlayerButton.Fish | PlayerButton.Swing | PlayerButton.Charge);
    expect(state.kind).toBe(ActionKind.Idle);
  });
});

describe('a charged strike', () => {
  it('slows you to a creep while it winds up, then plants you to leap and land', () => {
    const { state, feed } = player();
    const footing: string[] = [];
    let landedOn = -1;
    for (let i = 0; i <= CHARGE_TICKS + STRIKE.impact; i++) {
      const tick = feed(i < CHARGE_TICKS ? PlayerButton.Charge : 0, 0, 1);
      footing.push(tick.footing);
      if (tick.impact !== null) {
        expect(tick.impact).toEqual({ kind: 'strike' });
        landedOn = i;
      }
    }
    expect(new Set(footing.slice(0, CHARGE_TICKS))).toEqual(new Set(['creeping']));
    expect(new Set(footing.slice(CHARGE_TICKS))).toEqual(new Set(['planted']));
    expect(landedOn).toBe(CHARGE_TICKS + STRIKE.impact);
    expect(state.kind).toBe(ActionKind.Strike);
  });

  it('holds a fully charged blow without swinging until the button is released', () => {
    const { state, feed } = player();
    for (let i = 0; i < CHARGE_TICKS + 20; i++) {
      expect(feed(PlayerButton.Charge).impact).toBeNull();
      expect(state.kind).toBe(ActionKind.Charge);
    }
    feed();
    expect(state.kind).toBe(ActionKind.Strike);
  });

  it('finishes the full wind-up even when released early', () => {
    const { state, feed } = player();
    feed(PlayerButton.Charge);
    for (let i = 1; i < CHARGE_TICKS; i++) {
      feed();
      expect(state.kind).toBe(ActionKind.Charge);
    }
    feed();
    expect(state.kind).toBe(ActionKind.Strike);
  });

  it('creeps from a swing that has landed too, not just from standing', () => {
    const { feed } = player();
    feed(PlayerButton.Swing);
    for (let i = 1; i <= LIGHT_COMBO[0].impact; i++) feed(PlayerButton.Swing);
    expect(feed(PlayerButton.Charge, 0, 1).footing).toBe('creeping');
  });

  it('follows on from a swing that has landed, if the button is still down', () => {
    const { state, feed } = player();
    feed(PlayerButton.Swing);
    for (let i = 1; i <= LIGHT_COMBO[0].impact; i++) feed(PlayerButton.Swing);
    feed(PlayerButton.Charge);
    expect(state.kind).toBe(ActionKind.Charge);
  });

  it('is a commitment: a dodge will not get you out of the wind-up', () => {
    const { state, feed } = player();
    feed(PlayerButton.Charge);
    feed(PlayerButton.Dodge);
    expect(state.kind).toBe(ActionKind.Charge);
  });

  it('creeps at a share of walking pace, no quicker on a diagonal, never sprinting or jumping', () => {
    const buttons = PlayerButton.Sprint | PlayerButton.Jump | PlayerButton.Charge;
    const straight = footedInput(createInput(1, 0, -1, 0, buttons), 'creeping', 0);
    expect(straight.moveZ).toBeCloseTo(-CHARGE_WALK_SHARE, 5);
    expect(straight.buttons & (PlayerButton.Sprint | PlayerButton.Jump)).toBe(0);
    expect(straight.buttons & PlayerButton.Charge).toBe(PlayerButton.Charge);

    const diagonal = footedInput(createInput(1, 1, -1, 0, buttons), 'creeping', 0);
    expect(Math.hypot(diagonal.moveX, diagonal.moveZ)).toBeCloseTo(CHARGE_WALK_SHARE, 5);
  });
});

describe('a dodge roll', () => {
  it('carries you for its roll, then gives your feet back', () => {
    const { state, feed } = player();
    const footing: string[] = [];
    footing.push(feed(PlayerButton.Dodge).footing);
    for (let i = 1; i < DODGE.end; i++) footing.push(feed().footing);
    expect(footing.filter((entry) => entry === 'dodging')).toHaveLength(DODGE.travel);
    expect(feed().footing).toBe('free');
    expect(state.kind).toBe(ActionKind.Idle);
  });

  it('is untouchable only for the first part of the roll', () => {
    const state = createActionState();
    beginAction(state, ActionKind.Dodge);
    state.age = DODGE.invulnerable - 1;
    expect(isUntouchable(state)).toBe(true);
    state.age = DODGE.invulnerable;
    expect(isUntouchable(state)).toBe(false);
  });

  it('cannot be used again until it has recharged', () => {
    const { state, feed } = player();
    feed(PlayerButton.Dodge);
    for (let i = 1; i <= DODGE.end; i++) feed();
    feed(PlayerButton.Dodge);
    expect(state.kind).toBe(ActionKind.Idle);
    for (let i = 0; i < DODGE.cooldown; i++) feed();
    feed(PlayerButton.Dodge);
    expect(state.kind).toBe(ActionKind.Dodge);
  });

  it('works out the same heading on both sides of the wire, in whole steps', () => {
    // Straight back from an aim of zero (facing -Z) is +Z.
    const back = dodgeHeading(createInput(1, 0, 0, 0, PlayerButton.Dodge));
    const direction = headingDirection(back);
    expect(direction.x).toBeCloseTo(0, 5);
    expect(direction.z).toBeCloseTo(1, 5);
    expect(Number.isInteger(back)).toBe(true);
    // D held with the camera down -Z: to the right, +X.
    const right = headingDirection(dodgeHeading(createInput(1, 1, 0, 0, PlayerButton.Dodge)));
    expect(right.x).toBeCloseTo(1, 5);
  });
});

describe('a flinch', () => {
  it('holds you a moment, then lets you go on', () => {
    const { state, feed } = player();
    beginAction(state, ActionKind.Flinch);
    for (let i = 1; i < FLINCH.planted; i++) expect(feed(0, 0, 1).footing).toBe('planted');
    expect(feed(0, 0, 1).footing).toBe('free');
    expect(state.kind).toBe(ActionKind.Idle);
  });

  it('can be dodged out of straight away', () => {
    const { state, feed } = player();
    beginAction(state, ActionKind.Flinch);
    feed(PlayerButton.Dodge);
    expect(state.kind).toBe(ActionKind.Dodge);
  });
});

describe('resting', () => {
  it('stays put in the chair, however you push, until you ask to get up', () => {
    const { state, feed } = player();
    beginAction(state, ActionKind.Sit);
    expect(feed(PlayerButton.Swing).footing).toBe('still');
    expect(state.kind).toBe(ActionKind.Sit);
    // Moving is asking to get up.
    for (let i = 0; i < SETTLE.earliestUp; i++) feed();
    feed(0, 0, 1);
    expect(state).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Chair });
    for (let i = 1; i < RISE.chair; i++) expect(feed(0, 0, 1).footing).toBe('still');
    expect(feed(0, 0, 1).footing).toBe('free');
  });

  it('gets out of bed on a fresh press of interact', () => {
    const { state, feed } = player();
    beginAction(state, ActionKind.Lie);
    for (let i = 0; i < SETTLE.earliestUp; i++) feed(PlayerButton.Interact);
    expect(state.kind).toBe(ActionKind.Lie);
    feed(0);
    feed(PlayerButton.Interact);
    expect(state).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Bed });
  });

  it('keeps you still and unturning while down', () => {
    const input = createInput(1, 1, 1, 0, PlayerButton.Jump, 2);
    const still = footedInput(input, 'still', 0.5);
    expect(still).toMatchObject({ moveX: 0, moveZ: 0, aimYaw: 0.5 });
    expect(still.buttons & PlayerButton.Jump).toBe(0);
  });
});

describe('sitting on the ground', () => {
  it('sits you down wherever you stand, on a fresh press of the sit button', () => {
    const { state, feed } = player(ON_THE_GROUND);
    expect(feed(PlayerButton.Sit).footing).toBe('still');
    expect(state.kind).toBe(ActionKind.SitGround);
    expect(isResting(state)).toBe(true);
  });

  it('does nothing when there is no ground to sit on, or a line in the water', () => {
    const { state, feed } = player({ canAttack: false, castInstead: false, canSit: false });
    feed(PlayerButton.Sit);
    expect(state.kind).toBe(ActionKind.Idle);
    const unspecified = player(UNARMED);
    unspecified.feed(PlayerButton.Sit);
    expect(unspecified.state.kind).toBe(ActionKind.Idle);
  });

  it('sits you down holding something, too, without swinging it', () => {
    const { state, feed } = player({ canAttack: true, castInstead: false, canSit: true });
    feed(PlayerButton.Sit | PlayerButton.Swing);
    expect(state.kind).toBe(ActionKind.SitGround);
  });

  it('stays put while sat, however you push, until you ask to get up', () => {
    const { state, feed } = player(ON_THE_GROUND);
    feed(PlayerButton.Sit);
    expect(feed(PlayerButton.Swing | PlayerButton.Sit).footing).toBe('still');
    expect(state.kind).toBe(ActionKind.SitGround);
  });

  it('gets you up with a second press of the sit button, once you have settled', () => {
    const { state, feed } = player(ON_THE_GROUND);
    feed(PlayerButton.Sit);
    // Held down past the first tick, it is still the same press.
    for (let i = 0; i < SETTLE.earliestUp + 2; i++) feed(PlayerButton.Sit);
    expect(state.kind).toBe(ActionKind.SitGround);
    feed(0);
    feed(PlayerButton.Sit);
    expect(state).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Sat });
    for (let i = 1; i < RISE.floor; i++) expect(feed().footing).toBe('still');
    expect(feed().footing).toBe('free');
    expect(state.kind).toBe(ActionKind.Idle);
  });

  it('does not get you up again on the very tick you sat down', () => {
    const { state, feed } = player(ON_THE_GROUND);
    feed(PlayerButton.Sit);
    feed(0);
    feed(PlayerButton.Sit);
    expect(state.kind).toBe(ActionKind.SitGround);
  });

  it.each([
    ['moving', 0, 0, 1],
    ['a fresh press of interact', PlayerButton.Interact, 0, 0],
    ['a jump', PlayerButton.Jump, 0, 0],
  ])('gets you up when you ask by %s', (_how, buttons, moveX, moveZ) => {
    const { state, feed } = player(ON_THE_GROUND);
    feed(PlayerButton.Sit);
    for (let i = 0; i < SETTLE.earliestUp; i++) feed();
    feed(buttons, moveX, moveZ);
    expect(state).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Sat });
  });

  it('is not sat down again by a button still held from getting up', () => {
    const { state, feed } = player(ON_THE_GROUND);
    feed(PlayerButton.Sit);
    for (let i = 0; i < SETTLE.earliestUp; i++) feed();
    feed(0, 0, 1);
    for (let i = 0; i < RISE.floor; i++) feed(PlayerButton.Sit, 0, 1);
    expect(state.kind).toBe(ActionKind.Idle);
  });

  it('gives way to a dodge, and cannot start mid-swing', () => {
    const rolling = player(ON_THE_GROUND);
    rolling.feed(PlayerButton.Sit | PlayerButton.Dodge);
    expect(rolling.state.kind).toBe(ActionKind.Dodge);

    const swinging = player({ canAttack: true, castInstead: false, canSit: true });
    swinging.feed(PlayerButton.Swing);
    swinging.feed(PlayerButton.Sit);
    expect(swinging.state.kind).toBe(ActionKind.Swing);
  });

  it('leaves you touchable and not down, sat or getting up, unlike a knockout', () => {
    const { state, feed } = player(ON_THE_GROUND);
    feed(PlayerButton.Sit);
    expect(isDown(state)).toBe(false);
    expect(isUntouchable(state)).toBe(false);
    for (let i = 0; i < SETTLE.earliestUp; i++) feed();
    feed(0, 0, 1);
    expect(state).toMatchObject({ kind: ActionKind.Rise, step: RiseFrom.Sat });
    expect(isDown(state)).toBe(false);
    expect(isUntouchable(state)).toBe(false);

    const knockedOut = createActionState();
    beginAction(knockedOut, ActionKind.KnockedOut);
    expect(isDown(knockedOut)).toBe(true);
    for (const from of [RiseFrom.Ground, RiseFrom.Bed]) {
      const rising = createActionState();
      beginAction(rising, ActionKind.Rise, from);
      expect(isDown(rising)).toBe(true);
      expect(isUntouchable(rising)).toBe(true);
    }
    const outOfTheChair = createActionState();
    beginAction(outOfTheChair, ActionKind.Rise, RiseFrom.Chair);
    expect(isDown(outOfTheChair)).toBe(false);
  });

  it('travels on the wire, sitting and getting up', () => {
    const state = createActionState();
    beginAction(state, ActionKind.SitGround);
    expect(unpackActionByte(packActionByte(state), createActionState())).toMatchObject({
      kind: ActionKind.SitGround,
    });
    beginAction(state, ActionKind.Rise, RiseFrom.Sat);
    expect(unpackActionByte(packActionByte(state), createActionState())).toMatchObject({
      kind: ActionKind.Rise,
      step: RiseFrom.Sat,
    });
  });
});

describe('a wind-up', () => {
  it('draws back for its pace, then swings the light combo', () => {
    for (const pace of [WindupPace.Steady, WindupPace.Quick, WindupPace.Heavy]) {
      const { state, feed } = player();
      beginAction(state, ActionKind.Windup, pace);
      const ticks = WINDUP_TICKS[pace];
      for (let i = 1; i < ticks; i++) {
        expect(feed(0, 0, 1).footing).toBe('creeping');
        expect(state.kind).toBe(ActionKind.Windup);
      }
      expect(feed().footing).toBe('planted');
      expect(state).toMatchObject({ kind: ActionKind.Swing, step: 1 });
    }
  });

  it('lands no blow of its own, only the swing it leads into', () => {
    const { state, untilImpact } = player();
    beginAction(state, ActionKind.Windup, WindupPace.Steady);
    const { tick, after } = untilImpact();
    expect(tick.impact).toEqual({ kind: 'swing', step: 1 });
    expect(after).toBe(WINDUP_TICKS[WindupPace.Steady] + LIGHT_COMBO[0].impact);
  });

  it('takes longer for a heavy hitter than a quick one', () => {
    expect(WINDUP_TICKS[WindupPace.Heavy]).toBeGreaterThan(WINDUP_TICKS[WindupPace.Steady]);
    expect(WINDUP_TICKS[WindupPace.Steady]).toBeGreaterThan(WINDUP_TICKS[WindupPace.Quick]);
  });

  it('travels on the wire with its pace', () => {
    const state = createActionState();
    beginAction(state, ActionKind.Windup, WindupPace.Heavy);
    const unpacked = unpackActionByte(packActionByte(state), createActionState());
    expect(unpacked).toMatchObject({ kind: ActionKind.Windup, step: WindupPace.Heavy });
  });
});

describe('the move on the wire', () => {
  it('packs kind, step and queue into a byte and back', () => {
    const state = createActionState();
    beginAction(state, ActionKind.Swing, 3);
    state.queued = true;
    const unpacked = unpackActionByte(packActionByte(state), createActionState());
    expect(unpacked).toMatchObject({ kind: ActionKind.Swing, step: 3, queued: true });
  });

  it('reads anything it does not know as standing idle', () => {
    expect(unpackActionByte(0x1f, createActionState()).kind).toBe(ActionKind.Idle);
  });
});
