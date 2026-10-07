/**
 * What the combat overlay draws (see decision 0063), written by the game
 * every frame and read by the overlay's own drawing loop.
 *
 * Plain mutable fields rather than the HUD store, for the same reason as
 * `MapFeed`: an arrow pointing at a skeleton has to turn smoothly with the
 * camera, and going through React for that would redraw the whole HUD
 * sixty times a second.
 */

/** A raider out of sight, to point at from round the middle of the screen. */
export interface ThreatMark {
  /**
   * Which way it is from the player, in radians: 0 straight ahead of the
   * camera, positive round to the right - the same way `compassTo` reads.
   */
  readonly bearing: number;
  readonly distance: number;
  /** Drawing back to swing, or swinging, right now. */
  readonly attacking: boolean;
}

export interface SelectedTargetMark {
  readonly name: string;
  readonly distance: number;
  readonly bearing: number;
  /** Normalized screen coordinates, or null when off screen. */
  readonly screen: { readonly x: number; readonly y: number } | null;
}

export class CombatFeed {
  target: SelectedTargetMark | null = null;
  /** Whether to draw anything at all: playing, out of doors, with the map shut. */
  showing = false;
  /** Every raider worth pointing at that is not on screen right now. */
  threats: readonly ThreatMark[] = [];
  /** Health left, from 0 to 1. */
  health = 1;
  /** Which way the camera looks, for turning `hurtYaw` into a bearing as it turns. */
  cameraYaw = 0;
  /** When we were last hurt, on `performance.now()`'s clock. */
  hurtAtMs = -Infinity;
  /** How badly, from 0 to 1. */
  hurtAmount = 0;
  /**
   * The way the blow came from, as a world heading (0 looks down -Z, the
   * same as facing everywhere else), or null when there is no telling.
   */
  hurtYaw: number | null = null;

  /** We just took a blow: how badly, and from where, if that is known. */
  hurt(amount: number, fromYaw: number | null, nowMs: number): void {
    this.hurtAtMs = nowMs;
    this.hurtAmount = Math.min(1, Math.max(0, amount));
    this.hurtYaw = fromYaw;
  }
}
