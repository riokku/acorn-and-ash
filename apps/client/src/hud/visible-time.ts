/** A budget spent only while a message is visible. Times are monotonic milliseconds. */
export class VisibleTime {
  private remainingMs: number;
  private startedAt: number | null = null;

  constructor(durationMs: number) {
    this.remainingMs = durationMs;
  }

  start(now: number): number {
    if (this.startedAt === null) this.startedAt = now;
    return this.remaining(now);
  }

  pause(now: number): void {
    this.remainingMs = this.remaining(now);
    this.startedAt = null;
  }

  remaining(now: number): number {
    return Math.max(0, this.remainingMs - (this.startedAt === null ? 0 : now - this.startedAt));
  }
}
