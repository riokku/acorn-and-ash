import { describe, expect, it } from 'vitest';

import {
  Pacer,
  REDUCED_DETAIL,
  SLOW_FRAMES_TO_ACT,
  SLOW_FRAME_MS,
  SLOW_GAP_MS,
} from '../src/backdrop/pacing';

/** Frames that take too long to draw. */
function struggle(pacer: Pacer, frames: number): void {
  for (let i = 0; i < frames; i++) pacer.record(SLOW_FRAME_MS + 5, 33);
}

/** Frames that are drawn quickly but arrive late, because something else is busy. */
function starve(pacer: Pacer, frames: number): void {
  for (let i = 0; i < frames; i++) pacer.record(2, SLOW_GAP_MS + 50);
}

describe('keeping the backdrop from getting in the way', () => {
  it('leaves a computer that keeps up alone', () => {
    const pacer = new Pacer();
    for (let i = 0; i < 1000; i++) pacer.record(3, 34);
    expect(pacer.detail).toBe(1);
    expect(pacer.stopped).toBe(false);
  });

  it('forgives a few slow frames among good ones', () => {
    const pacer = new Pacer();
    for (let round = 0; round < 50; round++) {
      struggle(pacer, SLOW_FRAMES_TO_ACT - 1);
      pacer.record(2, 33);
    }
    expect(pacer.detail).toBe(1);
    expect(pacer.stopped).toBe(false);
  });

  it('draws less once a computer keeps struggling', () => {
    const pacer = new Pacer();
    struggle(pacer, SLOW_FRAMES_TO_ACT);
    expect(pacer.detail).toBe(REDUCED_DETAIL);
    expect(pacer.stopped).toBe(false);
  });

  it('gives way when frames arrive late, even if each is quick to draw, as while the game loads', () => {
    const pacer = new Pacer();
    starve(pacer, SLOW_FRAMES_TO_ACT);
    expect(pacer.detail).toBe(REDUCED_DETAIL);
    starve(pacer, SLOW_FRAMES_TO_ACT);
    expect(pacer.stopped).toBe(true);
  });

  it('is not bothered by a single long gap, as when a tab comes back from the background', () => {
    const pacer = new Pacer();
    for (let round = 0; round < 50; round++) {
      pacer.record(2, 33);
      pacer.record(2, 30_000);
    }
    expect(pacer.detail).toBe(1);
    expect(pacer.stopped).toBe(false);
  });

  it('stops the motion altogether if it still struggles with less to draw', () => {
    const pacer = new Pacer();
    struggle(pacer, SLOW_FRAMES_TO_ACT * 2);
    expect(pacer.stopped).toBe(true);
  });

  it('stays stopped', () => {
    const pacer = new Pacer();
    struggle(pacer, SLOW_FRAMES_TO_ACT * 2);
    for (let i = 0; i < 100; i++) pacer.record(1, 33);
    expect(pacer.stopped).toBe(true);
  });
});
