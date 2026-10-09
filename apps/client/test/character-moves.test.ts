import { describe, expect, it } from 'vitest';

import {
  ActionKind,
  CHARGE_TICKS,
  DIG_SWING,
  DODGE,
  LIGHT_COMBO,
  RISE,
  RiseFrom,
  SETTLE,
  STRIKE,
  TICK_SECONDS,
  WINDUP_TICKS,
  WindupPace,
} from '@acorn/shared';

import {
  EAT_BITES,
  EAT_SECONDS,
  WINDUP_PEAK_SECONDS,
  clipBlowSeconds,
  eatingPose,
  lineUp,
  movePose,
  type MoveView,
} from '../src/scene/character-moves';

function view(kind: ActionKind, age: number, extra: Partial<MoveView> = {}): MoveView {
  return { kind, step: 0, age, atTree: false, flinchVariant: 0, roll: 'forward', ...extra };
}

describe('drawing a swing', () => {
  it('lands every swing clip on exactly the tick the rules land the blow on', () => {
    LIGHT_COMBO.forEach((swing, index) => {
      const step = index + 1;
      const pose = movePose(view(ActionKind.Swing, swing.impact, { step }));
      expect(pose.clip).not.toBeNull();
      if (pose.clip === null) return;
      expect(pose.time).toBeCloseTo(clipBlowSeconds(pose.clip) ?? -1, 5);
    });
  });

  it('chops at a tree with the woodcutter swing instead, blow still on the tick', () => {
    const [first] = LIGHT_COMBO;
    const impact = first?.impact ?? 4;
    const pose = movePose(view(ActionKind.Swing, impact, { step: 1, atTree: true }));
    expect(pose.clip).toBe('chop');
    expect(pose.time).toBeCloseTo(clipBlowSeconds('chop') ?? -1, 5);
  });

  it('plays each swing of the combo with its own clip', () => {
    const clips = [1, 2, 3].map((step) => movePose(view(ActionKind.Swing, 0, { step })).clip);
    expect(new Set(clips).size).toBe(3);
  });

  it('never asks for a moment before a clip starts', () => {
    expect(lineUp('attack3', 3, 1, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('drawing a raider’s wind-up', () => {
  it('draws back to the raised weapon and holds there until the swing goes', () => {
    const ticks = WINDUP_TICKS[WindupPace.Steady];
    const start = movePose(view(ActionKind.Windup, 0, { step: WindupPace.Steady }));
    const held = movePose(view(ActionKind.Windup, ticks * 0.7, { step: WindupPace.Steady }));
    const ready = movePose(view(ActionKind.Windup, ticks - 0.01, { step: WindupPace.Steady }));
    expect(start.clip).toBe('attack1');
    expect(start.time).toBeCloseTo(0, 5);
    expect(held.time).toBeCloseTo(WINDUP_PEAK_SECONDS, 5);
    expect(ready.time).toBeCloseTo(WINDUP_PEAK_SECONDS, 5);
  });

  it('builds the glow that says a swing is coming, full just as it goes', () => {
    const ticks = WINDUP_TICKS[WindupPace.Heavy];
    const early = movePose(view(ActionKind.Windup, 1, { step: WindupPace.Heavy }));
    const late = movePose(view(ActionKind.Windup, ticks, { step: WindupPace.Heavy }));
    expect(early.windup).toBeGreaterThan(0);
    expect(early.windup).toBeLessThan(0.2);
    expect(late.windup).toBe(1);
    expect(movePose(view(ActionKind.Swing, 2, { step: 1 })).windup).toBe(0);
  });

  it('lets the legs creep in underneath', () => {
    expect(movePose(view(ActionKind.Windup, 3)).legsFree).toBe(true);
  });

  it('carries the swing on from the raised weapon, blow still on the tick', () => {
    const [first] = LIGHT_COMBO;
    const impact = first?.impact ?? 4;
    const out = movePose(view(ActionKind.Swing, 0, { step: 1, afterWindup: true }));
    const blow = movePose(view(ActionKind.Swing, impact, { step: 1, afterWindup: true }));
    expect(out.clip).toBe('attack1');
    expect(out.time).toBeCloseTo(WINDUP_PEAK_SECONDS, 5);
    expect(blow.time).toBeCloseTo(clipBlowSeconds('attack1') ?? -1, 5);
  });
});

describe('drawing a charged strike', () => {
  it('holds a trembling wind-up that grows until the charge is ready', () => {
    const early = movePose(view(ActionKind.Charge, 2));
    const ready = movePose(view(ActionKind.Charge, CHARGE_TICKS));
    expect(early.clip).toBe('chargeHold');
    expect(early.charge).toBeLessThan(ready.charge);
    expect(ready.charge).toBe(1);
  });

  it('lets the legs walk on under the wind-up, but not under the strike', () => {
    expect(movePose(view(ActionKind.Charge, 2)).legsFree).toBe(true);
    expect(movePose(view(ActionKind.Strike, 2)).legsFree).toBe(false);
    expect(movePose(view(ActionKind.Swing, 2)).legsFree).toBe(true);
    expect(movePose(view(ActionKind.Swing, 2, { afterWindup: true })).legsFree).toBe(false);
  });

  it('brings the strike down on the tick it lands', () => {
    const pose = movePose(view(ActionKind.Strike, STRIKE.impact));
    expect(pose.clip).toBe('strike');
    expect(pose.time).toBeCloseTo(clipBlowSeconds('strike') ?? -1, 5);
  });
});

describe('drawing a dodge', () => {
  it('tumbles forward and back as a roll, all the way over by the end of the travel', () => {
    for (const roll of ['forward', 'backward'] as const) {
      expect(movePose(view(ActionKind.Dodge, 0, { roll })).roll).toBe(0);
      expect(movePose(view(ActionKind.Dodge, DODGE.travel, { roll })).roll).toBe(1);
    }
  });

  it('hops to the sides with the pack’s own dodges, not a roll', () => {
    expect(movePose(view(ActionKind.Dodge, 3, { roll: 'left' })).clip).toBe('dodgeLeft');
    expect(movePose(view(ActionKind.Dodge, 3, { roll: 'right' })).clip).toBe('dodgeRight');
    expect(movePose(view(ActionKind.Dodge, 3, { roll: 'left' })).roll).toBeNull();
  });
});

describe('drawing resting', () => {
  it('settles onto the seat and stays there, hands free', () => {
    const sitting = movePose(view(ActionKind.Sit, SETTLE.chair + 30));
    expect(sitting.clip).toBe('sitIdle');
    expect(sitting.loop).toBe(true);
    expect(sitting.rest).toBe(1);
    expect(sitting.handsFree).toBe(true);
  });

  it('is back off the bed and holding things again by the end of getting up', () => {
    const up = movePose(view(ActionKind.Rise, RISE.bed, { step: RiseFrom.Bed }));
    expect(up.rest).toBe(0);
    expect(up.handsFree).toBe(false);
  });

  it('sits down on the bare ground, then waits there with hands free and no seat to slide to', () => {
    const settling = movePose(view(ActionKind.SitGround, 3));
    expect(settling.clip).toBe('sitFloorDown');
    expect(settling.loop).toBe(false);
    const sitting = movePose(view(ActionKind.SitGround, SETTLE.floor + 30));
    expect(sitting.clip).toBe('sitFloorIdle');
    expect(sitting.loop).toBe(true);
    expect(sitting.rest).toBe(0);
    expect(sitting.handsFree).toBe(true);
  });

  it('gets up from the ground with its own clip, holding things again by the end', () => {
    const rising = movePose(view(ActionKind.Rise, 4, { step: RiseFrom.Sat }));
    expect(rising.clip).toBe('sitFloorUp');
    expect(rising.rest).toBe(0);
    expect(rising.handsFree).toBe(true);
    expect(movePose(view(ActionKind.Rise, RISE.floor, { step: RiseFrom.Sat })).handsFree).toBe(
      false,
    );
  });

  it('gets up off the ground where it fell, never onto a bed', () => {
    for (let age = 0; age <= RISE.ground; age += 5) {
      expect(movePose(view(ActionKind.Rise, age, { step: RiseFrom.Ground })).rest).toBe(0);
    }
  });
});

describe('eating', () => {
  it('lifts the food, takes every bite, and lowers an empty hand', () => {
    expect(eatingPose(0).reach).toBe(0);
    expect(eatingPose(0).left).toBe(1);
    for (const bite of EAT_BITES) {
      const pose = eatingPose(bite);
      expect(pose.reach).toBe(1);
      expect(pose.bite).toBe(1);
    }
    const done = eatingPose(EAT_SECONDS);
    expect(done.reach).toBe(0);
    expect(done.left).toBe(0);
  });

  it('eats a little more with every bite', () => {
    let left = 1;
    for (const bite of EAT_BITES) {
      const after = eatingPose(bite + TICK_SECONDS).left;
      expect(after).toBeLessThan(left);
      left = after;
    }
  });

  it('pulls the food just away between bites', () => {
    const [first, second] = EAT_BITES;
    if (first === undefined || second === undefined) throw new Error('no bites');
    expect(eatingPose((first + second) / 2).bite).toBeLessThan(0.1);
  });
});

describe('aerial dodge follow-ups', () => {
  it('lets locomotion animate under the grounded heavy recovery', () => {
    expect(movePose(view(ActionKind.DodgeHeavy, 10)).legsFree).toBe(true);
    expect(movePose(view(ActionKind.DodgeLight, 11)).legsFree).toBe(true);
  });
  it('spins a light slash with the weapon sweep aligned to its impact', () => {
    const pose = movePose(view(ActionKind.DodgeLight, 5));
    expect(pose.clip).toBe('attack2');
    expect(pose.time).toBeCloseTo(clipBlowSeconds('attack2')!);
    expect(pose.aerialTurn).toBe(1);
    expect(pose.somersault).toBe(false);
    expect(pose.legsFree).toBe(false);
  });
  it('finishes the slam somersault upright on the impact/landing tick', () => {
    const pose = movePose(view(ActionKind.DodgeHeavy, 9));
    expect(pose.clip).toBe('strike');
    expect(pose.time).toBeCloseTo(clipBlowSeconds('strike')!);
    expect(pose.aerialTurn).toBe(1);
    expect(pose.somersault).toBe(true);
  });
});

describe('drawing a swing of the shovel', () => {
  it('plays the dig clip, with the blade levering up on the tick the ground opens', () => {
    const pose = movePose(view(ActionKind.Swing, DIG_SWING.impact, { step: 1, digging: true }));
    expect(pose.clip).toBe('digShovel');
    expect(pose.time).toBeCloseTo(clipBlowSeconds('digShovel') ?? -1, 5);
    expect(pose.legsFree).toBe(false);
  });

  it("starts at the beginning and runs at the clip's own pace", () => {
    const start = movePose(view(ActionKind.Swing, 0, { step: 1, digging: true }));
    const later = movePose(view(ActionKind.Swing, 4, { step: 1, digging: true }));
    expect(start.time).toBeLessThan(0.05);
    expect(later.time - start.time).toBeCloseTo(4 * TICK_SECONDS, 5);
  });
});
