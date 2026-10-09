/** A bounded pool of expanding disturbances left by moving feet in open water. */
export class WaterWake {
  readonly ripples = Array.from({ length: 12 }, () => ({ x: 0, z: 0, age: 10, strength: 0 }));
  private readonly last = new Map<number, { x: number; z: number; wet: boolean }>();
  private cursor = 0;

  update(delta: number): void {
    for (const ripple of this.ripples) ripple.age = Math.min(10, ripple.age + Math.max(0, delta));
  }

  step(id: number, x: number, y: number, z: number, speed: number, surface: number | null): void {
    const wet = surface !== null && y <= surface + 0.18 && y >= surface - 2;
    const previous = this.last.get(id);
    if (previous === undefined || !wet || Math.hypot(x - previous.x, z - previous.z) > 4) {
      if (this.last.size > 128) this.last.clear();
      this.last.set(id, { x, z, wet });
      return;
    }
    if (speed < 0.15 || (previous.wet && Math.hypot(x - previous.x, z - previous.z) < 0.3)) return;
    Object.assign(this.ripples[this.cursor]!, {
      x,
      z,
      age: 0,
      strength: Math.min(1, 0.25 + speed * 0.14),
    });
    this.cursor = (this.cursor + 1) % this.ripples.length;
    this.last.set(id, { x, z, wet });
  }

  clear(): void {
    for (const ripple of this.ripples) {
      ripple.age = 10;
      ripple.strength = 0;
    }
    this.last.clear();
  }
}
