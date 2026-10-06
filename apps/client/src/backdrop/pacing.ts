/**
 * Keeps the backdrop from getting in the way (decision 0106).
 *
 * The moving picture is decoration. On a slow computer, or while the game is
 * busy loading behind it, drawing it must never make anything else worse, so
 * this watches how long each frame of it takes. A computer that keeps struggling
 * is first given less to draw (fewer leaves and flakes) and, if it still
 * struggles, nothing moves at all and the picture is left as a still.
 *
 * It is a plain counter with no timers or canvas, so it can be tested on its own.
 */

/** A frame that takes longer than this, in milliseconds, to draw is a struggle. */
export const SLOW_FRAME_MS = 12;

/**
 * So is a frame that arrives longer than this, in milliseconds, after the one
 * before. That is what it looks like when something else, such as the game
 * loading behind the loading screen, is using up the computer, and the backdrop
 * should be the first thing to give way.
 */
export const SLOW_GAP_MS = 100;

/** How many struggles in a row are needed before doing something about it. */
export const SLOW_FRAMES_TO_ACT = 20;

/** How much of the usual number of leaves and flakes to keep when struggling. */
export const REDUCED_DETAIL = 0.35;

export class Pacer {
  /** From 0 to 1: how much of the usual number of falling things to draw. */
  detail = 1;
  /** True once the picture should stop moving for good. */
  stopped = false;

  private slowRun = 0;

  /**
   * Say how long the last frame took to draw, and how long after the frame
   * before it arrived, both in milliseconds.
   */
  record(drawMs: number, gapMs: number): void {
    if (this.stopped) return;
    if (drawMs <= SLOW_FRAME_MS && gapMs <= SLOW_GAP_MS) {
      this.slowRun = 0;
      return;
    }
    this.slowRun += 1;
    if (this.slowRun < SLOW_FRAMES_TO_ACT) return;
    this.slowRun = 0;
    if (this.detail > REDUCED_DETAIL) this.detail = REDUCED_DETAIL;
    else this.stopped = true;
  }
}
