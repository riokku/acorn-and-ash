import type { ItemId } from '@acorn/shared';

export interface PickupNotice {
  readonly id: number;
  readonly item: ItemId;
  readonly reason: 'full' | 'limit';
}

/** One readable message, refreshed on retry; rapid taps never stack sounds. */
export class PickupNoticeShelf {
  private notice: PickupNotice | null = null;
  private until = 0;
  private nextSoundAt = 0;
  private nextId = 1;

  show(item: ItemId, reason: PickupNotice['reason'], now: number): boolean {
    const sound = now >= this.nextSoundAt;
    this.notice = { id: this.nextId++, item, reason };
    this.until = now + 3400;
    if (sound) this.nextSoundAt = now + 900;
    return sound;
  }

  current(now: number): PickupNotice | null {
    return now < this.until ? this.notice : null;
  }
}
