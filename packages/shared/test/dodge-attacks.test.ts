import { expect, it } from 'vitest';
import {
  WorldSimulation,
  ActionKind,
  DODGE,
  DODGE_ATTACKS,
  PlayerButton,
  advanceAction,
  beginAction,
  createActionState,
  createInput,
  createPlayerMotion,
  createFlatTerrain,
  createCollisionWorld,
  box,
  isUntouchable,
  packActionByte,
  unpackActionByte,
  stepDodgeAttack,
} from '../src/index';
const armed = { canAttack: true, castInstead: false };
it.each([
  ['light', PlayerButton.Swing, ActionKind.DodgeLight],
  ['heavy', PlayerButton.Charge, ActionKind.DodgeHeavy],
] as const)(
  'starts the %s hop only from a fresh press during a dodge and lands one blow',
  (kind, button, action) => {
    const state = createActionState();
    beginAction(state, ActionKind.Dodge);
    state.age = 2;
    state.dodgeCooldown = 20;
    expect(advanceAction(state, createInput(1, 0, 0, 0, button), 0, armed).footing).toBe('aerial');
    expect(state.kind).toBe(action);
    expect(isUntouchable(state)).toBe(false);
    expect(state.dodgeCooldown).toBe(19);
    const hits = [];
    for (let i = 1; i <= DODGE_ATTACKS[kind].end; i++) {
      const tick = advanceAction(
        state,
        createInput(i + 1, 0, 0, 0, button | PlayerButton.Dodge),
        button | PlayerButton.Dodge,
        armed,
      );
      if (tick.impact) hits.push({ age: i, impact: tick.impact });
    }
    expect(hits).toEqual([
      {
        age: DODGE_ATTACKS[kind].impact,
        impact:
          kind === 'heavy'
            ? { kind: 'strike', dodge: true }
            : { kind: 'swing', step: 3, dodge: true },
      },
    ]);
    expect(state.kind).toBe(ActionKind.Idle);
    expect(
      unpackActionByte(packActionByte({ ...state, kind: action }), createActionState()).kind,
    ).toBe(action);
  },
);
it('refuses pre-held, late, fishing, unarmed and enemy combo requests', () => {
  for (const [age, previous, context] of [
    [2, PlayerButton.Swing, armed],
    [DODGE.end - 1, 0, armed],
    [2, 0, { ...armed, canAttack: false }],
    [2, 0, { ...armed, castInstead: true }],
    [2, 0, { ...armed, canDodgeAttack: false }],
  ] as const) {
    const state = createActionState();
    beginAction(state, ActionKind.Dodge);
    state.age = age;
    advanceAction(state, createInput(1, 0, 0, 0, PlayerButton.Swing), previous, context);
    expect(state.kind).not.toBe(ActionKind.DodgeLight);
  }
});
it('hops toward the aim, lands exactly once, and respects a tall wall', () => {
  const world = createCollisionWorld(createFlatTerrain(0), []),
    state = createActionState();
  beginAction(state, ActionKind.DodgeHeavy);
  state.heading = 128;
  const motion = createPlayerMotion({ x: 0, y: 0, z: 0 });
  let apex = 0;
  for (let age = 0; age <= DODGE_ATTACKS.heavy.land; age++) {
    state.age = age;
    stepDodgeAttack(motion, state, world);
    apex = Math.max(apex, motion.position.y);
  }
  expect(apex).toBeGreaterThan(1.5);
  expect(motion.position.y).toBe(0);
  expect(motion.grounded).toBe(true);
  expect(motion.position.z).toBeCloseTo(-DODGE_ATTACKS.heavy.distance);
  expect(motion.velocity).toEqual({ x: 0, y: 0, z: 0 });
  const blocked = createCollisionWorld(createFlatTerrain(0), [box(0, 3, -0.6, 3, 3, 0.1)]),
    other = createPlayerMotion({ x: 0, y: 0, z: 0 });
  for (let age = 0; age <= DODGE_ATTACKS.heavy.land; age++) {
    state.age = age;
    stepDodgeAttack(other, state, blocked);
  }
  expect(other.position.z).toBeGreaterThan(-0.5);
  expect(other.position.y).toBe(0);
});

it('ends protection at the follow-up while honoring a hit from the earlier dodge', () => {
  const sim = new WorldSimulation({ seed: 123, hungerEmptyAfterSeconds: Infinity });
  try {
    sim.addPlayer(1, undefined, 'fighter');
    Object.assign(sim.inventoryOf(1), { axe: 1 });
    sim.useItem(1, 'axe');
    sim.placePlayer(1, { x: 0, y: 0, z: 10 }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Dodge));
    sim.step(0);
    const duringDodge = sim.tick;
    sim.queueInput(1, createInput(2, 0, 0, 0, PlayerButton.Swing));
    sim.step(50);
    const hits = sim as unknown as {
      raiderStrikesPlayer(id: number, damage: number, impactTick: number): void;
    };
    hits.raiderStrikesPlayer(1, 5, duringDodge);
    expect(sim.healthOf(1)).toBe(100);
    hits.raiderStrikesPlayer(1, 5, sim.tick);
    expect(sim.healthOf(1)).toBe(95);
  } finally {
    sim.dispose();
  }
});
