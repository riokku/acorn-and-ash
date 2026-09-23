import { describe, expect, it } from 'vitest';

import { CHOP_REACH } from '../src/constants';
import { animalInReach, type CatchCandidate } from '../src/sim/hunting';

const rabbit: CatchCandidate = { id: 1, x: 0, z: -5 };
const other: CatchCandidate = { id: 2, x: 6, z: 0 };

/** Yaw zero looks down -Z, so this is "facing the rabbit". */
const NORTH = 0;

describe('what a swing reaches, out among the wildlife', () => {
  it('finds the animal you are facing', () => {
    const target = animalInReach({ x: 0, y: 0, z: -3.5 }, NORTH, [rabbit, other]);
    expect(target?.id).toBe(rabbit.id);
  });

  it('finds nothing when you are too far away', () => {
    expect(animalInReach({ x: 0, y: 0, z: 0 }, NORTH, [rabbit])).toBeNull();
  });

  it('finds nothing when the animal is behind you', () => {
    expect(animalInReach({ x: 0, y: 0, z: -3.5 }, Math.PI, [rabbit])).toBeNull();
  });

  it('refuses an animal off to the side', () => {
    expect(animalInReach({ x: 0, y: 0, z: -3.5 }, Math.PI / 2, [rabbit])).toBeNull();
  });

  it('is not fussy about being perfectly squared up', () => {
    const target = animalInReach({ x: 0, y: 0, z: -3.5 }, 0.5, [rabbit]);
    expect(target?.id).toBe(rabbit.id);
  });

  it('measures reach to wherever the animal actually is, with no trunk to spare', () => {
    // Exactly CHOP_REACH from the rabbit, unlike a tree there is no radius to
    // add: a hair closer finds it, a hair further does not.
    const justInReach = { x: 0, y: 0, z: -5 + CHOP_REACH - 0.01 };
    const justOutOfReach = { x: 0, y: 0, z: -5 + CHOP_REACH + 0.01 };
    expect(animalInReach(justInReach, NORTH, [rabbit])?.id).toBe(rabbit.id);
    expect(animalInReach(justOutOfReach, NORTH, [rabbit])).toBeNull();
  });

  it('does not divide by zero standing right on top of it', () => {
    expect(animalInReach({ x: 0, y: 0, z: -5 }, NORTH, [rabbit])).toBeNull();
  });

  it('takes the nearer of two animals in front of you', () => {
    const near: CatchCandidate = { id: 7, x: 0, z: -1.5 };
    const far: CatchCandidate = { id: 8, x: 0, z: -2.1 };
    expect(animalInReach({ x: 0, y: 0, z: 0 }, NORTH, [far, near])?.id).toBe(near.id);
  });

  it('finds nothing among an empty list', () => {
    expect(animalInReach({ x: 0, y: 0, z: -3.5 }, NORTH, [])).toBeNull();
  });
});
