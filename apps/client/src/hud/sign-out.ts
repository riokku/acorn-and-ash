/**
 * Signing out from inside the game (decision 0104).
 *
 * The character stays standing in the world until the sign-out goes through, so
 * it takes a short, honest wait: ten seconds in which the player has to be
 * still and unhurt. Moving, swinging or getting hit cancels it, so nobody is
 * signed out in the middle of a fight or a walk they were still enjoying.
 *
 * This file only keeps the count. The game tells it when the player moved or
 * was hurt; the HUD shows what it publishes; the actual leaving (forget who is
 * signed in, go back to the front page) is handed in, so this stays easy to
 * test without a browser.
 */

/** How long the player has to wait, still and unhurt, before they are signed out. */
export const SIGN_OUT_SECONDS = 10;

/** How long a "your sign-out was cancelled" message stays up. */
const NOTICE_MS = 4000;

/** How often the count is checked. Four a second keeps the number from ever looking late. */
const CHECK_MS = 250;

export type SignOutCancelReason = 'moved' | 'hurt' | 'cancelled';

/** What the HUD shows: the number counting down, and why the last countdown stopped. */
export interface SignOutView {
  /** Whole seconds left while counting, or null when nothing is counting. */
  readonly secondsLeft: number | null;
  /** Said once a countdown has been cancelled, or when signing out did not work. */
  readonly notice: string | null;
}

export interface SignOutOptions {
  /** Forget who is signed in and go back to the front page. Rejects if it could not. */
  readonly leave: () => Promise<void>;
  /** Called whenever what the HUD shows has changed. */
  readonly show: (view: SignOutView) => void;
  /** Seconds to wait. Tests shorten this. */
  readonly seconds?: number;
}

export function cancelNotice(reason: SignOutCancelReason): string | null {
  switch (reason) {
    case 'moved':
      return 'Sign-out cancelled because you moved.';
    case 'hurt':
      return 'Sign-out cancelled because you were hurt.';
    // They pressed Cancel themselves, so they already know.
    case 'cancelled':
      return null;
  }
}

export class SignOutCountdown {
  private readonly options: SignOutOptions;
  private readonly milliseconds: number;
  private endsAt: number | null = null;
  private leaving = false;
  private checking: ReturnType<typeof setInterval> | null = null;
  private clearingNotice: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SignOutOptions) {
    this.options = options;
    this.milliseconds = (options.seconds ?? SIGN_OUT_SECONDS) * 1000;
  }

  /** True from pressing Sign out until it has been cancelled or has gone through. */
  get counting(): boolean {
    return this.endsAt !== null;
  }

  begin(): void {
    if (this.counting) return;
    this.clearNotice();
    this.endsAt = Date.now() + this.milliseconds;
    this.leaving = false;
    this.checking = setInterval(() => this.check(), CHECK_MS);
    this.options.show({ secondsLeft: this.secondsLeft(), notice: null });
  }

  cancel(reason: SignOutCancelReason): void {
    // Once the sign-out has been asked for there is no taking it back.
    if (!this.counting || this.leaving) return;
    this.stop();
    this.say(cancelNotice(reason));
  }

  /** The player walked, jumped, swung or rolled. */
  noteMovement(): void {
    this.cancel('moved');
  }

  /** The player took a hit. */
  noteHurt(): void {
    this.cancel('hurt');
  }

  /** Stop all timers, for when the game itself is torn down. */
  dispose(): void {
    this.stop();
    this.clearNotice();
  }

  private check(): void {
    if (this.endsAt === null || this.leaving) return;
    if (Date.now() < this.endsAt) {
      this.options.show({ secondsLeft: this.secondsLeft(), notice: null });
      return;
    }
    this.leaving = true;
    this.options.show({ secondsLeft: 0, notice: null });
    this.options.leave().catch(() => {
      this.stop();
      this.say('Couldn’t sign you out. Please check your connection and try again.');
    });
  }

  /** Whole seconds, rounded up, so the last number on screen is 1 and never 0 until it is done. */
  private secondsLeft(): number {
    if (this.endsAt === null) return 0;
    return Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
  }

  private stop(): void {
    if (this.checking !== null) clearInterval(this.checking);
    this.checking = null;
    this.endsAt = null;
    this.leaving = false;
    this.options.show({ secondsLeft: null, notice: null });
  }

  private say(notice: string | null): void {
    if (notice === null) return;
    this.options.show({ secondsLeft: null, notice });
    this.clearNotice();
    this.clearingNotice = setTimeout(() => {
      this.clearingNotice = null;
      this.options.show({ secondsLeft: null, notice: null });
    }, NOTICE_MS);
  }

  private clearNotice(): void {
    if (this.clearingNotice !== null) clearTimeout(this.clearingNotice);
    this.clearingNotice = null;
  }
}
