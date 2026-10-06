/**
 * The rules for showing a character off on the character screen (decision 0107):
 * how far a drag turns them, which flourish a click gives and for how long, where
 * the camera stands so they sit where the page wants them, and when the screen
 * should go easy on a slow computer.
 *
 * Plain numbers in and out, with no Three.js and no page, so it can be tested on
 * its own. The stage (`character-stage.ts`) is what draws it.
 */

import { Gesture } from '@acorn/shared';

/** A drag this many pixels wide turns the character once all the way round. */
export const PIXELS_PER_TURN = 560;

/** A press that moves less than this many pixels, and lets go this fast, is a click and not a drag. */
export const CLICK_MAX_PIXELS = 6;
export const CLICK_MAX_SECONDS = 0.45;

/** How far each arrow key press turns the character, for somebody without a mouse. */
export const KEY_TURN = Math.PI / 12;

/** The wrap-around: an angle brought back into -PI to PI. */
export function normalizeYaw(yaw: number): number {
  const turn = Math.PI * 2;
  const wrapped = (((yaw + Math.PI) % turn) + turn) % turn;
  return wrapped - Math.PI;
}

/**
 * Where the character faces after being dragged sideways by `pixels`, from
 * where they faced before: 0 is straight at the viewer. Dragging right turns
 * the front of them towards the viewer's right, like turning a figure on a table
 * with a finger.
 */
export function turnedByDrag(yaw: number, pixels: number): number {
  return normalizeYaw(yaw + (pixels / PIXELS_PER_TURN) * Math.PI * 2);
}

/** Whether a press was a click: short and still, rather than the start of a drag. */
export function isClick(movedPixels: number, heldSeconds: number): boolean {
  return movedPixels <= CLICK_MAX_PIXELS && heldSeconds <= CLICK_MAX_SECONDS;
}

/** A little something the character does when clicked. */
export interface Flourish {
  readonly name: 'hop' | 'reach' | 'pickUp';
  /** How long it lasts, in seconds. */
  readonly seconds: number;
  /** The hand move it plays, or null for a hop, which is the whole body. */
  readonly gesture: Gesture | null;
  /** How high it throws the character up, in metres, at its highest. */
  readonly lift: number;
}

/** What a click gives, one after another, so two clicks in a row are never the same. */
export const FLOURISHES: readonly Flourish[] = [
  { name: 'hop', seconds: 0.8, gesture: null, lift: 0.3 },
  { name: 'reach', seconds: 1.3, gesture: Gesture.Reach, lift: 0 },
  { name: 'pickUp', seconds: 1.2, gesture: Gesture.PickUp, lift: 0 },
];

/** What the character is doing this moment, for the stage to draw. */
export interface ShowcaseView {
  /** The flourish under way, or null while they simply stand. */
  readonly flourish: Flourish | null;
  /** How far through it, from 0 to 1. */
  readonly progress: number;
  /** How far off the ground, in metres. */
  readonly lift: number;
}

const STANDING: ShowcaseView = { flourish: null, progress: 0, lift: 0 };

/** The flourish being played and how many have been given. */
export class Showcase {
  private current: Flourish | null = null;
  private age = 0;
  private given = 0;

  /** How many flourishes have been started since the screen opened. */
  get count(): number {
    return this.given;
  }

  /**
   * Gives the next flourish, unless the last one is still going: pressing
   * again and again does not restart it. Returns whether one started.
   */
  click(): boolean {
    if (this.current !== null) return false;
    this.current = FLOURISHES[this.given % FLOURISHES.length] ?? null;
    this.age = 0;
    this.given += 1;
    return this.current !== null;
  }

  /** Moves on by this many seconds. */
  step(seconds: number): void {
    if (this.current === null) return;
    this.age += seconds;
    if (this.age >= this.current.seconds) this.current = null;
  }

  get playing(): boolean {
    return this.current !== null;
  }

  view(): ShowcaseView {
    if (this.current === null) return STANDING;
    const progress = Math.min(1, this.age / this.current.seconds);
    // A smooth arch: up and down again, level with the ground at both ends.
    const lift = this.current.lift * 4 * progress * (1 - progress);
    return { flourish: this.current, progress, lift };
  }
}

/** Where on the screen, and how big, the character should stand. */
export interface Placement {
  /** How far across the screen their middle is, from 0 (left) to 1 (right). */
  readonly across: number;
  /** How far up the screen their feet are, from 0 (bottom) to 1 (top). */
  readonly feet: number;
  /** How much of the screen's height they fill, from 0 to 1. */
  readonly share: number;
}

/** The camera that puts a character of this height where the placement asks. */
export interface Framing {
  readonly distance: number;
  readonly x: number;
  readonly lookY: number;
}

/** How wide the camera's view is, top to bottom, in degrees. */
export const VIEW_DEGREES = 30;

/**
 * Where to stand the camera. The character is at the middle of the world, so
 * the camera slides sideways and up to put them where `placement` says, looking
 * straight ahead so nothing is stretched. On a window too narrow to hold them at
 * that size it backs away until they fit.
 */
export function frame(height: number, aspect: number, placement: Placement): Framing {
  const half = Math.tan((VIEW_DEGREES * Math.PI) / 360);
  const wanted = height / placement.share;
  // Their width is about two thirds of their height, with room to turn round.
  const narrowest = (height * 0.75) / aspect;
  const visible = Math.max(wanted, narrowest);
  const width = visible * aspect;
  return {
    distance: visible / 2 / half,
    x: (0.5 - placement.across) * width,
    lookY: (0.5 - placement.feet) * visible,
  };
}

/** Milliseconds a frame of the character may take before it counts as a struggle. */
export const SLOW_STAGE_FRAME_MS = 45;
/** How many struggles in a row make the screen ease off. */
export const STAGE_FRAMES_TO_EASE = 15;
/** How sharp to draw at each step of easing off: full, then less, then least. */
export const STAGE_SHARPNESS: readonly number[] = [1, 0.7, 0.5];

/**
 * Watches how long each frame of the character takes. A computer that keeps
 * struggling is first given a less sharp picture, then a still one: a drawn
 * character is lovely, but never at the cost of the page working.
 */
export class FrameBudget {
  private level = 0;
  private slowRun = 0;
  private halted = false;

  /** Say how long the last frame took. Returns true when the sharpness just changed. */
  record(milliseconds: number): boolean {
    if (this.halted) return false;
    if (milliseconds <= SLOW_STAGE_FRAME_MS) {
      this.slowRun = 0;
      return false;
    }
    this.slowRun += 1;
    if (this.slowRun < STAGE_FRAMES_TO_EASE) return false;
    this.slowRun = 0;
    if (this.level < STAGE_SHARPNESS.length - 1) {
      this.level += 1;
      return true;
    }
    this.halted = true;
    return false;
  }

  /** How sharp to draw now, as a share of the screen's own pixels. */
  get sharpness(): number {
    return STAGE_SHARPNESS[this.level] ?? 1;
  }

  /** True once the character should stop moving and only be redrawn when something changes. */
  get stopped(): boolean {
    return this.halted;
  }
}
