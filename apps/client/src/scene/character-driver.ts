/**
 * The small decisions between "what a character is doing", as the shared
 * rules have it, and how it is drawn: which way a roll tumbles, where a
 * sitting or lying body settles, whether a swing is a woodcutter's chop at a
 * tree, and which flinch to show. Kept apart from the game so each can be
 * tested on its own.
 */

import {
  ActionKind,
  BOAT_SEAT_HEIGHT,
  HOME_BED,
  homeRestingPlace,
  type HomeKind,
  HOME_CHAIR,
  OUTDOORS,
  RiseFrom,
  headingDirection,
  type RestingPlace,
} from '@acorn/shared';

import type { MoveView } from './character-moves';
import type { RestSpot, RollDirection } from './character';

/**
 * Which way a roll tumbles, as the character sees it: `heading` is the
 * roll's own direction (see `dodgeHeading`), `facingYaw` which way the
 * character faces. Yaw 0 faces -Z, and the character's left is -X then.
 */
export function rollDirection(heading: number, facingYaw: number): RollDirection {
  const direction = headingDirection(heading);
  // Into the character's own frame: forward is -Z, right is +X.
  const cos = Math.cos(facingYaw);
  const sin = Math.sin(facingYaw);
  const right = direction.x * cos - direction.z * sin;
  const forward = -(direction.x * sin + direction.z * cos);
  if (Math.abs(forward) >= Math.abs(right)) return forward >= 0 ? 'forward' : 'backward';
  return right >= 0 ? 'right' : 'left';
}

/**
 * Where a rower sits: on the middle seat of their own boat, in the middle of
 * it, facing out over the bow. Wherever they are drawn, that is where the
 * boat is, so the seat only needs lifting to the height of the thwart.
 */
export function boatSeatAt(x: number, z: number, facingYaw: number): RestSpot {
  return { x, y: BOAT_SEAT_HEIGHT, z, yaw: facingYaw };
}

/**
 * Where a body in a home settles for this move - the chair's seat or the
 * bed's mattress - or null when it stays where it stands. Rooms are all
 * laid out alike (see `world/home.ts`), so the spot needs nothing else.
 */
export function restSpotFor(
  kind: ActionKind,
  step: number,
  space: number,
  homeKind: HomeKind = 'cabin',
): RestSpot | null {
  if (space === OUTDOORS) return null;
  const place = restingPlaceFor(kind, step);
  return place === null ? null : homeRestingPlace(place, homeKind).rest;
}

function restingPlaceFor(kind: ActionKind, step: number): RestingPlace | null {
  if (kind === ActionKind.Sit || (kind === ActionKind.Rise && step === RiseFrom.Chair)) {
    return HOME_CHAIR;
  }
  if (kind === ActionKind.Lie || (kind === ActionKind.Rise && step === RiseFrom.Bed)) {
    return HOME_BED;
  }
  return null;
}

/**
 * What one character's moves need remembering from frame to frame: whether
 * the swing under way is at a tree - decided once, as it starts, so a swing
 * never changes clip halfway through - which of two flinches is next, and
 * whether a swing came straight out of a raider's wind-up.
 */
export class MoveMemory {
  private kind: ActionKind = ActionKind.Idle;
  private step = 0;
  private age = 0;
  private atTree = false;
  private flinchVariant: 0 | 1 = 0;
  private afterWindup = false;

  /**
   * This frame's move, for drawing. `atTreeNow` says whether a swing
   * starting right now would be at a tree.
   */
  view(
    kind: ActionKind,
    step: number,
    age: number,
    atTreeNow: boolean,
    roll: RollDirection,
  ): MoveView {
    const fresh = kind !== this.kind || step !== this.step || age < this.age;
    if (fresh) {
      if (kind === ActionKind.Swing) this.atTree = atTreeNow;
      if (kind === ActionKind.Flinch) this.flinchVariant = this.flinchVariant === 0 ? 1 : 0;
      this.afterWindup = kind === ActionKind.Swing && this.kind === ActionKind.Windup;
    }
    this.kind = kind;
    this.step = step;
    this.age = age;
    return {
      kind,
      step,
      age,
      atTree: this.atTree,
      flinchVariant: this.flinchVariant,
      roll,
      afterWindup: this.afterWindup,
    };
  }
}
