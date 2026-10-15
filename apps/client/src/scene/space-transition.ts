/** A door opens onto rendered, settled frames, rather than a fixed loading delay. */
export class SpaceTransition {
  private beganAt: number | null = null;
  private lastDrawAt: number | null = null;
  private settledFrames = 0;

  get active(): boolean {
    return this.beganAt !== null;
  }

  begin(now: number): void {
    this.beganAt = now;
    this.lastDrawAt = null;
    this.settledFrames = 0;
  }

  /** Called only after drawing the destination, with the full, unclamped frame cost. */
  afterRender(now: number, frameMs: number): boolean {
    if (this.beganAt === null) return false;
    const elapsed = now - this.beganAt;
    const betweenDraws = this.lastDrawAt === null ? frameMs : now - this.lastDrawAt;
    this.lastDrawAt = now;
    this.settledFrames = Math.max(frameMs, betweenDraws) <= 100 ? this.settledFrames + 1 : 0;
    // Three settled frames let uploads and first-use shaders catch up. The
    // short minimum preserves the door fade on fast machines. A low frame
    // rate must never leave someone behind a permanent curtain.
    if (elapsed < 140 || (this.settledFrames < 3 && elapsed < 8000)) return false;
    this.beganAt = null;
    return true;
  }
}
