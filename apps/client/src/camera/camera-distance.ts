/** Immediate collision safety; sustained clearance before easing back out. */
export class CameraDistance {
  private clearFor = 0;
  constructor(
    public value: number,
    private readonly resting: number,
    private readonly rate: number,
  ) {}

  update(blocked: number, dt: number): number {
    if (blocked <= this.value + 0.001) {
      this.value = Math.min(this.value, blocked);
      this.clearFor = 0;
    } else {
      // Consume only the portion of this frame after the grace period. This
      // keeps recovery identical at 30/60/144 FPS and through a slow frame.
      const before = this.clearFor;
      this.clearFor += Math.max(0, dt);
      const easing =
        Math.max(0, this.clearFor - RECOVERY_DELAY) - Math.max(0, before - RECOVERY_DELAY);
      const room = Math.min(blocked, this.resting);
      this.value += (room - this.value) * (1 - Math.exp(-this.rate * easing));
    }
    return this.value;
  }

  constrain(distance: number): void {
    if (distance < this.value) {
      this.value = distance;
      this.clearFor = 0;
    }
  }

  reset(distance: number): void {
    this.value = distance;
    this.clearFor = 0;
  }
}
const RECOVERY_DELAY = 0.1;
