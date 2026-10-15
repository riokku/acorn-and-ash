import { describe, expect, it } from 'vitest';

import {
  ActionKind,
  HOME_BED,
  BOAT_SEAT_HEIGHT,
  STREAM,
  streamPointAt,
  navigableWaterSurfaceAt,
  HOME_CHAIR,
  OUTDOORS,
  RiseFrom,
  dodgeHeading,
  createInput,
} from '@acorn/shared';

import { MoveMemory, restSpotFor, rollDirection, boatSeatAt } from '../src/scene/character-driver';

/** The roll heading for a push of the stick (+Z forward, +X right), the camera looking along -Z. */
function headingFor(moveX: number, moveZ: number): number {
  return dodgeHeading(createInput(1, moveX, moveZ, 0, 0, 0));
}

describe('which way a roll tumbles', () => {
  it('rolls forward when rolling the way the character faces', () => {
    const facingAway = 0; // yaw 0 faces -Z
    expect(rollDirection(headingFor(0, 1), facingAway)).toBe('forward');
    expect(rollDirection(headingFor(0, -1), facingAway)).toBe('backward');
  });

  it('hops left and right to the character’s own sides', () => {
    expect(rollDirection(headingFor(-1, 0), 0)).toBe('left');
    expect(rollDirection(headingFor(1, 0), 0)).toBe('right');
  });

  it('rolls straight back, away from the aim, with no direction held', () => {
    expect(rollDirection(headingFor(0, 0), 0)).toBe('backward');
  });

  it('turns with the character: a roll along +X is forward for somebody facing +X', () => {
    const facingPlusX = -Math.PI / 2;
    expect(rollDirection(headingFor(1, 0), facingPlusX)).toBe('forward');
    expect(rollDirection(headingFor(0, 1), facingPlusX)).toBe('left');
  });
});

describe('where a body rests', () => {
  it('keeps the rider above the actual water at the mountain spring and down the river', () => {
    for (const index of [0, 2, 20, 80, 160, STREAM.count - 1]) {
      const spot = streamPointAt(STREAM, index);
      const seat = boatSeatAt(spot.x, spot.z, 0.7);
      expect(seat).toEqual({
        ...spot,
        y: navigableWaterSurfaceAt(spot.x, spot.z) + BOAT_SEAT_HEIGHT,
        yaw: 0.7,
      });
    }
    const source = streamPointAt(STREAM, 0);
    expect(boatSeatAt(source.x, source.z, 0).y).toBeGreaterThan(30);
  });

  it('settles onto the chair sitting down, and stays there getting up out of it', () => {
    expect(restSpotFor(ActionKind.Sit, 0, 1)).toEqual(HOME_CHAIR.rest);
    expect(restSpotFor(ActionKind.Rise, RiseFrom.Chair, 1)).toEqual(HOME_CHAIR.rest);
  });

  it('lies on the bed, and gets up from it', () => {
    expect(restSpotFor(ActionKind.Lie, 0, 1)).toEqual(HOME_BED.rest);
    expect(restSpotFor(ActionKind.Rise, RiseFrom.Bed, 1)).toEqual(HOME_BED.rest);
  });

  it('gets up off the ground where it stands, and rests nowhere outdoors', () => {
    expect(restSpotFor(ActionKind.Rise, RiseFrom.Ground, 1)).toBeNull();
    expect(restSpotFor(ActionKind.Swing, 1, 1)).toBeNull();
    expect(restSpotFor(ActionKind.Sit, 0, OUTDOORS)).toBeNull();
  });
});

describe('remembering a move from frame to frame', () => {
  it('keeps a swing at a tree a chop all the way through, even if the tree goes', () => {
    const memory = new MoveMemory();
    expect(memory.view(ActionKind.Swing, 1, 0, true, 'forward').atTree).toBe(true);
    expect(memory.view(ActionKind.Swing, 1, 3.5, false, 'forward').atTree).toBe(true);
  });

  it('decides afresh as the next swing of the combo starts', () => {
    const memory = new MoveMemory();
    memory.view(ActionKind.Swing, 1, 0, true, 'forward');
    expect(memory.view(ActionKind.Swing, 2, 0, false, 'forward').atTree).toBe(false);
  });

  it('decides afresh when the same swing starts over', () => {
    const memory = new MoveMemory();
    memory.view(ActionKind.Swing, 1, 8, false, 'forward');
    expect(memory.view(ActionKind.Swing, 1, 0, true, 'forward').atTree).toBe(true);
  });

  it('remembers a swing came straight out of a wind-up, for as long as it lasts', () => {
    const memory = new MoveMemory();
    memory.view(ActionKind.Windup, 0, 9, false, 'forward');
    expect(memory.view(ActionKind.Swing, 1, 0, false, 'forward').afterWindup).toBe(true);
    expect(memory.view(ActionKind.Swing, 1, 3, false, 'forward').afterWindup).toBe(true);
    // The next swing of the combo starts from scratch, like anybody's.
    expect(memory.view(ActionKind.Swing, 2, 0, false, 'forward').afterWindup).toBe(false);
  });

  it('never treats a player’s own swing as coming out of a wind-up', () => {
    const memory = new MoveMemory();
    memory.view(ActionKind.Idle, 0, 4, false, 'forward');
    expect(memory.view(ActionKind.Swing, 1, 0, false, 'forward').afterWindup).toBe(false);
  });

  it('alternates flinches, so two hits in a row do not look the same', () => {
    const memory = new MoveMemory();
    const first = memory.view(ActionKind.Flinch, 0, 0, false, 'forward').flinchVariant;
    expect(memory.view(ActionKind.Flinch, 0, 3, false, 'forward').flinchVariant).toBe(first);
    memory.view(ActionKind.Idle, 0, 0, false, 'forward');
    expect(memory.view(ActionKind.Flinch, 0, 0, false, 'forward').flinchVariant).not.toBe(first);
  });
});

describe('move context through small clock corrections', () => {
  it('keeps a chopping swing after its tree disappears during reconciliation', () => {
    const memory = new MoveMemory();
    memory.view(ActionKind.Swing, 1, 6, true, 'forward');
    const corrected = memory.view(ActionKind.Swing, 1, 5.8, false, 'forward');
    expect(corrected.atTree).toBe(true);
    expect(corrected.age).toBe(5.8);
    expect(memory.view(ActionKind.Swing, 1, 0, false, 'forward').atTree).toBe(false);
  });

  it('keeps digging context as the cursor moves away from the cache', () => {
    const memory = new MoveMemory();
    memory.view(ActionKind.Swing, 1, 6, false, 'forward', true);
    expect(memory.view(ActionKind.Swing, 1, 5.8, false, 'forward', false).digging).toBe(true);
    expect(memory.view(ActionKind.Swing, 2, 0, false, 'forward', false).digging).toBe(false);
  });

  it('keeps the charged wind-up follow-through and flinch variation', () => {
    const memory = new MoveMemory();
    memory.view(ActionKind.Windup, 0, 9, false, 'forward');
    memory.view(ActionKind.Swing, 1, 3, false, 'forward');
    expect(memory.view(ActionKind.Swing, 1, 2.8, false, 'forward').afterWindup).toBe(true);
    const first = memory.view(ActionKind.Flinch, 0, 3, false, 'forward').flinchVariant;
    expect(memory.view(ActionKind.Flinch, 0, 2.8, false, 'forward').flinchVariant).toBe(first);
    expect(memory.view(ActionKind.Flinch, 0, 0, false, 'forward').flinchVariant).not.toBe(first);
  });
});
