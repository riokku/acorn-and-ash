import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SIGN_OUT_SECONDS,
  SignOutCountdown,
  cancelNotice,
  type SignOutView,
} from '../src/hud/sign-out';

function setUp(leave: () => Promise<void> = () => Promise.resolve()) {
  const views: SignOutView[] = [];
  const leaving = vi.fn(leave);
  const countdown = new SignOutCountdown({ leave: leaving, show: (view) => views.push(view) });
  const latest = (): SignOutView | undefined => views[views.length - 1];
  return { countdown, leaving, views, latest };
}

describe('signing out from the game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('takes ten seconds', () => {
    expect(SIGN_OUT_SECONDS).toBe(10);
  });

  it('starts counting from ten, and counts down a second at a time', () => {
    const { countdown, latest } = setUp();
    countdown.begin();
    expect(countdown.counting).toBe(true);
    expect(latest()).toEqual({ secondsLeft: 10, notice: null });

    vi.advanceTimersByTime(3000);
    expect(latest()?.secondsLeft).toBe(7);
    vi.advanceTimersByTime(6000);
    expect(latest()?.secondsLeft).toBe(1);
  });

  it('signs the player out when the ten seconds are up, and not before', () => {
    const { countdown, leaving } = setUp();
    countdown.begin();
    vi.advanceTimersByTime(9750);
    expect(leaving).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(leaving).toHaveBeenCalledTimes(1);
  });

  it('only signs out once, however long the page takes to reload', () => {
    const { countdown, leaving } = setUp(() => new Promise<void>(() => undefined));
    countdown.begin();
    vi.advanceTimersByTime(30_000);
    expect(leaving).toHaveBeenCalledTimes(1);
  });

  it('is cancelled by moving, and says so', () => {
    const { countdown, leaving, latest } = setUp();
    countdown.begin();
    vi.advanceTimersByTime(4000);
    countdown.noteMovement();

    expect(countdown.counting).toBe(false);
    expect(latest()).toEqual({
      secondsLeft: null,
      notice: 'Sign-out cancelled because you moved.',
    });
    vi.advanceTimersByTime(20_000);
    expect(leaving).not.toHaveBeenCalled();
  });

  it('is cancelled by getting hurt, and says so', () => {
    const { countdown, leaving, views } = setUp();
    countdown.begin();
    countdown.noteHurt();

    expect(countdown.counting).toBe(false);
    expect(views.some((view) => view.notice === 'Sign-out cancelled because you were hurt.')).toBe(
      true,
    );
    vi.advanceTimersByTime(20_000);
    expect(leaving).not.toHaveBeenCalled();
  });

  it('is cancelled quietly by the Cancel button', () => {
    const { countdown, latest } = setUp();
    countdown.begin();
    countdown.cancel('cancelled');

    expect(countdown.counting).toBe(false);
    expect(latest()).toEqual({ secondsLeft: null, notice: null });
    expect(cancelNotice('cancelled')).toBeNull();
  });

  it('takes the message down again after a few seconds', () => {
    const { countdown, latest } = setUp();
    countdown.begin();
    countdown.noteMovement();
    expect(latest()?.notice).not.toBeNull();
    vi.advanceTimersByTime(4100);
    expect(latest()).toEqual({ secondsLeft: null, notice: null });
  });

  it('ignores movement and hits when nobody is signing out', () => {
    const { countdown, views } = setUp();
    countdown.noteMovement();
    countdown.noteHurt();
    expect(views).toEqual([]);
  });

  it('can be started again after a cancel, from a fresh ten', () => {
    const { countdown, leaving, latest } = setUp();
    countdown.begin();
    vi.advanceTimersByTime(8000);
    countdown.noteMovement();

    countdown.begin();
    expect(latest()).toEqual({ secondsLeft: 10, notice: null });
    vi.advanceTimersByTime(10_250);
    expect(leaving).toHaveBeenCalledTimes(1);
  });

  it('cannot be taken back once the sign-out has gone out', () => {
    const { countdown, leaving } = setUp(() => new Promise<void>(() => undefined));
    countdown.begin();
    vi.advanceTimersByTime(10_250);
    expect(leaving).toHaveBeenCalledTimes(1);

    countdown.noteMovement();
    expect(countdown.counting).toBe(true);
  });

  it('says so, and lets the player try again, when signing out did not work', async () => {
    const { countdown, latest, leaving } = setUp(() => Promise.reject(new Error('offline')));
    countdown.begin();
    await vi.advanceTimersByTimeAsync(10_250);

    expect(leaving).toHaveBeenCalledTimes(1);
    expect(countdown.counting).toBe(false);
    expect(latest()?.notice).toContain('Couldn’t sign you out');

    countdown.begin();
    expect(countdown.counting).toBe(true);
  });

  it('leaves no timers running once the game is torn down', () => {
    const { countdown } = setUp();
    countdown.begin();
    countdown.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
