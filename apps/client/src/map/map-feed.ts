/**
 * What the two maps show, written by the game every frame and read by the
 * HUD's own drawing loops (see decision 0054).
 *
 * Plain mutable fields rather than the HUD store: the minimap redraws every
 * frame as the camera turns, and going through React for that would redraw
 * the whole HUD sixty times a second for no reason.
 */

import {
  createExploredMap,
  exploreCellAt,
  mergeExplored,
  revealAround,
  type BuildableKindId,
} from '@acorn/shared';

export interface MapPoint {
  readonly x: number;
  readonly z: number;
}

export interface MapPlayer extends MapPoint {
  /** Their chosen tint, as 0xRRGGBB. */
  readonly color: number;
  readonly name: string;
}

export interface MapBuild extends MapPoint {
  readonly kind: BuildableKindId;
  readonly yaw: number;
  /** Only means anything for a campfire. */
  readonly lit: boolean;
}

/** A skeleton raider (see decision 0063). */
export interface MapRaider extends MapPoint {
  /** Drawing back to swing, or swinging, right now. */
  readonly attacking: boolean;
}

export class MapFeed {
  /** The painted world, once it has finished painting. */
  image: HTMLCanvasElement | null = null;
  /** Which parts of the world this player has seen - see `exploring.ts`. */
  readonly explored = createExploredMap();
  /** Goes up every time `explored` grows, so the fog is only worked out again when it has to be. */
  exploredVersion = 0;

  /** Whether there is a world to show at all yet. */
  ready = false;
  player = { x: 0, z: 0, facingYaw: 0 };
  cameraYaw = 0;
  home: (MapPoint & { readonly yaw: number }) | null = null;
  stashes: readonly MapPoint[] = [];
  others: readonly MapPlayer[] = [];
  /** Your own campfires, lanterns, fences, path stones and flower bed. */
  builds: readonly MapBuild[] = [];
  /** Every skeleton still standing, within sight. */
  raiders: readonly MapRaider[] = [];
  isNight = false;

  /** The square the player was last in, so the local reveal only runs on stepping into a new one. */
  private lastCell: number | null = null;

  /**
   * Fill the map in around where this browser thinks the player is, straight
   * away, rather than waiting for the server to say so: the server's copy is
   * the one that is saved, and it merges in whenever it arrives.
   */
  revealAt(x: number, z: number): void {
    const cell = exploreCellAt(x, z);
    if (cell === this.lastCell) return;
    this.lastCell = cell;
    if (revealAround(this.explored, x, z) > 0) this.exploredVersion += 1;
  }

  /** Take in the server's copy, keeping anything either one had seen. */
  mergeFromServer(cells: Uint8Array): void {
    if (mergeExplored(this.explored, cells)) this.exploredVersion += 1;
  }
}
