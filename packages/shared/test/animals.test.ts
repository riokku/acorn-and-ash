import { describe, expect, it } from 'vitest';

import { ANIMAL_TARGET_REACHED_DISTANCE } from '../src/constants';
import {
  fleeDirection,
  hasReachedTarget,
  shouldFlee,
  towardDirection,
  wanderTarget,
} from '../src/sim/animals';

describe('deciding whether to flee', () => {
  const kind = { alertRadius: 7, safeRadius: 11 };

  it('stays calm while nobody is close', () => {
    expect(shouldFlee(false, 20, kind)).toBe(false);
  });

  it('startles once a player is within the alert radius', () => {
    expect(shouldFlee(false, 6, kind)).toBe(true);
  });

  it('does not startle right at the edge of the alert radius', () => {
    expect(shouldFlee(false, 7, kind)).toBe(false);
  });

  it('keeps fleeing until a player falls back past the safe radius', () => {
    expect(shouldFlee(true, 9, kind)).toBe(true);
  });

  it('calms down once a player is far enough away', () => {
    expect(shouldFlee(true, 12, kind)).toBe(false);
  });

  it('does not flicker in the gap between the two radii', () => {
    // Nine metres is inside "calm down" territory but outside "startle"
    // territory: whichever state it was already in should hold.
    expect(shouldFlee(false, 9, kind)).toBe(false);
    expect(shouldFlee(true, 9, kind)).toBe(true);
  });
});

describe('fleeing', () => {
  it('points straight away from the threat', () => {
    const direction = fleeDirection(0, 0, 5, 0);
    expect(direction.x).toBeCloseTo(-1, 5);
    expect(direction.z).toBeCloseTo(0, 5);
  });

  it('is always a unit vector', () => {
    const direction = fleeDirection(2, 2, -3, 7);
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1, 5);
  });

  it('picks a direction rather than dividing by zero when caught up to', () => {
    const direction = fleeDirection(4, 4, 4, 4);
    expect(Number.isFinite(direction.x)).toBe(true);
    expect(Number.isFinite(direction.z)).toBe(true);
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1, 5);
  });
});

describe('wandering toward a target', () => {
  it('points toward the target', () => {
    const direction = towardDirection(0, 0, 0, 10);
    expect(direction.x).toBeCloseTo(0, 5);
    expect(direction.z).toBeCloseTo(1, 5);
  });

  it('stands still once already there', () => {
    const direction = towardDirection(3, 3, 3, 3);
    expect(direction.x).toBe(0);
    expect(direction.z).toBe(0);
  });
});

describe('arriving at a wander target', () => {
  it('is not there yet from a distance', () => {
    expect(hasReachedTarget(0, 0, 5, 0)).toBe(false);
  });

  it('counts arriving within the reached distance', () => {
    const almost = ANIMAL_TARGET_REACHED_DISTANCE * 0.5;
    expect(hasReachedTarget(0, 0, almost, 0)).toBe(true);
  });

  it('counts standing exactly on the target', () => {
    expect(hasReachedTarget(1, 1, 1, 1)).toBe(true);
  });
});

describe('drawing a wander target', () => {
  it('is the same for the same seed, animal and decision', () => {
    const a = wanderTarget(42, 1001, 3, 0, 0, 9);
    const b = wanderTarget(42, 1001, 3, 0, 0, 9);
    expect(a).toEqual(b);
  });

  it('changes with the decision count, so a rabbit does not amble forever in a circle', () => {
    const a = wanderTarget(42, 1001, 3, 0, 0, 9);
    const b = wanderTarget(42, 1001, 4, 0, 0, 9);
    expect(a).not.toEqual(b);
  });

  it('differs between animals sharing a den, so a pair does not walk in lockstep', () => {
    const a = wanderTarget(42, 1001, 3, 0, 0, 9);
    const b = wanderTarget(42, 1002, 3, 0, 0, 9);
    expect(a).not.toEqual(b);
  });

  it('never lands further than the leash radius from the den', () => {
    const denX = 12;
    const denZ = -30;
    const leashRadius = 9;
    for (let decisionSeq = 0; decisionSeq < 50; decisionSeq++) {
      const target = wanderTarget(7, 1001, decisionSeq, denX, denZ, leashRadius);
      const distance = Math.hypot(target.x - denX, target.z - denZ);
      expect(distance).toBeLessThanOrEqual(leashRadius);
    }
  });
});
