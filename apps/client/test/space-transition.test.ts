import { describe, expect, it } from 'vitest';
import { SpaceTransition } from '../src/scene/space-transition';

describe('preparing the view beyond a doorway', () => {
  it('opens promptly after a fast destination has drawn and the short fade has held', () => {
    const transition = new SpaceTransition();
    transition.begin(0);
    for (let now = 16; now < 140; now += 16) expect(transition.afterRender(now, 5)).toBe(false);
    expect(transition.active).toBe(true);
    expect(transition.afterRender(144, 5)).toBe(true);
    expect(transition.active).toBe(false);
    expect(transition.afterRender(160, 5)).toBe(false);
  });

  it('waits through loading stalls and requires three settled destination frames', () => {
    const transition = new SpaceTransition();
    transition.begin(100);
    expect(transition.afterRender(1200, 1000)).toBe(false);
    expect(transition.afterRender(1216, 5)).toBe(false);
    expect(transition.afterRender(1232, 5)).toBe(false);
    // Even a cheap draw does not hide a stall between frames.
    expect(transition.afterRender(2000, 5)).toBe(false);
    expect(transition.afterRender(2016, 5)).toBe(false);
    expect(transition.afterRender(2032, 5)).toBe(false);
    expect(transition.afterRender(2048, 5)).toBe(true);
  });

  it('starts afresh if the server moves us elsewhere during preparation', () => {
    const transition = new SpaceTransition();
    transition.begin(0);
    transition.afterRender(200, 5);
    transition.afterRender(216, 5);
    transition.begin(220);
    expect(transition.afterRender(236, 5)).toBe(false);
    expect(transition.active).toBe(true);
    expect(transition.afterRender(380, 5)).toBe(false);
    expect(transition.afterRender(396, 5)).toBe(false);
    expect(transition.afterRender(412, 5)).toBe(false);
    expect(transition.afterRender(428, 5)).toBe(true);
  });

  it('cannot trap a player behind the curtain on a consistently slow device', () => {
    const transition = new SpaceTransition();
    transition.begin(0);
    for (let now = 500; now < 8000; now += 500)
      expect(transition.afterRender(now, 500)).toBe(false);
    expect(transition.afterRender(8000, 500)).toBe(true);
    expect(transition.active).toBe(false);
  });
});
