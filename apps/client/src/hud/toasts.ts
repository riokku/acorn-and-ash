import type { ItemId } from '@acorn/shared';

/**
 * The little notes down the right-hand side whenever something goes into the
 * pack: "+3 Sticks", "+1 Axe" (see decision 0061).
 *
 * Worked out here in the browser, from the pack the server sends, rather
 * than the server saying so for every way something can be gained: anything
 * the pack gains shows, whatever it came from - a patch, a pile, a catch, a
 * craft or a stash dug back up.
 */

/** How long a toast stays up, in milliseconds, counted from the last time it grew. */
export const TOAST_MS = 3200;
/** How long before it goes that it starts to fade. */
export const TOAST_FADE_MS = 500;
/** How many are shown at once. The oldest goes when another would make one too many. */
export const MAX_TOASTS = 5;

/** One toast as it stands: what was gained and how many, all told. */
export interface Toast {
  readonly id: number;
  readonly item: ItemId;
  readonly count: number;
  /** When it goes, in `performance.now()` milliseconds. */
  readonly until: number;
}

/** A toast as the HUD draws it. */
export interface ToastView {
  readonly id: number;
  readonly item: ItemId;
  readonly count: number;
  /** In its last moments, and fading out. */
  readonly fading: boolean;
}

type Carried = readonly { readonly item: ItemId; readonly count: number }[];

/** Everything there is more of now than before, and how many more. Losses are not news here. */
export function packGains(
  before: Carried,
  after: Carried,
): { readonly item: ItemId; readonly count: number }[] {
  const had = new Map<ItemId, number>();
  for (const entry of before) had.set(entry.item, (had.get(entry.item) ?? 0) + entry.count);
  const gained: { item: ItemId; count: number }[] = [];
  for (const entry of after) {
    const more = entry.count - (had.get(entry.item) ?? 0);
    if (more > 0) gained.push({ item: entry.item, count: more });
  }
  return gained;
}

/** The toasts up right now: what each one says, and when it goes. */
export class ToastShelf {
  private toasts: Toast[] = [];
  private nextId = 1;

  /**
   * Show what was just gained. Gaining more of something that already has a
   * toast up adds to it, and keeps it up a while longer, rather than adding
   * another: picking up three sticks in a row says "+3 Sticks", once.
   */
  add(gained: readonly { readonly item: ItemId; readonly count: number }[], now: number): void {
    this.dropExpired(now);
    for (const gain of gained) {
      if (gain.count <= 0) continue;
      const until = now + TOAST_MS;
      const existing = this.toasts.find((toast) => toast.item === gain.item);
      if (existing === undefined) {
        this.toasts.push({ id: this.nextId++, item: gain.item, count: gain.count, until });
      } else {
        // Moved to the end, so whatever was most recently gained is always
        // the newest one showing.
        this.toasts = [
          ...this.toasts.filter((toast) => toast !== existing),
          { ...existing, count: existing.count + gain.count, until },
        ];
      }
    }
    if (this.toasts.length > MAX_TOASTS) this.toasts = this.toasts.slice(-MAX_TOASTS);
  }

  /** Every toast still up right now, oldest first. */
  current(now: number): ToastView[] {
    this.dropExpired(now);
    return this.toasts.map((toast) => ({
      id: toast.id,
      item: toast.item,
      count: toast.count,
      fading: now >= toast.until - TOAST_FADE_MS,
    }));
  }

  /** Clear the lot, for a fresh start. */
  clear(): void {
    this.toasts = [];
  }

  private dropExpired(now: number): void {
    this.toasts = this.toasts.filter((toast) => now < toast.until);
  }
}
