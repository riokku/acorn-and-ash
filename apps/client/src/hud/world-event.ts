/**
 * What the HUD says about a world event (decision 0294): a banner as it
 * begins, a reminder by the minimap while it runs, and a banner as it ends.
 *
 * Arriving in a world part-way through an event shows its opening banner too,
 * so nobody is left wondering what the reminder is about. A banner waits its
 * turn behind a place name already on screen.
 *
 * Plain values in and out, no clock of its own, so it can be tested.
 */

import { worldEventTimeLeft, type WorldEventKind, type WorldEventNow } from '@acorn/shared';

export interface WorldEventReminder {
  readonly id: string;
  readonly name: string;
  /** "Ends in 34 minutes". */
  readonly timeLeft: string;
}

export interface WorldEventNews {
  readonly title: string;
  readonly line: string;
}

export class WorldEventWatcher {
  private current: WorldEventKind | null = null;
  private waiting: WorldEventNews | null = null;
  private seenAny = false;

  /** Forget everything, as on arriving in a world. */
  reset(): void {
    this.current = null;
    this.waiting = null;
    this.seenAny = false;
  }

  /**
   * Call every frame. `bannerFree` is whether the screen has room for a banner
   * right now. Returns a banner to show the moment one is due, and the
   * reminder to keep by the minimap (null when nothing is on).
   */
  update(
    now: WorldEventNow | null,
    bannerFree: boolean,
  ): { news: WorldEventNews | null; reminder: WorldEventReminder | null } {
    const event = now?.event ?? null;
    if (event !== this.current) {
      if (event !== null) this.waiting = { title: event.name, line: event.opening };
      // An ending is only news to somebody who was here while it was on.
      else if (this.current !== null && this.seenAny)
        this.waiting = { title: this.current.name, line: this.current.closing };
      this.current = event;
    }
    this.seenAny = true;
    let news: WorldEventNews | null = null;
    if (this.waiting !== null && bannerFree) {
      news = this.waiting;
      this.waiting = null;
    }
    const reminder =
      now === null
        ? null
        : { id: now.event.id, name: now.event.name, timeLeft: worldEventTimeLeft(now.endsInMs) };
    return { news, reminder };
  }
}
