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
  navigableWaterSurfaceAt,
  restingPlaceAt,
  outdoorSeatInReach,
  type BenchPlacement,
  type Vec3,
  OUTDOORS,
  RiseFrom,
  headingDirection,
  type RestingPlace,
} from '@acorn/shared';

/** What has been built in the room, and where the body is. */
export interface IndoorSurroundings {
  readonly pieces: Parameters<typeof restingPlaceAt>[3];
  readonly position: Readonly<Pick<Vec3, 'x' | 'z'>>;
}

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
  return { x, y: navigableWaterSurfaceAt(x, z) + BOAT_SEAT_HEIGHT, z, yaw: facingYaw };
}

/**
 * Where a body in a home settles for this move - the seat of the chair or
 * the mattress of the bed it is using, whichever built one is nearest - or
 * null when it stays where it stands.
 */
export function restSpotFor(
  kind: ActionKind,
  step: number,
  space: number,
  indoor?: IndoorSurroundings,
  outdoor?: {
    pieces: readonly BenchPlacement[];
    position: Readonly<Vec3>;
    heightAt: (x: number, z: number) => number;
  },
): RestSpot | null {
  if (space === OUTDOORS) {
    if (
      !outdoor ||
      (kind !== ActionKind.Sit && !(kind === ActionKind.Rise && step === RiseFrom.Chair))
    )
      return null;
    return outdoorSeatInReach(outdoor.pieces, outdoor.position, outdoor.heightAt)?.rest ?? null;
  }
  const place = restingPlaceFor(kind, step);
  if (place === null || !indoor) return null;
  return restingPlaceAt(place, indoor.position.x, indoor.position.z, indoor.pieces)?.rest ?? null;
}

function restingPlaceFor(kind: ActionKind, step: number): RestingPlace['kind'] | null {
  if (kind === ActionKind.Sit || (kind === ActionKind.Rise && step === RiseFrom.Chair)) {
    return 'chair';
  }
  if (kind === ActionKind.Lie || (kind === ActionKind.Rise && step === RiseFrom.Bed)) {
    return 'bed';
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
  private digging = false;
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
    diggingNow = false,
  ): MoveView {
    // Match the animator: a sub-tick reconciliation is still the same move,
    // so nearby scenery and wind-up context cannot change its clip mid-swing.
    const fresh = kind !== this.kind || step !== this.step || age + 1 < this.age;
    if (fresh) {
      if (kind === ActionKind.Swing) {
        this.atTree = atTreeNow;
        this.digging = diggingNow;
      }
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
      digging: this.digging,
      flinchVariant: this.flinchVariant,
      roll,
      afterWindup: this.afterWindup,
    };
  }
}
